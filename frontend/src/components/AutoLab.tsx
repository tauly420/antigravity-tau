import { useState, useRef, useEffect } from 'react';
import Plot from './PlotWrapper';
import DataPreview from './DataPreview';
import { useAnalysis } from '../context/AnalysisContext';
import * as api from '../services/api';
import { roundWithUncertainty, smartFormat, formatPValue } from '../utils/format';
import { renderLatex, mathToUnicode } from '../utils/latex';

/* ═══════════════════════════════════════════════════════════════
   AutoLab — AI-Powered Automated Analysis
   Upload data + give instructions → get complete results
   ═══════════════════════════════════════════════════════════════ */

/* ── Built-in example datasets ── */
const EXAMPLE_DATASETS = [
    {
        label: '📈 Hooke\'s Law (Linear)',
        instructions: 'Use the first sheet. Column "Extension_m" is x, "Force_N" is y, "Force_Error_N" is y error, "Extension_Error_m" is x error. Fit a linear model. Calculate the slope a (the spring constant k) and report its value.',
        theoVal: '50.0',
        theoUnc: '2.0',
        columns: ['Extension_m', 'Force_N', 'Force_Error_N', 'Extension_Error_m'],
        rows: [
            { Extension_m: 0.01, Force_N: 0.65, Force_Error_N: 0.50, Extension_Error_m: 0.005 },
            { Extension_m: 0.02, Force_N: 0.82, Force_Error_N: 0.50, Extension_Error_m: 0.005 },
            { Extension_m: 0.03, Force_N: 1.68, Force_Error_N: 0.55, Extension_Error_m: 0.005 },
            { Extension_m: 0.04, Force_N: 1.85, Force_Error_N: 0.55, Extension_Error_m: 0.005 },
            { Extension_m: 0.05, Force_N: 2.72, Force_Error_N: 0.60, Extension_Error_m: 0.005 },
            { Extension_m: 0.06, Force_N: 2.88, Force_Error_N: 0.60, Extension_Error_m: 0.005 },
            { Extension_m: 0.07, Force_N: 3.70, Force_Error_N: 0.65, Extension_Error_m: 0.005 },
            { Extension_m: 0.08, Force_N: 3.85, Force_Error_N: 0.65, Extension_Error_m: 0.005 },
            { Extension_m: 0.09, Force_N: 4.65, Force_Error_N: 0.70, Extension_Error_m: 0.005 },
            { Extension_m: 0.10, Force_N: 4.90, Force_Error_N: 0.75, Extension_Error_m: 0.005 },
        ],
    },
    {
        label: '🌊 Oscillation (Sinusoidal)',
        // Simplified: no formula specified, no "maximum acceleration" — just fit sinusoidal, extract period
        instructions: 'First sheet. Column "Time_s" is x, "Displacement_cm" is y, "Displacement_Error_cm" is y error. Fit a sinusoidal model. Calculate the period T = 2*pi/omega and compare to the theoretical value.',
        // Theoretical period: T = 2π/2.5 ≈ 2.513 s — as measured independently by stopwatch
        theoVal: '2.51',
        theoUnc: '0.10',
        columns: ['Time_s', 'Displacement_cm', 'Displacement_Error_cm'],
        rows: (() => {
            const data = [];
            // Fixed noise values for consistent display (avoids Math.random variation on reload)
            const noise = [0.3, -0.8, 1.2, -0.4, 0.9, -1.1, 0.5, -0.7, 1.4, -0.3,
                           0.6, -1.3, 0.8, -0.5, 1.1, -0.9, 0.4, -1.2, 0.7, -0.6, 0.2];
            for (let i = 0; i <= 20; i++) {
                const t = i * 0.25;
                const y = 5.0 * Math.sin(2.5 * t + 0.3) + 2.0;
                data.push({
                    Time_s: parseFloat(t.toFixed(3)),
                    Displacement_cm: parseFloat((y + noise[i]).toFixed(3)),
                    Displacement_Error_cm: 1.0, // 1 cm errors — clearly visible on residuals
                });
            }
            return data;
        })(),
    },
    {
        label: '📊 Free Fall (Quadratic)',
        // Simplified: no explicit formula string — AI knows what to do with "quadratic"
        instructions: 'First sheet. "Time_s" is x, "Height_m" is y, "Height_Error_m" is y error. Fit a quadratic model. Extract g = 2*a and compare to the theoretical value I provided.',
        theoVal: '9.81',
        theoUnc: '0.01',
        columns: ['Time_s', 'Height_m', 'Height_Error_m', 'Time_Error_s'],
        rows: [
            { Time_s: 0.0, Height_m: 0.00, Height_Error_m: 0.10, Time_Error_s: 0.02 },
            { Time_s: 0.1, Height_m: 0.05, Height_Error_m: 0.10, Time_Error_s: 0.02 },
            { Time_s: 0.2, Height_m: 0.19, Height_Error_m: 0.12, Time_Error_s: 0.02 },
            { Time_s: 0.3, Height_m: 0.45, Height_Error_m: 0.15, Time_Error_s: 0.02 },
            { Time_s: 0.4, Height_m: 0.77, Height_Error_m: 0.18, Time_Error_s: 0.02 },
            { Time_s: 0.5, Height_m: 1.23, Height_Error_m: 0.20, Time_Error_s: 0.02 },
            { Time_s: 0.6, Height_m: 1.76, Height_Error_m: 0.22, Time_Error_s: 0.02 },
            { Time_s: 0.7, Height_m: 2.42, Height_Error_m: 0.25, Time_Error_s: 0.02 },
            { Time_s: 0.8, Height_m: 3.13, Height_Error_m: 0.28, Time_Error_s: 0.02 },
            { Time_s: 0.9, Height_m: 3.95, Height_Error_m: 0.30, Time_Error_s: 0.02 },
            { Time_s: 1.0, Height_m: 4.89, Height_Error_m: 0.35, Time_Error_s: 0.02 },
            { Time_s: 1.1, Height_m: 5.93, Height_Error_m: 0.38, Time_Error_s: 0.02 },
            { Time_s: 1.2, Height_m: 7.05, Height_Error_m: 0.40, Time_Error_s: 0.02 },
            { Time_s: 1.3, Height_m: 8.28, Height_Error_m: 0.42, Time_Error_s: 0.02 },
            { Time_s: 1.4, Height_m: 9.61, Height_Error_m: 0.45, Time_Error_s: 0.02 },
            { Time_s: 1.5, Height_m: 11.03, Height_Error_m: 0.50, Time_Error_s: 0.02 },
        ],
    },
];

