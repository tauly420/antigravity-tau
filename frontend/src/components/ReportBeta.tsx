import { useState, useRef, useEffect } from 'react';
import { uploadInstructionFile, analyzeReportContext, generateReport, ContextForm, FollowUpQuestion, GeneratedSections } from '../services/api';
import { useAnalysis } from '../context/AnalysisContext';

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

type GenerationPhase = 'idle' | 'analyzing' | 'follow-up' | 'generating' | 'complete' | 'error';

function ReportBeta() {
    const [downloading, setDownloading] = useState(false);
    const [instructionText, setInstructionText] = useState('');
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [uploadWarning, setUploadWarning] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const followUpRef = useRef<HTMLDivElement>(null);

    const { autolabResults } = useAnalysis();

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

    // Auto-focus first follow-up question input when questions appear
    useEffect(() => {
        if (generationPhase === 'follow-up' && followUpRef.current) {
            const firstInput = followUpRef.current.querySelector('input');
            if (firstInput) firstInput.focus();
        }
    }, [generationPhase]);

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

    const handleTestPdf = async () => {
        setDownloading(true);
        try {
            const response = await fetch('/api/report/test-pdf');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (err) {
            alert('Failed to generate test PDF. Make sure the backend is running.');
            console.error(err);
        } finally {
            setDownloading(false);
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

            <div style={{
                background: '#f0f4ff',
                border: '1px solid #c5cae9',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
            }}>
                <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#1565c0' }}>
                    Coming Soon
                </h2>
                <p style={{ margin: '0 0 1rem 0', color: '#444', lineHeight: 1.6 }}>
                    Generate professional academic lab reports from your AutoLab analysis —
                    complete with Hebrew RTL support, LaTeX equations, fitted plots, and
                    uncertainty tables. Upload your data, let AI write the report, review and
                    edit each section, then export as PDF.
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#555', lineHeight: 1.8 }}>
                    <li>AI-generated report sections from your analysis results</li>
                    <li>Hebrew right-to-left layout with inline math equations</li>
                    <li>Section-by-section editing with live LaTeX preview</li>
                    <li>Professional A4 PDF export with bundled fonts</li>
                </ul>
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
                    Upload your lab instruction file (PDF or Word) to provide context for report generation
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadStatus === 'uploading'}
                    style={{
                        background: uploadStatus === 'uploading' ? '#bbb' : 'var(--surface-alt, #f4f5f9)',
                        color: 'var(--text, #1a1a2e)',
                        border: '1.5px dashed var(--border, #e0e0e0)',
                        borderRadius: '8px',
                        padding: '16px 24px',
                        fontSize: '0.875rem',
                        cursor: uploadStatus === 'uploading' ? 'not-allowed' : 'pointer',
                        width: '100%',
                    }}
                >
                    {uploadStatus === 'uploading' ? 'Uploading...' : uploadStatus === 'done' ? 'File uploaded — click to replace' : 'Click to upload instruction file (PDF, Word)'}
                </button>
                {uploadWarning && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.875rem', color: uploadStatus === 'error' ? 'var(--danger, #d32f2f)' : 'var(--warning, #f57c00)' }}>
                        {uploadWarning}
                    </p>
                )}
                {instructionText && (
                    <div style={{ marginTop: '16px' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text, #1a1a2e)', marginBottom: '4px', display: 'block' }}>
                            Extracted Text
                        </label>
                        <textarea
                            value={instructionText}
                            onChange={(e) => setInstructionText(e.target.value)}
                            rows={6}
                            style={{
                                ...inputStyle('instructionText'),
                                resize: 'vertical' as const,
                            }}
                            onFocus={() => setFocusedField('instructionText')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </div>
                )}
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

            {/* Generate Report Button — Focal Point */}
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
            )}

            {/* Infrastructure Preview */}
            <div style={{
                background: '#fff3e0',
                border: '1px solid #ffe0b2',
                borderRadius: '12px',
                padding: '1.5rem',
            }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#e65100' }}>
                    Infrastructure Preview
                </h3>
                <p style={{ margin: '0 0 1rem 0', color: '#555', lineHeight: 1.6 }}>
                    The PDF rendering engine is ready. Generate a test PDF with Hebrew text
                    and 12 physics equations to see the rendering quality.
                </p>
                <button
                    onClick={handleTestPdf}
                    disabled={downloading}
                    style={{
                        background: downloading ? '#bbb' : '#e65100',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.6rem 1.2rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: downloading ? 'not-allowed' : 'pointer',
                    }}
                >
                    {downloading ? 'Generating...' : 'View Test PDF'}
                </button>
            </div>
        </div>
    );
}

export default ReportBeta;
