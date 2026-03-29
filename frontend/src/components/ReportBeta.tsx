import { useState, useRef, useEffect, useCallback } from 'react';
import { uploadInstructionFile, analyzeReportContext, generateReport, exportReportPdf, parseFileData, type ContextForm, type FollowUpQuestion, type GeneratedSections } from '../services/api';
// @ts-ignore - plotly.js-dist-min has no types
import Plotly from 'plotly.js-dist-min';
import Plot from './PlotWrapper';
import { useAnalysis } from '../context/AnalysisContext';
import SectionAccordion from './report/SectionAccordion';
import TitlePageForm, { type TitlePageData } from './report/TitlePageForm';
import PlotThumbnail from './report/PlotThumbnail';
import { roundWithUncertainty } from '../utils/format';

/**
 * Normalize raw AutoLab results to ReportAnalysisData shape (camelCase).
 * The backend prompt builder reads camelCase keys. If we send snake_case,
 * analysis context injection is empty and AI hallucates values.
 */
function normalizeAnalysisData(raw: Record<string, unknown>): Record<string, unknown> {
    // If data already has camelCase keys (e.g., fit.modelName), return as-is
    const state = (raw as Record<string, any>)?.state ?? raw;
    const fit = state?.fit;
    if (!fit) return raw;

    // Check if already normalized (camelCase)
    if (fit.modelName !== undefined) return raw;

    // Needs normalization: snake_case -> camelCase
    const params = fit.parameter_names ?? [];
    const values = fit.parameters ?? [];
    const uncertainties = fit.uncertainties ?? [];
    const roundedArr = fit.rounded ?? [];
    const latexArr = fit.latex_names ?? params;

    const normalizedFit: Record<string, unknown> = {
        modelName: fit.model_name ?? 'unknown',
        parameters: params.map((name: string, i: number) => ({
            name,
            value: values[i] ?? 0,
            uncertainty: uncertainties[i] ?? 0,
            rounded: roundedArr[i] ?? `${values[i]} +/- ${uncertainties[i]}`,
            latex: latexArr[i] ?? name,
        })),
        goodnessOfFit: {
            chiSquaredReduced: fit.reduced_chi_squared ?? null,
            rSquared: fit.r_squared ?? null,
            pValue: fit.p_value ?? null,
            dof: fit.dof ?? null,
        },
        xData: fit.x_data ?? [],
        yData: fit.y_data ?? [],
        xErrors: fit.x_errors ?? null,
        yErrors: fit.y_errors ?? null,
        xFit: fit.x_fit ?? [],
        yFit: fit.y_fit ?? [],
        residuals: fit.residuals ?? [],
    };

    const result: Record<string, unknown> = { ...raw, fit: normalizedFit };

    // Normalize formula if present
    const formula = state?.formula;
    if (formula && formula.expression !== undefined) {
        result.formula = {
            expression: formula.expression,
            value: formula.value ?? formula.result,
            uncertainty: formula.uncertainty,
            formatted: formula.formatted ?? `${formula.value} +/- ${formula.uncertainty}`,
            latex: formula.latex ?? formula.expression,
        };
    }

    // Normalize nsigma if present
    const nsigma = state?.nsigma;
    if (nsigma) {
        result.nsigma = {
            nSigma: nsigma.n_sigma ?? nsigma.nSigma,
            verdict: nsigma.verdict,
            theoreticalValue: nsigma.theoretical_value ?? nsigma.theoreticalValue,
            theoreticalUncertainty: nsigma.theoretical_uncertainty ?? nsigma.theoreticalUncertainty,
        };
    }

    // Copy summary if present
    if (state?.summary) result.summary = state.summary;

    return result;
}

// UI section titles are always English — language setting only affects generated report content
const SECTION_ORDER = [
    { key: 'theory', label: '1. Theoretical Background' },
    { key: 'method', label: '2. Measurement Method' },
    { key: 'results', label: '3. Results' },
    { key: 'discussion', label: '4. Discussion' },
    { key: 'conclusions', label: '5. Conclusions' },
];

type GenerationPhase = 'idle' | 'analyzing' | 'follow-up' | 'generating' | 'complete' | 'error';