/** Convert rows to CSV and create a File object */
function rowsToFile(columns: string[], rows: Record<string, any>[], filename: string): File {
    const header = columns.join(',');
    const body = rows.map(r => columns.map(c => r[c] ?? '').join(',')).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    return new File([blob], filename, { type: 'text/csv' });
}

interface StepResult {
    step: string;
    tool?: string;
    args?: Record<string, any>;
    result?: Record<string, any>;
    success?: boolean;
    message?: string;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/** Model formula map for display */
const MODEL_FORMULAS: Record<string, string> = {
    linear: 'y = ax + b',
    quadratic: 'y = ax² + bx + c',
    cubic: 'y = ax³ + bx² + cx + d',
    power: 'y = axᵇ',
    exponential: 'y = ae^(bx)',
    sinusoidal: 'y = A·sin(ωx + φ) + D',
};

/** N-sigma colour: green ≤ 2, orange 2–3, red > 3 */
function nsigmaColor(ns: number): string {
    if (ns <= 2) return '#2e7d32';
    if (ns <= 3) return '#e65100';
    return '#c62828';
}

/* ── Table cell styles ── */
const thStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem', textAlign: 'left',
    borderBottom: '2px solid #90caf9',
    fontSize: '0.85rem', fontWeight: 700,
};
const tdStyle: React.CSSProperties = {
    padding: '0.4rem 0.75rem', borderBottom: '1px solid #eee',
    fontFamily: 'monospace',
};

