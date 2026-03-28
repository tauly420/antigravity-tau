import { useState, useRef, useEffect } from 'react';
import { uploadInstructionFile, analyzeReportContext, generateReport, exportReportPdf, type ContextForm, type FollowUpQuestion, type GeneratedSections } from '../services/api';
// @ts-ignore - plotly.js-dist-min has no types
import Plotly from 'plotly.js-dist-min';
import { useAnalysis } from '../context/AnalysisContext';
import SectionAccordion from './report/SectionAccordion';
import TitlePageForm, { type TitlePageData } from './report/TitlePageForm';
import PlotThumbnail from './report/PlotThumbnail';

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

const SECTION_ORDER = [
    { key: 'theory', en: '1. Theoretical Background', he: '1. \u05E8\u05E7\u05E2 \u05EA\u05D9\u05D0\u05D5\u05E8\u05D8\u05D9' },
    { key: 'method', en: '2. Measurement Method', he: '2. \u05E9\u05D9\u05D8\u05EA \u05DE\u05D3\u05D9\u05D3\u05D4' },
    { key: 'results', en: '3. Results', he: '3. \u05EA\u05D5\u05E6\u05D0\u05D5\u05EA' },
    { key: 'discussion', en: '4. Discussion', he: '4. \u05D3\u05D9\u05D5\u05DF' },
    { key: 'conclusions', en: '5. Conclusions', he: '5. \u05DE\u05E1\u05E7\u05E0\u05D5\u05EA' },
];

type GenerationPhase = 'idle' | 'analyzing' | 'follow-up' | 'generating' | 'complete' | 'error';