function ReportBeta() {
    const [instructionText, setInstructionText] = useState('');
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [uploadWarning, setUploadWarning] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const followUpRef = useRef<HTMLDivElement>(null);

    const { autolabResults, setAutolabResults, plotImages, setPlotImages } = useAnalysis();

    const [contextForm, setContextForm] = useState<ContextForm>({
        title: '', subject: '', equipment: '', notes: ''
    });
    const [language, setLanguage] = useState<'he' | 'en'>('he');

    // Generation flow states
    const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle');
    const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [generatedSections, setGeneratedSections] = useState<GeneratedSections | null>(null);
    const [generationError, setGenerationError] = useState<string | null>(null);

    const [contextFormTouched, setContextFormTouched] = useState(false);

    // Track focus state for input border color
    const [focusedField, setFocusedField] = useState<string | null>(null);
    // Track hover state for generate button
    const [generateHovered, setGenerateHovered] = useState(false);

    // Title page data
    const [titlePageData, setTitlePageData] = useState<TitlePageData>({
        studentName: '', studentId: '', labPartner: '', labPartnerId: '', courseName: '',
        experimentTitle: '', date: new Date().toISOString().split('T')[0],
    });

    // Section editing state: track which sections have been user-edited (badge clearing per D-03)
    const [editedSections, setEditedSections] = useState<Set<string>>(new Set());

    // Editable section content (initialized from generatedSections, user edits update this)
    const [editableSections, setEditableSections] = useState<Record<string, string>>({});

    // Template selection (per D-05)
    const [selectedTemplate, setSelectedTemplate] = useState<'israeli' | 'minimal' | 'academic'>('israeli');

    // Export state
    const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'error'>('idle');
    const [exportError, setExportError] = useState<string | null>(null);

    // === Embedded AutoLab analysis state ===
    const [dataFile, setDataFile] = useState<File | null>(null);
    const [dataPreview, setDataPreview] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);
    const [analysisInstructions, setAnalysisInstructions] = useState('');
    const [theoVal, setTheoVal] = useState('');
    const [theoUnc, setTheoUnc] = useState('');
    const [analysisRunning, setAnalysisRunning] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [analysisState, setAnalysisState] = useState<Record<string, unknown> | null>(null);
    const [fitData, setFitData] = useState<Record<string, unknown> | null>(null);
    const dataFileRef = useRef<HTMLInputElement>(null);
    const fitPlotRef = useRef<HTMLDivElement>(null);
    const residualsPlotRef = useRef<HTMLDivElement>(null);

    // Plot capture: attempt to grab Plotly charts from DOM when autolab results arrive
    useEffect(() => {
        const capturePlots = async () => {
            try {
                const plotDivs = document.querySelectorAll('.js-plotly-plot');
                if (plotDivs.length >= 1) {
                    const fitImg = await Plotly.toImage(plotDivs[0] as HTMLElement, { format: 'png', width: 700, height: 400, scale: 2 });
                    const residualsImg = plotDivs.length >= 2
                        ? await Plotly.toImage(plotDivs[1] as HTMLElement, { format: 'png', width: 700, height: 300, scale: 2 })
                        : null;
                    setPlotImages({ fit: fitImg, residuals: residualsImg });
                }
            } catch (e) {
                console.warn('Could not capture plot images:', e);
            }
        };
        if (autolabResults && !plotImages.fit) {
            capturePlots();
        }
    }, [autolabResults, plotImages.fit, setPlotImages]);

    // Auto-focus first follow-up question input when questions appear
    useEffect(() => {
        if (generationPhase === 'follow-up' && followUpRef.current) {
            const firstInput = followUpRef.current.querySelector('input');
            if (firstInput) firstInput.focus();
        }
    }, [generationPhase]);

    // Initialize editableSections when generatedSections arrives
    useEffect(() => {
        if (generatedSections) {
            setEditableSections({
                theory: generatedSections.theory,
                method: generatedSections.method,
                discussion: generatedSections.discussion,
                conclusions: generatedSections.conclusions,
            });
            setEditedSections(new Set()); // Reset badges on new generation
        }
    }, [generatedSections]);

    // Determine entry mode: from AutoLab (data pre-loaded) vs standalone (no data)
    const hasAnyAnalysis = !!autolabResults || !!analysisState;

    // Pre-fill context form when arriving from AutoLab (per D-02)
    useEffect(() => {
        if (autolabResults && !contextFormTouched) {
            const instructions = (autolabResults as Record<string, any>)?.instructions || '';
            const filename = (autolabResults as Record<string, any>)?.filename || '';
            const derivedTitle = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
            setContextForm(prev => ({
                ...prev,
                title: prev.title || derivedTitle,
                notes: prev.notes || instructions,
            }));
        }
    }, [autolabResults, contextFormTouched]);

    // Detect partial analysis for warning banners (per D-07)
    const getPartialAnalysisWarnings = (): string[] => {
        const data = autolabResults || analysisState;
        if (!data) return [];
        const state = (data as Record<string, any>)?.state ?? data;
        const warnings: string[] = [];
        if (!state?.fit) warnings.push('Fit analysis incomplete \u2014 parameter table and fit plots will not appear in the report.');
        if (!state?.nsigma) warnings.push('N-sigma comparison not available \u2014 this section will be skipped in the report.');
        return warnings;
    };

    const updateContextField = (field: keyof ContextForm, value: string) => {
        setContextForm(prev => ({ ...prev, [field]: value }));
        setContextFormTouched(true);
    };

    const handleSectionChange = (key: string, newContent: string) => {
        setEditableSections(prev => ({ ...prev, [key]: newContent }));
        setEditedSections(prev => new Set(prev).add(key));
    };

    const doGenerate = async (answersList: { id: string; answer: string }[]) => {
        setGenerationPhase('generating');
        setGenerationError(null);

        const rawData = autolabResults ? (autolabResults as Record<string, unknown>) : {};
        const analysisData = normalizeAnalysisData(rawData);
        const payload = {
            context_form: contextForm,
            instruction_text: instructionText,
            analysis_data: analysisData,
            answers: answersList,
            language: language,
        };

        // First attempt
        try {
            const result = await generateReport(payload);
            if (result.error) throw new Error(result.error);
            setGeneratedSections(result.sections);
            setGenerationPhase('complete');
            return;
        } catch (_firstErr) {
            // Silent retry once (per D-08)
            try {
                const result = await generateReport(payload);
                if (result.error) throw new Error(result.error);
                setGeneratedSections(result.sections);
                setGenerationPhase('complete');
            } catch (retryErr: unknown) {
                const message = retryErr instanceof Error
                    ? retryErr.message
                    : 'Report generation failed. Please try again.';
                setGenerationError(message);
                setGenerationPhase('error');
            }
        }
    };

    const handleGenerate = async () => {
        setGenerationError(null);
        setGenerationPhase('analyzing');
        try {
            const rawData = autolabResults ? (autolabResults as Record<string, unknown>) : {};
            const analysisData = normalizeAnalysisData(rawData);
            const result = await analyzeReportContext({
                context_form: contextForm,
                instruction_text: instructionText,
                analysis_data: analysisData,
            });
            if (result.error) {
                setGenerationError(result.error);
                setGenerationPhase('error');
                return;
            }
            if (result.questions.length > 0) {
                setFollowUpQuestions(result.questions);
                setAnswers({});
                setGenerationPhase('follow-up');
            } else {
                await doGenerate([]);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to connect. Check your internet connection and try again.';
            setGenerationError(message);
            setGenerationPhase('error');
        }
    };

    const handleGenerateWithAnswers = () => {
        const answersList = followUpQuestions.map(q => ({
            id: q.id,
            answer: answers[q.id] || '',
        }));
        doGenerate(answersList);
    };

    const handleGenerateAnyway = () => {
        doGenerate([]);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadStatus('uploading');
        setUploadWarning(null);
        try {
            const result = await uploadInstructionFile(file);
            if (result.error) {
                setUploadStatus('error');
                setUploadWarning(result.error);
            } else {
                setInstructionText(result.text);
                setUploadStatus('done');
                if (result.warning) setUploadWarning(result.warning);
            }
        } catch {
            setUploadStatus('error');
            setUploadWarning('Failed to upload file. Make sure the backend is running.');
        }
    };

    const handleExportPdf = async () => {
        setExportStatus('exporting');
        setExportError(null);
        try {
            const rawData = autolabResults ? (autolabResults as Record<string, unknown>) : {};
            const analysisData = normalizeAnalysisData(rawData);

            const blob = await exportReportPdf({
                sections: editableSections,
                title_page: {
                    studentName: titlePageData.studentName,
                    studentId: titlePageData.studentId,
                    labPartner: titlePageData.labPartner,
                    labPartnerId: titlePageData.labPartnerId,
                    courseName: titlePageData.courseName,
                    experimentTitle: titlePageData.experimentTitle,
                    date: titlePageData.date,
                },
                plots: {
                    fit: plotImages.fit,
                    residuals: plotImages.residuals,
                },
                template: selectedTemplate,
                language: language,
                analysis_data: analysisData,
            });

            // Trigger browser download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'lab-report.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setExportStatus('idle');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'PDF generation failed. Check that all required fields are filled and try again.';
            setExportError(msg);
            setExportStatus('error');
        }
    };

    // === Embedded analysis handlers ===
    const handleDataFileChange = async (f: File) => {
        setDataFile(f);
        setDataPreview(null);
        setAnalysisError(null);
        try {
            const data = await parseFileData(f);
            if (Array.isArray(data?.columns) && data.columns.length > 0 && Array.isArray(data?.rows)) {
                setDataPreview({ columns: data.columns.map(String), rows: data.rows });
            }
        } catch {
            // Preview failed but analysis may still work
        }
    };

    const handleRunAnalysis = async () => {
        if (!dataFile || !analysisInstructions.trim()) return;
        setAnalysisRunning(true);
        setAnalysisError(null);
        setAnalysisState(null);
        setFitData(null);

        try {
            const formData = new FormData();
            formData.append('file', dataFile);
            formData.append('instructions', analysisInstructions);
            if (theoVal) formData.append('theoretical_value', theoVal);
            if (theoUnc) formData.append('theoretical_uncertainty', theoUnc);

            const resp = await fetch('/api/autolab/run', { method: 'POST', body: formData });
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Server error ${resp.status}`);
            }
            const data = await resp.json();

            if (data.error && !data.steps?.length) {
                setAnalysisError(data.error);
            } else {
                setFitData(data.fit_data || null);
                setAnalysisState(data.state || null);
                // Store in shared context for report generation
                if (data.state) {
                    setAutolabResults({
                        state: data.state,
                        fit: data.state.fit ? {
                            model_name: data.state.fit.model_name,
                            parameter_names: data.state.fit.parameter_names,
                            parameters: data.state.fit.parameters,
                            uncertainties: data.state.fit.uncertainties,
                            reduced_chi_squared: data.state.fit.reduced_chi_squared,
                            p_value: data.state.fit.p_value,
                            r_squared: data.state.fit.r_squared,
                        } : undefined,
                        formula: data.state.formula,
                        nsigma: data.state.nsigma,
                        instructions: analysisInstructions,
                        filename: dataFile?.name,
                    });
                }
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Analysis failed';
            setAnalysisError(msg);
        } finally {
            setAnalysisRunning(false);
        }
    };

    // Capture plots from embedded Plotly charts for PDF export
    const capturePlotsFromRefs = useCallback(async () => {
        try {
            if (fitPlotRef.current) {
                const plotEl = fitPlotRef.current.querySelector('.js-plotly-plot') as HTMLElement | null;
                if (plotEl) {
                    const fitImg = await Plotly.toImage(plotEl, { format: 'png', width: 700, height: 400, scale: 2 });
                    const residualsEl = residualsPlotRef.current?.querySelector('.js-plotly-plot') as HTMLElement | null;
                    const residualsImg = residualsEl
                        ? await Plotly.toImage(residualsEl, { format: 'png', width: 700, height: 300, scale: 2 })
                        : null;
                    setPlotImages({ fit: fitImg, residuals: residualsImg });
                }
            }
        } catch (e) {
            console.warn('Could not capture inline plot images:', e);
        }
    }, [setPlotImages]);

    // Capture plots after analysis completes and charts render
    useEffect(() => {
        if (fitData && !plotImages.fit) {
            const timer = setTimeout(capturePlotsFromRefs, 500);
            return () => clearTimeout(timer);
        }
    }, [fitData, plotImages.fit, capturePlotsFromRefs]);

    const inputStyle = (fieldName: string): React.CSSProperties => ({
        border: `1.5px solid ${focusedField === fieldName ? 'var(--primary, #1565c0)' : 'var(--border, #e0e0e0)'}`,
        borderRadius: '8px',
        padding: '16px',
        background: 'var(--surface, #ffffff)',
        fontSize: '0.875rem',
        width: '100%',
        boxSizing: 'border-box' as const,
        fontFamily: 'inherit',
    });

    const hasAnyContext = instructionText.trim() !== '' ||
        contextForm.title.trim() !== '' ||
        contextForm.subject.trim() !== '' ||
        contextForm.equipment.trim() !== '' ||
        contextForm.notes.trim() !== '';

    // Extract normalized fit data for Results section parameter table
    const getNormalizedFit = (): { parameters: Array<{ name: string; rounded: string }>; modelName: string } | null => {
        if (!autolabResults) return null;
        const normalized = normalizeAnalysisData(autolabResults as Record<string, unknown>);
        const fit = (normalized as Record<string, any>).fit;
        if (!fit || !fit.parameters) return null;
        return { parameters: fit.parameters, modelName: fit.modelName ?? 'unknown' };
    };

    return (
        <div style={{ maxWidth: 700, margin: '2rem auto', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <h1 style={{ margin: 0 }}>Lab Report Export</h1>
            </div>

            {/* ============ Embedded Data Analysis Section ============ */}
            {!hasAnyAnalysis && (
            <div style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--border, #e0e0e0)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '32px',
            }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text, #1a1a2e)' }}>
                    Start with your data
                </h2>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                    Upload your experiment data file and provide instructions to run an analysis, or navigate here from AutoLab after completing an analysis.
                </p>

                {/* Data file upload */}
                <input
                    ref={dataFileRef}
                    type="file"
                    accept=".csv,.tsv,.xlsx,.xls,.ods,.dat"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDataFileChange(f); }}
                    style={{ display: 'none' }}
                />
                <div
                    onClick={() => { if (!analysisRunning) dataFileRef.current?.click(); }}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={e => {
                        e.preventDefault();
                        const f = e.dataTransfer.files[0];
                        if (f) handleDataFileChange(f);
                    }}
                    style={{
                        border: `2px dashed ${dataFile ? '#2e7d32' : '#1565c0'}`,
                        borderRadius: '10px',
                        padding: '1rem',
                        textAlign: 'center',
                        cursor: analysisRunning ? 'not-allowed' : 'pointer',
                        background: dataFile ? '#e8f5e9' : '#e3f2fd',
                        marginBottom: '16px',
                    }}
                >
                    {dataFile ? (
                        <span style={{ fontWeight: 600, color: '#2e7d32' }}>{dataFile.name} -- click to replace</span>
                    ) : (
                        <span style={{ color: '#1565c0' }}>
                            Click or drag & drop your data file<br />
                            <small>.csv, .xlsx, .xls, .ods, .tsv, .dat</small>
                        </span>
                    )}
                </div>

                {/* Data preview */}
                {dataPreview && (
                    <div style={{ marginBottom: '16px', maxHeight: '150px', overflow: 'auto', border: '1px solid var(--border, #e0e0e0)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                                <tr>
                                    {dataPreview.columns.map(col => (
                                        <th key={col} style={{ border: '1px solid var(--border, #e0e0e0)', padding: '4px 8px', background: 'var(--surface-alt, #f4f5f9)', position: 'sticky', top: 0 }}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {dataPreview.rows.slice(0, 5).map((row, i) => (
                                    <tr key={i}>
                                        {dataPreview.columns.map(col => (
                                            <td key={col} style={{ border: '1px solid var(--border, #e0e0e0)', padding: '4px 8px' }}>{String(row[col] ?? '')}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Analysis instructions */}
                <textarea
                    value={analysisInstructions}
                    onChange={(e) => setAnalysisInstructions(e.target.value)}
                    placeholder='Describe the analysis: which columns to use, fit model, formulas to calculate... e.g., "Column A is x, Column B is y, Column C is y error. Fit linear. Calculate slope."'
                    rows={3}
                    style={{
                        ...inputStyle('analysisInstructions'),
                        resize: 'vertical' as const,
                        marginBottom: '12px',
                    }}
                    onFocus={() => setFocusedField('analysisInstructions')}
                    onBlur={() => setFocusedField(null)}
                />

                {/* Theoretical value (optional) */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #666)', display: 'block', marginBottom: '4px' }}>
                            Theoretical value (optional)
                        </label>
                        <input
                            type="text"
                            value={theoVal}
                            onChange={(e) => setTheoVal(e.target.value)}
                            placeholder="e.g., 9.81"
                            style={{ ...inputStyle('theoVal'), padding: '10px 16px' }}
                            onFocus={() => setFocusedField('theoVal')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #666)', display: 'block', marginBottom: '4px' }}>
                            Theoretical uncertainty (optional)
                        </label>
                        <input
                            type="text"
                            value={theoUnc}
                            onChange={(e) => setTheoUnc(e.target.value)}
                            placeholder="e.g., 0.01"
                            style={{ ...inputStyle('theoUnc'), padding: '10px 16px' }}
                            onFocus={() => setFocusedField('theoUnc')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </div>
                </div>

                {/* Run Analysis button */}
                <button
                    onClick={handleRunAnalysis}
                    disabled={!dataFile || !analysisInstructions.trim() || analysisRunning}
                    style={{
                        width: '100%',
                        background: (!dataFile || !analysisInstructions.trim() || analysisRunning) ? '#bbb' : 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
                        color: 'white',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        padding: '12px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: (!dataFile || !analysisInstructions.trim() || analysisRunning) ? 'not-allowed' : 'pointer',
                    }}
                >
                    {analysisRunning ? 'Running Analysis...' : analysisState ? 'Re-run Analysis' : 'Run Analysis'}
                </button>

                {analysisError && (
                    <p style={{ color: 'var(--danger, #d32f2f)', fontSize: '0.875rem', margin: '8px 0 0 0' }}>{analysisError}</p>
                )}

                {/* Inline analysis results: plots + parameter summary */}
                {fitData && analysisState && (
                    <div style={{ marginTop: '24px', borderTop: '1px solid var(--border, #e0e0e0)', paddingTop: '16px' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 600, color: 'var(--text, #1a1a2e)' }}>
                            Analysis Results
                        </h3>

                        {/* Fit plot */}
                        <div ref={fitPlotRef}>
                            {!!(fitData as any).x_fit && (
                                <Plot
                                    data={[
                                        {
                                            x: (fitData as any).x_data,
                                            y: (fitData as any).y_data,
                                            error_y: (fitData as any).y_errors ? { type: 'data', array: (fitData as any).y_errors, visible: true } : undefined,
                                            error_x: (fitData as any).x_errors ? { type: 'data', array: (fitData as any).x_errors, visible: true } : undefined,
                                            mode: 'markers',
                                            type: 'scatter',
                                            name: 'Data',
                                            marker: { color: '#1565c0', size: 6 },
                                        },
                                        {
                                            x: (fitData as any).x_fit,
                                            y: (fitData as any).y_fit,
                                            mode: 'lines',
                                            type: 'scatter',
                                            name: `Fit (${(fitData as any).model_name || 'model'})`,
                                            line: { color: '#e53935', width: 2 },
                                        },
                                    ]}
                                    layout={{
                                        height: 320,
                                        margin: { t: 30, b: 40, l: 50, r: 20 },
                                        showlegend: true,
                                        legend: { x: 0.02, y: 0.98 },
                                    }}
                                    config={{ responsive: true, displayModeBar: false }}
                                    style={{ width: '100%' }}
                                />
                            )}
                        </div>

                        {/* Residuals plot */}
                        <div ref={residualsPlotRef}>
                            {(fitData as any).residuals && (
                                <Plot
                                    data={[
                                        {
                                            x: (fitData as any).x_data,
                                            y: (fitData as any).residuals,
                                            error_y: (fitData as any).y_errors ? { type: 'data', array: (fitData as any).y_errors, visible: true } : undefined,
                                            mode: 'markers',
                                            type: 'scatter',
                                            name: 'Residuals',
                                            marker: { color: '#1565c0', size: 5 },
                                        },
                                    ]}
                                    layout={{
                                        height: 200,
                                        margin: { t: 20, b: 40, l: 50, r: 20 },
                                        showlegend: false,
                                        shapes: [{ type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 0, y1: 0, line: { color: '#999', dash: 'dash' } }],
                                    }}
                                    config={{ responsive: true, displayModeBar: false }}
                                    style={{ width: '100%' }}
                                />
                            )}
                        </div>

                        {/* Quick parameter table */}
                        {(() => {
                            const state = analysisState as Record<string, any>;
                            const fit = state?.fit;
                            if (!fit?.parameter_names) return null;
                            return (
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ border: '1px solid var(--border, #e0e0e0)', padding: '6px 10px', textAlign: 'left', background: 'var(--surface-alt, #f4f5f9)' }}>Parameter</th>
                                            <th style={{ border: '1px solid var(--border, #e0e0e0)', padding: '6px 10px', textAlign: 'left', background: 'var(--surface-alt, #f4f5f9)' }}>Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fit.parameter_names.map((name: string, i: number) => {
                                            const val = fit.parameters?.[i];
                                            const unc = fit.uncertainties?.[i];
                                            const { rounded } = roundWithUncertainty(val, unc);
                                            return (
                                                <tr key={i}>
                                                    <td style={{ border: '1px solid var(--border, #e0e0e0)', padding: '6px 10px' }}>{name}</td>
                                                    <td style={{ border: '1px solid var(--border, #e0e0e0)', padding: '6px 10px' }}>{rounded}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            );
                        })()}

                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9e9e9e)', marginTop: '8px' }}>
                            These results will be included in your generated report.
                        </p>
                    </div>
                )}
            </div>
            )}

            {/* Analysis data loaded confirmation (AutoLab flow) */}
            {hasAnyAnalysis && (
                <div style={{
                    background: '#e8f5e9',
                    border: '1px solid #a5d6a7',
                    borderRadius: '12px',
                    padding: '16px 24px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <span style={{ fontSize: '1.2rem' }}>&#x2705;</span>
                    <span style={{ fontWeight: 600, color: '#2e7d32', fontSize: '0.875rem' }}>
                        Analysis data loaded
                    </span>
                </div>
            )}

            {/* Partial analysis warning banners */}
            {hasAnyAnalysis && getPartialAnalysisWarnings().map((warning, i) => (
                <div key={i} style={{
                    background: 'var(--warning-bg, #fff3e0)',
                    border: '1px solid var(--warning-border, #ffcc80)',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: '0.875rem',
                    color: 'var(--text, #333)',
                }}>
                    <span>&#x26A0;&#xFE0F;</span>
                    <span>{warning}</span>
                </div>
            ))}

            {/* Lab Instructions Upload Section */}
            <div style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--border, #e0e0e0)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '32px',
            }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text, #1a1a2e)' }}>
                    Lab Instructions
                </h2>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                    Upload a lab instruction file (PDF or Word), or type/paste the instructions directly
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                />
                <div
                    onClick={() => { if (uploadStatus !== 'uploading') fileInputRef.current?.click(); }}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={e => {
                        e.preventDefault();
                        const f = e.dataTransfer.files[0];
                        if (f) {
                            const syntheticEvent = { target: { files: [f] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                            handleFileUpload(syntheticEvent);
                        }
                    }}
                    style={{
                        border: '2px dashed #1565c0',
                        borderRadius: '10px',
                        padding: '1.5rem',
                        textAlign: 'center' as const,
                        cursor: uploadStatus === 'uploading' ? 'not-allowed' : 'pointer',
                        background: uploadStatus === 'done' ? '#e8f5e9' : '#e3f2fd',
                        transition: 'all 0.2s',
                    }}
                >
                    {uploadStatus === 'uploading' ? (
                        <span style={{ color: '#1565c0' }}>Uploading...</span>
                    ) : uploadStatus === 'done' ? (
                        <span style={{ fontWeight: 600, color: '#2e7d32' }}>File uploaded — click or drag to replace</span>
                    ) : (
                        <span style={{ color: '#1565c0' }}>
                            Click or drag & drop your instruction file<br />
                            <small>.pdf, .doc, .docx</small>
                        </span>
                    )}
                </div>
                {uploadWarning && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.875rem', color: uploadStatus === 'error' ? 'var(--danger, #d32f2f)' : 'var(--warning, #f57c00)' }}>
                        {uploadWarning}
                    </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 8px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border, #e0e0e0)' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #666)', fontWeight: 500 }}>or type instructions below</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border, #e0e0e0)' }} />
                </div>
                <textarea
                    value={instructionText}
                    onChange={(e) => setInstructionText(e.target.value)}
                    placeholder="Paste or type your lab instructions here..."
                    rows={6}
                    style={{
                        ...inputStyle('instructionText'),
                        resize: 'vertical' as const,
                    }}
                    onFocus={() => setFocusedField('instructionText')}
                    onBlur={() => setFocusedField(null)}
                />
            </div>

            {/* Experiment Context Form */}
            <div style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--border, #e0e0e0)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '32px',
            }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text, #1a1a2e)' }}>
                    Experiment Context
                </h2>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                    Provide details to help AI generate your report
                </p>

                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
                    {/* Experiment Title */}
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text, #1a1a2e)', marginBottom: '4px', display: 'block' }}>
                            Experiment Title
                        </label>
                        <input
                            type="text"
                            value={contextForm.title}
                            onChange={(e) => updateContextField('title', e.target.value)}
                            placeholder="e.g., Hooke's Law -- Measuring Spring Constant"
                            style={inputStyle('title')}
                            onFocus={() => setFocusedField('title')}
                            onBlur={() => setFocusedField(null)}
                        />
                        {autolabResults && !contextFormTouched && contextForm.title && (
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted, #999)' }}>
                                Pre-filled from AutoLab analysis
                            </p>
                        )}
                    </div>

                    {/* Subject Area */}
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text, #1a1a2e)', marginBottom: '4px', display: 'block' }}>
                            Subject Area
                        </label>
                        <input
                            type="text"
                            value={contextForm.subject}
                            onChange={(e) => updateContextField('subject', e.target.value)}
                            placeholder="e.g., Mechanics, Optics, Thermodynamics"
                            style={inputStyle('subject')}
                            onFocus={() => setFocusedField('subject')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </div>

                    {/* Equipment Used */}
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text, #1a1a2e)', marginBottom: '4px', display: 'block' }}>
                            Equipment Used
                        </label>
                        <textarea
                            rows={3}
                            value={contextForm.equipment}
                            onChange={(e) => updateContextField('equipment', e.target.value)}
                            placeholder="e.g., Spring, masses (50-500g), ruler, force sensor"
                            style={{
                                ...inputStyle('equipment'),
                                resize: 'vertical' as const,
                            }}
                            onFocus={() => setFocusedField('equipment')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </div>

                    {/* Additional Notes */}
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text, #1a1a2e)', marginBottom: '4px', display: 'block' }}>
                            Additional Notes
                        </label>
                        <textarea
                            rows={4}
                            value={contextForm.notes}
                            onChange={(e) => updateContextField('notes', e.target.value)}
                            placeholder="Any specific requirements, formulas to include, or details about your experiment..."
                            style={{
                                ...inputStyle('notes'),
                                resize: 'vertical' as const,
                            }}
                            onFocus={() => setFocusedField('notes')}
                            onBlur={() => setFocusedField(null)}
                        />
                        {autolabResults && !contextFormTouched && contextForm.notes && (
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted, #999)' }}>
                                Pre-filled from AutoLab analysis
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Language Toggle */}
            <div style={{ marginBottom: '16px' }}>
                <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                    <legend style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text, #1a1a2e)', marginBottom: '8px', display: 'block', padding: 0 }}>
                        Report Language
                    </legend>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <label style={{
                            background: language === 'he' ? 'var(--primary, #1565c0)' : 'var(--surface-alt, #f4f5f9)',
                            color: language === 'he' ? 'white' : 'var(--text, #1a1a2e)',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            cursor: 'pointer',
                            border: 'none',
                            fontWeight: language === 'he' ? 500 : 400,
                            fontSize: '0.875rem',
                        }}>
                            <input
                                type="radio"
                                name="report-language"
                                value="he"
                                checked={language === 'he'}
                                onChange={() => setLanguage('he')}
                                style={{ display: 'none' }}
                            />
                            Hebrew
                        </label>
                        <label style={{
                            background: language === 'en' ? 'var(--primary, #1565c0)' : 'var(--surface-alt, #f4f5f9)',
                            color: language === 'en' ? 'white' : 'var(--text, #1a1a2e)',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            cursor: 'pointer',
                            border: 'none',
                            fontWeight: language === 'en' ? 500 : 400,
                            fontSize: '0.875rem',
                        }}>
                            <input
                                type="radio"
                                name="report-language"
                                value="en"
                                checked={language === 'en'}
                                onChange={() => setLanguage('en')}
                                style={{ display: 'none' }}
                            />
                            English
                        </label>
                    </div>
                </fieldset>
            </div>

            {/* Generate Report Button -- Focal Point */}
            {(generationPhase === 'idle' || generationPhase === 'error' || generationPhase === 'complete' || generationPhase === 'analyzing') && (
                <button
                    onClick={handleGenerate}
                    disabled={!hasAnyContext || generationPhase === 'analyzing'}
                    onMouseEnter={() => setGenerateHovered(true)}
                    onMouseLeave={() => setGenerateHovered(false)}
                    style={{
                        width: '100%',
                        background: (!hasAnyContext || generationPhase === 'analyzing') ? '#bbb' : 'linear-gradient(135deg, var(--primary, #1565c0) 0%, #1976d2 100%)',
                        color: 'white',
                        fontSize: '1rem',
                        fontWeight: 600,
                        padding: '16px 32px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: (!hasAnyContext || generationPhase === 'analyzing') ? 'not-allowed' : 'pointer',
                        boxShadow: (!hasAnyContext || generationPhase === 'analyzing') ? 'none' : generateHovered ? '0 4px 12px rgba(21, 101, 192, 0.4)' : '0 2px 8px rgba(21, 101, 192, 0.3)',
                        marginBottom: '32px',
                    }}
                >
                    {generationPhase === 'analyzing' ? 'Analyzing...' : generationPhase === 'complete' ? 'Regenerate Report' : 'Generate Report'}
                </button>
            )}

            {/* Error State */}
            {generationError && (
                <div aria-live="polite" style={{ marginBottom: '16px' }}>
                    <p style={{ color: 'var(--danger, #d32f2f)', fontSize: '0.875rem', margin: '0 0 4px 0' }}>
                        {generationError}
                    </p>
                    <button
                        onClick={() => { setGenerationPhase('idle'); setGenerationError(null); }}
                        style={{ background: 'none', border: 'none', color: 'var(--primary, #1565c0)', fontSize: '0.875rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Follow-Up Questions Card */}
            {generationPhase === 'follow-up' && (
                <div ref={followUpRef} style={{
                    border: '1.5px solid var(--primary, #1565c0)',
                    borderRadius: '12px',
                    padding: '24px',
                    background: 'var(--info-bg, #e3f2fd)',
                    marginBottom: '32px',
                }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary, #1565c0)' }}>
                        Before we generate...
                    </h3>
                    <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                        A few questions to improve your report:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
                        {followUpQuestions.map(q => (
                            <div key={q.id}>
                                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text, #1a1a2e)', display: 'block', marginBottom: '4px' }}>
                                    {q.question}
                                </label>
                                {q.hint && (
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted, #999)', fontStyle: 'italic', display: 'block', marginBottom: '4px' }}>
                                        {q.hint}
                                    </span>
                                )}
                                <input
                                    type="text"
                                    value={answers[q.id] || ''}
                                    onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                    style={{
                                        border: '1.5px solid var(--border, #e0e0e0)',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        background: 'var(--surface, #ffffff)',
                                        fontSize: '0.875rem',
                                        width: '100%',
                                        boxSizing: 'border-box' as const,
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        <button
                            onClick={handleGenerateWithAnswers}
                            style={{
                                background: 'linear-gradient(135deg, var(--primary, #1565c0) 0%, #1976d2 100%)',
                                color: 'white',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                padding: '8px 24px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            Generate Report
                        </button>
                        <button
                            onClick={handleGenerateAnyway}
                            style={{
                                background: 'transparent',
                                border: '1.5px solid var(--border, #e0e0e0)',
                                color: 'var(--text-secondary, #666)',
                                fontSize: '0.875rem',
                                padding: '8px 24px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                            }}
                        >
                            Generate Anyway
                        </button>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {generationPhase === 'generating' && (
                <div style={{ textAlign: 'center', padding: '32px 0', marginBottom: '32px' }} aria-live="polite" role="status">
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <div style={{
                        width: '24px', height: '24px',
                        border: '3px solid var(--border, #e0e0e0)',
                        borderTopColor: 'var(--primary, #1565c0)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px',
                    }} />
                    <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                        Generating your report...
                    </p>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted, #999)' }}>
                        This may take 10-15 seconds
                    </p>
                </div>
            )}

            {/* Generation Complete State */}
            {generationPhase === 'complete' && generatedSections && (
                <>
                    {/* Warnings only (no big banner) */}
                    {generatedSections.warnings && generatedSections.warnings.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            {generatedSections.warnings.map((w, i) => (
                                <p key={i} style={{ margin: '4px 0', fontSize: '0.875rem', color: 'var(--warning, #f57c00)' }}>
                                    &#x26A0; {w}
                                </p>
                            ))}
                        </div>
                    )}

                    {/* Title Page Form */}
                    <TitlePageForm
                        data={titlePageData}
                        onChange={setTitlePageData}
                        language={language}
                        experimentTitleFromContext={contextForm.title}
                    />

                    {/* Section Accordions */}
                    {SECTION_ORDER.map(({ key, label }) => {
                        if (key === 'results') {
                            // Results section is data-driven, not AI-generated
                            const fitData = getNormalizedFit();
                            return (
                                <div
                                    key={key}
                                    style={{
                                        border: '1px solid var(--border, #e0e0e0)',
                                        borderRadius: '12px',
                                        marginBottom: '16px',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <details>
                                        <summary
                                            style={{
                                                background: 'var(--surface-alt, #f4f5f9)',
                                                padding: '16px 24px',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                fontSize: '1rem',
                                                color: 'var(--text, #1a1a2e)',
                                                listStyle: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                            }}
                                        >
                                            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>&#x25B6;</span>
                                            {label}
                                        </summary>
                                        <div style={{ padding: '16px 24px' }}>
                                            <PlotThumbnail
                                                imageBase64={plotImages.fit}
                                                caption="Figure 1: Fit Plot"
                                                missingText="No plot available -- run analysis first"
                                            />
                                            <PlotThumbnail
                                                imageBase64={plotImages.residuals}
                                                caption="Figure 2: Residuals"
                                                missingText="No plot available -- run analysis first"
                                            />
                                            {fitData ? (
                                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={{ border: '1px solid var(--border, #e0e0e0)', padding: '8px', fontWeight: 700, textAlign: 'left' }}>
                                                                Parameter
                                                            </th>
                                                            <th style={{ border: '1px solid var(--border, #e0e0e0)', padding: '8px', fontWeight: 700, textAlign: 'left' }}>
                                                                Value
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {fitData.parameters.map((p: { name: string; rounded: string }, idx: number) => (
                                                            <tr key={idx}>
                                                                <td style={{ border: '1px solid var(--border, #e0e0e0)', padding: '8px' }}>{p.name}</td>
                                                                <td style={{ border: '1px solid var(--border, #e0e0e0)', padding: '8px' }}>{p.rounded}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <p style={{ color: 'var(--text-muted, #9e9e9e)', fontSize: '0.875rem', textAlign: 'center' }}>
                                                    No analysis data available
                                                </p>
                                            )}
                                        </div>
                                    </details>
                                </div>
                            );
                        }

                        return (
                            <SectionAccordion
                                key={key}
                                sectionKey={key}
                                title={label}
                                content={editableSections[key] ?? ''}
                                isAiGenerated={!editedSections.has(key)}
                                onContentChange={(c) => handleSectionChange(key, c)}
                                language={language}
                            />
                        );
                    })}

                    {/* Template Selector + Export PDF Button */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ fontSize: '0.875rem', color: 'var(--text, #1a1a2e)' }}>
                                Template
                            </label>
                            <select
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value as 'israeli' | 'minimal' | 'academic')}
                                style={{
                                    border: '1.5px solid var(--border, #e0e0e0)',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    background: 'var(--surface, #ffffff)',
                                    fontSize: '0.875rem',
                                    fontFamily: 'inherit',
                                }}
                            >
                                <option value="israeli">Israeli Lab Report</option>
                                <option value="minimal">Minimal Clean</option>
                                <option value="academic">LaTeX-Inspired Academic</option>
                            </select>
                        </div>
                        <button
                            disabled={exportStatus === 'exporting' || !titlePageData.experimentTitle.trim()}
                            onClick={handleExportPdf}
                            style={{
                                flex: 1,
                                background: (exportStatus === 'exporting' || !titlePageData.experimentTitle.trim())
                                    ? '#bbb'
                                    : 'linear-gradient(135deg, var(--primary, #1565c0) 0%, #1976d2 100%)',
                                color: 'white',
                                fontSize: '1rem',
                                fontWeight: 600,
                                padding: '16px 32px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: (exportStatus === 'exporting' || !titlePageData.experimentTitle.trim())
                                    ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {exportStatus === 'exporting' ? 'Generating PDF...' : 'Export as PDF'}
                        </button>
                    </div>

                    {/* Export error display */}
                    {exportError && (
                        <p style={{ color: 'var(--danger, #d32f2f)', fontSize: '0.875rem', marginTop: '8px' }}>
                            {exportError}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

export default ReportBeta;