function AutoLab() {
    const [file, setFile] = useState<File | null>(null);
    const [instructions, setInstructions] = useState('');
    const [theoVal, setTheoVal] = useState('');
    const [theoUnc, setTheoUnc] = useState('');

    const [running, setRunning] = useState(false);
    const [steps, setSteps] = useState<StepResult[]>([]);
    const [fitData, setFitData] = useState<any>(null);
    const [analysisState, setAnalysisState] = useState<any>(null); // full state for chat context
    const [error, setError] = useState('');

    /* Data preview state */
    const [previewData, setPreviewData] = useState<{ columns: string[]; rows: Record<string, any>[] } | null>(null);
    const [previewError, setPreviewError] = useState('');

    /* Inline chat state */
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [tableCopied, setTableCopied] = useState(false);

    const fileRef = useRef<HTMLInputElement>(null);
    const { setCurrentTool, setAutolabResults } = useAnalysis();

    useEffect(() => { setCurrentTool('AutoLab'); }, []);

    // Auto-scroll chat to bottom when new messages arrive
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    /* Parse file for preview when user selects one */
    const handleFileChange = async (f: File) => {
        setFile(f);
        setPreviewData(null);
        setPreviewError('');
        try {
            const data = await api.parseFileData(f);
            // Validate response before setting — guards against crashes on unusual Excel files
            if (Array.isArray(data?.columns) && data.columns.length > 0 && Array.isArray(data?.rows)) {
                setPreviewData({ columns: data.columns.map(String), rows: data.rows });
            }
        } catch {
            setPreviewError('Could not preview file — analysis will still work when you click Run.');
        }
    };

    /* Load example dataset */
    const loadExample = (ex: typeof EXAMPLE_DATASETS[0]) => {
        const f = rowsToFile(ex.columns, ex.rows, 'autolab_example.csv');
        setFile(f);
        setInstructions(ex.instructions);
        setTheoVal(ex.theoVal || '');
        setTheoUnc(ex.theoUnc || '');
        setPreviewData({ columns: ex.columns, rows: ex.rows });
        setPreviewError('');
        setSteps([]);
        setFitData(null);
        setAnalysisState(null);
        setChatMessages([]);
        setError('');
    };

    const handleRun = async () => {
        if (!file || !instructions.trim()) return;
        setRunning(true);
        setSteps([]);
        setFitData(null);
        setAnalysisState(null);
        setChatMessages([]);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('instructions', instructions);
            if (theoVal) formData.append('theoretical_value', theoVal);
            if (theoUnc) formData.append('theoretical_uncertainty', theoUnc);

            const resp = await fetch('/api/autolab/run', { method: 'POST', body: formData });
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Server error ${resp.status}`);
            }
            const data = await resp.json();

            if (data.error && !data.steps?.length) {
                setError(data.error);
            } else {
                setSteps(data.steps || []);
                setFitData(data.fit_data || null);
                setAnalysisState(data.state || null);
                // Share results with sidebar chat via context
                if (data.state) {
                    setAutolabResults({
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
                        instructions,
                        filename: file?.name,
                    });
                }
            }
        } catch (err: any) {
            setError(err.message || 'AutoLab failed');
        } finally {
            setRunning(false);
        }
    };

    const handleSendChat = async () => {
        const msg = chatInput.trim();
        if (!msg || chatLoading) return;

        const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: msg }];
        setChatMessages(newMessages);
        setChatInput('');
        setChatLoading(true);

        try {
            const context = {
                fit: analysisState?.fit ? {
                    model_name: analysisState.fit.model_name,
                    parameter_names: analysisState.fit.parameter_names,
                    parameters: analysisState.fit.parameters,
                    uncertainties: analysisState.fit.uncertainties,
                    reduced_chi_squared: analysisState.fit.reduced_chi_squared,
                    p_value: analysisState.fit.p_value,
                    r_squared: analysisState.fit.r_squared,
                    dof: analysisState.fit.dof,
                    n_data: analysisState.fit.n_data,
                    chi_squared: analysisState.fit.chi_squared,
                } : undefined,
                formula: analysisState?.formula,
                nsigma: analysisState?.nsigma,
                parsed: analysisState?.parsed ? {
                    columns: analysisState.parsed.columns,
                    num_rows: analysisState.parsed.num_rows,
                    x_col: analysisState.parsed.x_col,
                    y_col: analysisState.parsed.y_col,
                } : undefined,
                instructions,
                file_info: file ? { name: file.name, size: file.size } : undefined,
            };
            const result = await api.autolabChat({ messages: newMessages, context });
            setChatMessages(prev => [...prev, { role: 'assistant', content: result.reply }]);
        } catch (err: any) {
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error: ${err.message || 'Chat failed'}`,
            }]);
        } finally {
            setChatLoading(false);
        }
    };

    const plotConfig = {
        responsive: true, displaylogo: false,
        toImageButtonOptions: { format: 'png' as any, filename: 'autolab_fit', height: 800, width: 1200, scale: 2 },
    };

    /* ── Derive structured result sections from steps ── */
    const summaryStep = steps.find(s => s.step === 'summary' && s.message);
    const fitStep = steps.find(s => s.step === 'fit' && s.success && s.result && !s.result.error);
    const formulaStep = steps.find(s => s.step === 'formula' && s.success && s.result && !s.result.error);
    const nsigmaStep = steps.find(s => s.step === 'nsigma' && s.success && s.result && !s.result.error);
    const errorSteps = steps.filter(s => s.success === false || s.result?.error);
    const hasResults = steps.length > 0;

    return (
        <div className="card" style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {/* ── Header ── */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.8rem', margin: 0 }}>🤖 AutoLab</h2>
                <p style={{ color: '#666', marginTop: '0.4rem', fontSize: '1.05rem' }}>
                    AI-Powered Automated Analysis — Upload, Instruct, Get Results
                </p>
            </div>

            {/* ═══ INPUT PANEL (always full width, results appear below) ═══ */}
            <div>
                {/* File upload */}
                <div className="form-group">
                    <label style={{ fontWeight: 600, fontSize: '1rem' }}>📎 Data File</label>
                    <div
                        onClick={() => fileRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={e => {
                            e.preventDefault();
                            const f = e.dataTransfer.files[0];
                            if (f) handleFileChange(f);
                        }}
                        style={{
                            border: '2px dashed #1565c0', borderRadius: '10px', padding: '1.5rem',
                            textAlign: 'center', cursor: 'pointer',
                            background: file ? '#e8f5e9' : '#e3f2fd', transition: 'all 0.2s',
                        }}
                    >
                        {file ? (
                            <span style={{ fontWeight: 600, color: '#2e7d32' }}>
                                ✅ {file.name} ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                        ) : (
                            <span style={{ color: '#1565c0' }}>
                                Click or drag & drop your data file<br />
                                <small>.xlsx, .csv, .tsv, .ods, .dat</small>
                            </span>
                        )}
                    </div>
                    <input
                        ref={fileRef} type="file"
                        accept=".xlsx,.xls,.csv,.tsv,.ods,.dat,.txt"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
                        style={{ display: 'none' }}
                    />
                    {previewError && (
                        <p style={{ color: '#e65100', fontSize: '0.85rem', margin: '0.3rem 0 0' }}>
                            ⚠️ {previewError}
                        </p>
                    )}
                </div>

                {/* Data preview */}
                {previewData && (
                    <DataPreview columns={previewData.columns} rows={previewData.rows} />
                )}

                {/* Example datasets */}
                <div style={{
                    padding: '0.8rem 1rem', background: '#e8f5e9', borderRadius: '10px',
                    border: '1px solid #a5d6a7', marginBottom: '1rem',
                }}>
                    <p style={{ fontWeight: 600, margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                        🧪 Try an example (loads data + instructions):
                    </p>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {EXAMPLE_DATASETS.map(ex => (
                            <button key={ex.label} className="btn-accent"
                                onClick={() => loadExample(ex)}
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}>
                                {ex.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Instructions */}
                <div className="form-group">
                    <label style={{ fontWeight: 600, fontSize: '1rem' }}>📝 Instructions</label>
                    <textarea
                        value={instructions}
                        onChange={e => setInstructions(e.target.value)}
                        rows={5}
                        placeholder={'Describe your analysis in plain language. For example:\n\n"Use sheet 2, x is column 1, y is column 3, y error is column 4. Fit a sinc function. Calculate the first zero crossing and compare to 1.0 ± 0.05."'}
                        style={{ fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: 1.5 }}
                    />
                </div>

                {/* Theoretical value (optional) */}
                <div style={{
                    padding: '1rem', background: '#f3e5f5', borderRadius: '10px',
                    border: '1px solid #ce93d8', marginBottom: '1rem',
                }}>
                    <p style={{ fontWeight: 600, margin: '0 0 0.5rem', fontSize: '0.95rem' }}>
                        🎯 Theoretical Value (optional)
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div className="form-group" style={{ flex: 1, margin: 0 }}>
                            <label>Value</label>
                            <input type="text" value={theoVal}
                                onChange={e => setTheoVal(e.target.value)}
                                placeholder="e.g. 9.81" style={{ fontFamily: 'monospace' }} />
                        </div>
                        <div className="form-group" style={{ flex: 1, margin: 0 }}>
                            <label>Uncertainty</label>
                            <input type="text" value={theoUnc}
                                onChange={e => setTheoUnc(e.target.value)}
                                placeholder="e.g. 0.01" style={{ fontFamily: 'monospace' }} />
                        </div>
                    </div>
                </div>

                {/* Run button */}
                <button
                    onClick={handleRun}
                    disabled={running || !file || !instructions.trim()}
                    className="btn-primary"
                    style={{
                        width: '100%', fontSize: '1.15rem', padding: '0.9rem',
                        background: running ? '#90a4ae' : 'linear-gradient(135deg, #1565c0, #7b1fa2)',
                        border: 'none', borderRadius: '10px', color: 'white',
                        cursor: running ? 'wait' : 'pointer', transition: 'all 0.3s',
                    }}
                >
                    {running ? <span>⏳ AI is analyzing… please wait</span> : <span>🚀 Run AutoLab</span>}
                </button>

                {error && (
                    <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>
                )}
            </div>

            {/* ═══ RESULTS SECTION (full width, below input) ═══ */}
            {hasResults && (
                <div style={{ marginTop: '2.5rem' }}>
                    <h3 style={{ color: '#1565c0', marginBottom: '1.25rem', fontSize: '1.2rem' }}>
                        📊 Results
                    </h3>

                    {/* ── Errors ── */}
                    {errorSteps.length > 0 && (
                        <div style={{
                            padding: '0.8rem 1rem', borderRadius: '10px',
                            border: '2px solid #ef9a9a', background: '#ffebee', marginBottom: '1rem',
                        }}>
                            <strong>⚠️ Errors during analysis:</strong>
                            {errorSteps.map((s, i) => (
                                <p key={i} style={{ margin: '0.3rem 0 0', fontSize: '0.88rem', color: '#c62828' }}>
                                    {s.step}: {s.result?.error || s.message}
                                </p>
                            ))}
                        </div>
                    )}

                    {/* ── Single green summary box ── */}
                    {summaryStep && (
                        <div style={{
                            padding: '1rem 1.2rem', borderRadius: '10px',
                            border: '2px solid #a5d6a7', background: '#e8f5e9', marginBottom: '1.5rem',
                        }}>
                            <div style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1rem' }}>
                                ✅ Analysis Summary
                            </div>
                            <div
                                style={{ fontSize: '0.95rem', whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#1b5e20' }}
                                dangerouslySetInnerHTML={{ __html: renderLatex(summaryStep.message || '') }}
                            />
                        </div>
                    )}

                    {/* ── Parameter table ── */}
                    {fitStep && fitStep.result && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                            <h4 style={{ margin: 0, color: '#333', fontSize: '1rem' }}>
                                📈 Fit Parameters — <em style={{ fontWeight: 400 }}>{fitStep.result.model_name || fitStep.args?.model}</em>
                                {(() => {
                                    const modelKey = (fitStep.args?.model || '').toLowerCase();
                                    const formula = MODEL_FORMULAS[modelKey] || (fitStep.args?.custom_expr ? fitStep.args.custom_expr : null);
                                    return formula ? (
                                        <span style={{ marginLeft: '0.5rem', fontSize: '0.88rem', color: '#666', fontFamily: 'monospace' }}>
                                            ({formula})
                                        </span>
                                    ) : null;
                                })()}
                            </h4>
                            <button
                                onClick={() => {
                                    const names = fitStep.result!.parameter_names as string[] || [];
                                    const lines = ['Parameter\tRounded\tFull Precision'];
                                    names.forEach((name: string, j: number) => {
                                        const val = Number(fitStep.result!.parameters?.[j]);
                                        const unc = Number(fitStep.result!.uncertainties?.[j]);
                                        const fmt = roundWithUncertainty(val, unc);
                                        lines.push(`${name}\t${fmt.rounded}\t${fmt.unrounded}`);
                                    });
                                    navigator.clipboard.writeText(lines.join('\n'));
                                    setTableCopied(true);
                                    setTimeout(() => setTableCopied(false), 1500);
                                }}
                                style={{
                                    padding: '0.3rem 0.7rem', fontSize: '0.8rem',
                                    border: '1px solid #ccc', borderRadius: '6px',
                                    background: tableCopied ? '#e8f5e9' : '#fff',
                                    color: tableCopied ? '#2e7d32' : '#555',
                                    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                                }}
                            >
                                {tableCopied ? '✓ Copied!' : '📋 Copy Table'}
                            </button>
                            </div>
                            <div style={{ overflowX: 'auto', userSelect: 'text' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ background: '#e3f2fd' }}>
                                            <th style={thStyle}>Parameter</th>
                                            <th style={thStyle}>Rounded (2 sig. fig. on unc.)</th>
                                            <th style={thStyle}>Full precision</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(fitStep.result.parameter_names as string[] || []).map((name: string, j: number) => {
                                            const val = Number(fitStep.result!.parameters?.[j]);
                                            const unc = Number(fitStep.result!.uncertainties?.[j]);
                                            const fmt = roundWithUncertainty(val, unc);
                                            return (
                                                <tr key={name} style={{ background: j % 2 === 0 ? '#fafafa' : '#fff' }}>
                                                    <td style={tdStyle}><strong>{name}</strong></td>
                                                    <td style={tdStyle}>{fmt.rounded}</td>
                                                    <td style={{ ...tdStyle, color: '#888', fontSize: '0.82rem' }}>{fmt.unrounded}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {/* Fit statistics */}
                            <div style={{
                                marginTop: '0.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
                                fontSize: '0.88rem', color: '#555',
                                padding: '0.5rem 0.75rem', background: '#f5f5f5', borderRadius: '6px',
                            }}>
                                {fitStep.result.reduced_chi_squared != null && (
                                    <span>χ²/dof = <strong>{Number(fitStep.result.reduced_chi_squared).toFixed(3)}</strong></span>
                                )}
                                {fitStep.result.p_value != null && (
                                    <span>P = <strong>{formatPValue(Number(fitStep.result.p_value))}</strong></span>
                                )}
                                {fitStep.result.dof != null && (
                                    <span>dof = <strong>{fitStep.result.dof}</strong></span>
                                )}
                                {analysisState?.fit?.r_squared != null && (
                                    <span>R² = <strong>{Number(analysisState.fit.r_squared).toFixed(5)}</strong></span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Formula result ── */}
                    {formulaStep && formulaStep.result && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 0.6rem', color: '#333', fontSize: '1rem' }}>
                                🧮 Formula Calculation
                            </h4>
                            <div style={{
                                padding: '0.85rem 1rem', background: '#fff8e1',
                                borderRadius: '8px', border: '1px solid #ffe082',
                                fontFamily: 'monospace', fontSize: '0.95rem',
                            }}>
                                <div style={{ marginBottom: '0.4rem', color: '#555' }}>
                                    Expression: <strong style={{ color: '#111' }}>{formulaStep.args?.expression}</strong>
                                </div>
                                {(() => {
                                    const val = Number(formulaStep.result!.value);
                                    const unc = Number(formulaStep.result!.uncertainty);
                                    const fmt = (isFinite(val) && isFinite(unc) && unc > 0)
                                        ? roundWithUncertainty(val, unc)
                                        : { rounded: String(formulaStep.result!.formatted ?? '—'), unrounded: `${smartFormat(val)} ± ${smartFormat(unc)}` };
                                    return (
                                        <>
                                            <div>
                                                Result (rounded):&nbsp;
                                                <strong style={{ fontSize: '1.05rem', color: '#111' }}>{fmt.rounded}</strong>
                                            </div>
                                            <div style={{ color: '#999', fontSize: '0.83rem', marginTop: '0.25rem' }}>
                                                Full: {fmt.unrounded}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* ── N-sigma result ── */}
                    {nsigmaStep && nsigmaStep.result && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 0.6rem', color: '#333', fontSize: '1rem' }}>
                                🎯 N-Sigma Comparison
                            </h4>
                            {(() => {
                                const ns = Number(nsigmaStep.result!.n_sigma);
                                const col = nsigmaColor(ns);
                                const tv = nsigmaStep.result!.theoretical_value;
                                const tu = nsigmaStep.result!.theoretical_uncertainty;
                                const measVal = Number(formulaStep?.result?.value);
                                const measUnc = Number(formulaStep?.result?.uncertainty);
                                const measFmt = (isFinite(measVal) && isFinite(measUnc) && measUnc > 0)
                                    ? roundWithUncertainty(measVal, measUnc).rounded
                                    : String(formulaStep?.result?.formatted ?? '—');
                                return (
                                    <div style={{
                                        padding: '0.85rem 1rem', borderRadius: '8px',
                                        border: `2px solid ${col}`,
                                        background: ns <= 2 ? '#e8f5e9' : ns <= 3 ? '#fff3e0' : '#ffebee',
                                    }}>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: col }}>
                                            N-σ = {ns.toFixed(2)}
                                            <span style={{ fontSize: '0.95rem', fontWeight: 500, marginLeft: '0.75rem', color: '#333' }}>
                                                — {nsigmaStep.result!.verdict}
                                            </span>
                                        </div>
                                        <div style={{ marginTop: '0.4rem', fontSize: '0.9rem', color: '#555' }}>
                                            Measured: <strong>{measFmt}</strong>
                                            <span style={{ margin: '0 0.75rem', color: '#bbb' }}>vs</span>
                                            Theoretical: <strong>{tv}{tu ? ` ± ${tu}` : ''}</strong>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* ═══ FIT PLOT ═══ */}
                    {fitData && fitData.x_data && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ color: '#333', margin: '0 0 0.5rem', fontSize: '1rem' }}>📉 Fit Plot</h4>
                            <Plot
                                data={[
                                    {
                                        x: fitData.x_data,
                                        y: fitData.y_data,
                                        error_y: fitData.y_errors ? {
                                            type: 'data' as const, array: fitData.y_errors,
                                            visible: true, color: '#1565c0', thickness: 1.5,
                                        } : undefined,
                                        error_x: fitData.x_errors ? {
                                            type: 'data' as const, array: fitData.x_errors,
                                            visible: true, color: '#1565c0', thickness: 1.5,
                                        } : undefined,
                                        type: 'scatter' as const, mode: 'markers' as const,
                                        name: 'Data', marker: { size: 6, color: '#1565c0' },
                                    },
                                    {
                                        x: fitData.x_fit, y: fitData.y_fit,
                                        type: 'scatter' as const, mode: 'lines' as const,
                                        name: `Fit (${fitData.model_name})`,
                                        line: { width: 2.5, color: '#d32f2f' },
                                    },
                                ]}
                                layout={{
                                    title: { text: `AutoLab Fit — ${fitData.model_name}` },
                                    xaxis: { title: { text: 'X' }, gridcolor: '#e0e0e0' },
                                    yaxis: { title: { text: 'Y' }, gridcolor: '#e0e0e0' },
                                    height: 420, margin: { l: 60, r: 30, t: 55, b: 55 },
                                    legend: { x: 0, y: 1.15, orientation: 'h' as const },
                                    plot_bgcolor: '#fafafa', paper_bgcolor: '#fff',
                                }}
                                useResizeHandler style={{ width: '100%' }} config={plotConfig}
                            />

                            {/* Residuals with error bars */}
                            {fitData.residuals && (
                                <Plot
                                    data={[{
                                        x: fitData.x_data, y: fitData.residuals,
                                        error_y: fitData.y_errors ? {
                                            type: 'data' as const, array: fitData.y_errors,
                                            visible: true, color: '#7b1fa2', thickness: 1.5,
                                        } : undefined,
                                        error_x: fitData.x_errors ? {
                                            type: 'data' as const, array: fitData.x_errors,
                                            visible: true, color: '#7b1fa2', thickness: 1.5,
                                        } : undefined,
                                        type: 'scatter' as const, mode: 'markers' as const,
                                        name: 'Residuals', marker: { size: 5, color: '#7b1fa2' },
                                    }, {
                                        x: [Math.min(...fitData.x_data), Math.max(...fitData.x_data)],
                                        y: [0, 0],
                                        type: 'scatter' as const, mode: 'lines' as const,
                                        line: { width: 1, color: '#999', dash: 'dash' },
                                        showlegend: false,
                                    }]}
                                    layout={{
                                        title: { text: 'Residuals (data − fit)' },
                                        xaxis: { title: { text: 'X' }, gridcolor: '#e0e0e0' },
                                        yaxis: { title: { text: 'y − f(x)' }, gridcolor: '#e0e0e0' },
                                        height: 280, margin: { l: 60, r: 30, t: 45, b: 45 },
                                        plot_bgcolor: '#fafafa', paper_bgcolor: '#fff',
                                    }}
                                    useResizeHandler style={{ width: '100%' }} config={plotConfig}
                                />
                            )}
                            <p style={{ color: '#888', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
                                📷 Use the camera icon on each plot to download as PNG.
                            </p>
                        </div>
                    )}

                    {/* ═══ INLINE AI CHAT ═══ */}
                    <div style={{
                        marginTop: '1.5rem', border: '1px solid #e0e0e0',
                        borderRadius: '12px', overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        fontFamily: "'Inter', sans-serif",
                    }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #1565c0, #7b1fa2)',
                            padding: '0.85rem 1.2rem', color: 'white',
                            fontWeight: 700, fontSize: '1.05rem',
                            letterSpacing: '-0.01em',
                        }}>
                            💬 Chat with AI about your results
                        </div>

                        {/* Message thread */}
                        <div style={{
                            minHeight: '100px', maxHeight: '400px', overflowY: 'auto',
                            padding: '1rem 1.2rem', background: '#fafafa',
                            display: 'flex', flexDirection: 'column', gap: '0.75rem',
                        }}>
                            {chatMessages.length === 0 && (
                                <p style={{ color: '#aaa', fontSize: '0.9rem', textAlign: 'center', margin: 'auto 0' }}>
                                    Ask anything about your results — interpretation, further analysis, comparisons…
                                </p>
                            )}
                            {chatMessages.map((msg, i) => (
                                <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                                    <div style={{
                                        padding: '0.6rem 0.9rem',
                                        borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                                        background: msg.role === 'user' ? '#1565c0' : '#fff',
                                        color: msg.role === 'user' ? 'white' : '#333',
                                        border: msg.role === 'assistant' ? '1px solid #e0e0e0' : 'none',
                                        fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                                    }}
                                        dangerouslySetInnerHTML={{
                                            __html: msg.role === 'assistant'
                                                ? renderLatex(msg.content)
                                                : msg.content
                                        }}
                                    />
                                </div>
                            ))}
                            {chatLoading && (
                                <div style={{ alignSelf: 'flex-start' }}>
                                    <div style={{
                                        padding: '0.6rem 0.9rem', borderRadius: '12px 12px 12px 2px',
                                        background: '#fff', border: '1px solid #e0e0e0',
                                        fontSize: '0.9rem', color: '#999',
                                    }}>
                                        ⏳ Thinking…
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input row */}
                        <div style={{
                            display: 'flex', gap: '0.5rem', padding: '0.85rem 1.2rem',
                            background: '#fff', borderTop: '1px solid #e0e0e0',
                        }}>
                            <input
                                type="text" value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                                placeholder="Ask about your results — interpretation, further analysis, comparisons…"
                                disabled={chatLoading}
                                style={{
                                    flex: 1, padding: '0.55rem 0.85rem',
                                    border: '1px solid #ccc', borderRadius: '8px',
                                    fontSize: '0.9rem', outline: 'none',
                                    fontFamily: "'Inter', sans-serif",
                                    transition: 'border-color 0.2s',
                                }}
                            />
                            <button
                                onClick={handleSendChat}
                                disabled={chatLoading || !chatInput.trim()}
                                style={{
                                    padding: '0.55rem 1.2rem',
                                    background: (chatLoading || !chatInput.trim()) ? '#ccc' : 'linear-gradient(135deg, #1565c0, #7b1fa2)',
                                    color: 'white', border: 'none', borderRadius: '8px',
                                    cursor: (chatLoading || !chatInput.trim()) ? 'default' : 'pointer',
                                    fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s',
                                    fontFamily: "'Inter', sans-serif",
                                }}
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AutoLab;