function ReportBeta() {
    const [instructionText, setInstructionText] = useState('');
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [uploadWarning, setUploadWarning] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const followUpRef = useRef<HTMLDivElement>(null);

    const { autolabResults, plotImages, setPlotImages } = useAnalysis();

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

    // Track focus state for input border color
    const [focusedField, setFocusedField] = useState<string | null>(null);
    // Track hover state for generate button
    const [generateHovered, setGenerateHovered] = useState(false);

    // Title page data
    const [titlePageData, setTitlePageData] = useState<TitlePageData>({
        studentName: '', studentId: '', labPartner: '', courseName: '',
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

    const handleSectionChange = (key: string, newContent: string) => {
        setEditableSections(prev => ({ ...prev, [key]: newContent }));
        setEditedSections(prev => new Set(prev).add(key));
    };

    const doGenerate = async (answersList: { id: string; answer: string }[]) => {
        setGenerationPhase('generating');
        setGenerationError(null);
        try {
            const rawData = autolabResults ? (autolabResults as Record<string, unknown>) : {};
            const analysisData = normalizeAnalysisData(rawData);
            const result = await generateReport({
                context_form: contextForm,
                instruction_text: instructionText,
                analysis_data: analysisData,
                answers: answersList,
                language: language,
            });
            if (result.error) {
                setGenerationError(result.error);
                setGenerationPhase('error');
                return;
            }
            setGeneratedSections(result.sections);
            setGenerationPhase('complete');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to connect. Check your internet connection and try again.';
            setGenerationError(message);
            setGenerationPhase('error');
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
                <span style={{
                    background: 'linear-gradient(135deg, #1565c0, #7b1fa2)',
                    color: 'white',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}>Beta</span>
            </div>

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
                    placeholder={language === 'he' ? 'הדבק או הקלד את הוראות המעבדה כאן...' : 'Paste or type your lab instructions here...'}
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
                            onChange={(e) => setContextForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g., Hooke's Law -- Measuring Spring Constant"
                            style={inputStyle('title')}
                            onFocus={() => setFocusedField('title')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </div>

                    {/* Subject Area */}
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text, #1a1a2e)', marginBottom: '4px', display: 'block' }}>
                            Subject Area
                        </label>
                        <input
                            type="text"
                            value={contextForm.subject}
                            onChange={(e) => setContextForm(prev => ({ ...prev, subject: e.target.value }))}
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
                            onChange={(e) => setContextForm(prev => ({ ...prev, equipment: e.target.value }))}
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
                            onChange={(e) => setContextForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Any specific requirements, formulas to include, or details about your experiment..."
                            style={{
                                ...inputStyle('notes'),
                                resize: 'vertical' as const,
                            }}
                            onFocus={() => setFocusedField('notes')}
                            onBlur={() => setFocusedField(null)}
                        />
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
                    {/* Brief success confirmation */}
                    <div style={{
                        border: '1px solid var(--success-border, #a5d6a7)',
                        borderRadius: '12px',
                        padding: '24px',
                        background: 'var(--success-bg, #e8f5e9)',
                        marginBottom: '32px',
                    }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--success, #2e7d32)' }}>
                            Report Generated
                        </h3>
                        <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                            Your report sections are ready for review.
                        </p>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                            {(['theory', 'method', 'discussion', 'conclusions'] as const).map(section => (
                                <li key={section} style={{ fontSize: '0.875rem', color: 'var(--text, #1a1a2e)', padding: '4px 0' }}>
                                    &#x2713; {section.charAt(0).toUpperCase() + section.slice(1)}
                                </li>
                            ))}
                        </ul>
                        {generatedSections.warnings && generatedSections.warnings.length > 0 && (
                            <div style={{ marginTop: '16px' }}>
                                {generatedSections.warnings.map((w, i) => (
                                    <p key={i} style={{ margin: '4px 0', fontSize: '0.875rem', color: 'var(--warning, #f57c00)' }}>
                                        &#x26A0; {w}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Title Page Form */}
                    <TitlePageForm
                        data={titlePageData}
                        onChange={setTitlePageData}
                        language={language}
                        experimentTitleFromContext={contextForm.title}
                    />

                    {/* Section Accordions */}
                    {SECTION_ORDER.map(({ key, en, he }) => {
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
                                            {language === 'he' ? he : en}
                                        </summary>
                                        <div style={{ padding: '16px 24px' }}>
                                            <PlotThumbnail
                                                imageBase64={plotImages.fit}
                                                caption={language === 'he' ? '\u05D0\u05D9\u05D5\u05E8 1: \u05D2\u05E8\u05E3 \u05D4\u05EA\u05D0\u05DE\u05D4' : 'Figure 1: Fit Plot'}
                                                missingText={language === 'he' ? '\u05D0\u05D9\u05DF \u05D2\u05E8\u05E3 \u05D6\u05DE\u05D9\u05DF -- \u05D4\u05E8\u05E5 \u05E0\u05D9\u05EA\u05D5\u05D7 AutoLab \u05E7\u05D5\u05D3\u05DD' : 'No plot available -- run AutoLab analysis first'}
                                            />
                                            <PlotThumbnail
                                                imageBase64={plotImages.residuals}
                                                caption={language === 'he' ? '\u05D0\u05D9\u05D5\u05E8 2: \u05E9\u05D0\u05E8\u05D9\u05D5\u05EA' : 'Figure 2: Residuals'}
                                                missingText={language === 'he' ? '\u05D0\u05D9\u05DF \u05D2\u05E8\u05E3 \u05D6\u05DE\u05D9\u05DF -- \u05D4\u05E8\u05E5 \u05E0\u05D9\u05EA\u05D5\u05D7 AutoLab \u05E7\u05D5\u05D3\u05DD' : 'No plot available -- run AutoLab analysis first'}
                                            />
                                            {fitData ? (
                                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={{ border: '1px solid var(--border, #e0e0e0)', padding: '8px', fontWeight: 700, textAlign: 'left' }}>
                                                                {language === 'he' ? '\u05E4\u05E8\u05DE\u05D8\u05E8' : 'Parameter'}
                                                            </th>
                                                            <th style={{ border: '1px solid var(--border, #e0e0e0)', padding: '8px', fontWeight: 700, textAlign: 'left' }}>
                                                                {language === 'he' ? '\u05E2\u05E8\u05DA' : 'Value'}
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
                                                    {language === 'he' ? '\u05D0\u05D9\u05DF \u05E0\u05EA\u05D5\u05E0\u05D9 \u05E0\u05D9\u05EA\u05D5\u05D7 \u05D6\u05DE\u05D9\u05E0\u05D9\u05DD' : 'No analysis data available'}
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
                                title={language === 'he' ? he : en}
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
                                {language === 'he' ? '\u05EA\u05D1\u05E0\u05D9\u05EA' : 'Template'}
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
                                <option value="israeli">{language === 'he' ? '\u05D3\u05D5\u05D7 \u05DE\u05E2\u05D1\u05D3\u05D4 \u05D9\u05E9\u05E8\u05D0\u05DC\u05D9' : 'Israeli Lab Report'}</option>
                                <option value="minimal">{language === 'he' ? '\u05DE\u05D9\u05E0\u05D9\u05DE\u05DC\u05D9 \u05E0\u05E7\u05D9' : 'Minimal Clean'}</option>
                                <option value="academic">{language === 'he' ? '\u05D0\u05E7\u05D3\u05DE\u05D9 \u05D1\u05E1\u05D2\u05E0\u05D5\u05DF LaTeX' : 'LaTeX-Inspired Academic'}</option>
                            </select>
                        </div>
                        <button
                            disabled={exportStatus === 'exporting' || !titlePageData.studentName.trim() || !titlePageData.experimentTitle.trim()}
                            onClick={handleExportPdf}
                            style={{
                                flex: 1,
                                background: (exportStatus === 'exporting' || !titlePageData.studentName.trim() || !titlePageData.experimentTitle.trim())
                                    ? '#bbb'
                                    : 'linear-gradient(135deg, var(--primary, #1565c0) 0%, #1976d2 100%)',
                                color: 'white',
                                fontSize: '1rem',
                                fontWeight: 600,
                                padding: '16px 32px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: (exportStatus === 'exporting' || !titlePageData.studentName.trim() || !titlePageData.experimentTitle.trim())
                                    ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {exportStatus === 'exporting'
                                ? (language === 'he' ? '\u05DE\u05D9\u05D9\u05E6\u05E8 PDF...' : 'Generating PDF...')
                                : (language === 'he' ? '\u05D9\u05D9\u05E6\u05D5\u05D0 \u05DB-PDF' : 'Export as PDF')}
                        </button>
                    </div>

                    {/* Export error display */}
                    {exportError && (
                        <p style={{ color: 'var(--danger, #d32f2f)', fontSize: '0.875rem', marginTop: '8px' }}>
                            {language === 'he' ? '\u05D9\u05E6\u05D9\u05E8\u05EA \u05D4-PDF \u05E0\u05DB\u05E9\u05DC\u05D4. \u05D5\u05D3\u05D0 \u05E9\u05DB\u05DC \u05D4\u05E9\u05D3\u05D5\u05EA \u05D4\u05E0\u05D3\u05E8\u05E9\u05D9\u05DD \u05DE\u05DC\u05D0\u05D9\u05DD \u05D5\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1.' : exportError}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

export default ReportBeta;
