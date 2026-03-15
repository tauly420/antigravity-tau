import { useState, useRef } from 'react';
import Plot from './PlotWrapper';
import { useAnalysis } from '../context/AnalysisContext';

/* ═══════════════════════════════════════════════════════════════
   AutoLab — AI-Powered Automated Analysis
   Upload data + give instructions → get complete results
   ═══════════════════════════════════════════════════════════════ */

const EXAMPLE_INSTRUCTIONS = [
    {
        label: '📈 Linear fit',
        text: 'Use the first sheet. Column A is x, column B is y, column C is y error. Fit a linear model and report the slope and intercept.',
    },
    {
        label: '🌊 Sinusoidal fit + formula',
        text: 'Sheet 1, columns 1-4 are x, delta_x, y, delta_y (0-indexed). Fit a sinusoidal model. Calculate the amplitude times omega squared from the fitted parameters.',
    },
    {
        label: '📊 Quadratic + compare',
        text: 'First sheet. x is column A, y is column B, y-error is column C. Fit a quadratic model. Calculate the coefficient a times 2 and compare it to the theoretical value I provided.',
    },
];

interface StepResult {
    step: string;
    tool?: string;
    args?: Record<string, any>;
    result?: Record<string, any>;
    success?: boolean;
    message?: string;
}

function AutoLab() {
    const [file, setFile] = useState<File | null>(null);
    const [instructions, setInstructions] = useState('');
    const [theoVal, setTheoVal] = useState('');
    const [theoUnc, setTheoUnc] = useState('');

    const [running, setRunning] = useState(false);
    const [steps, setSteps] = useState<StepResult[]>([]);
    const [fitData, setFitData] = useState<any>(null);
    const [error, setError] = useState('');

    const fileRef = useRef<HTMLInputElement>(null);
    const { setCurrentTool } = useAnalysis();

    useState(() => { setCurrentTool('AutoLab'); });

    const handleRun = async () => {
        if (!file || !instructions.trim()) return;
        setRunning(true);
        setSteps([]);
        setFitData(null);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('instructions', instructions);
            if (theoVal) formData.append('theoretical_value', theoVal);
            if (theoUnc) formData.append('theoretical_uncertainty', theoUnc);

            const resp = await fetch('/api/autolab/run', { method: 'POST', body: formData });
            const data = await resp.json();

            if (data.error && !data.steps?.length) {
                setError(data.error);
            } else {
                setSteps(data.steps || []);
                setFitData(data.fit_data || null);
            }
        } catch (err: any) {
            setError(err.message || 'AutoLab failed');
        } finally {
            setRunning(false);
        }
    };

    const stepIcon = (s: StepResult) => {
        if (s.success === false) return '❌';
        if (s.step === 'summary') return '📝';
        if (s.step === 'parse') return '📂';
        if (s.step === 'fit') return '📈';
        if (s.step === 'formula') return '🧮';
        if (s.step === 'nsigma') return '🎯';
        return '✅';
    };

    const stepLabel = (s: StepResult) => {
        if (s.step === 'parse') return 'Data Parsed';
        if (s.step === 'fit') return 'Curve Fit';
        if (s.step === 'formula') return 'Formula Evaluated';
        if (s.step === 'nsigma') return 'N-Sigma Comparison';
        if (s.step === 'summary') return 'Summary';
        return s.step;
    };

    const plotConfig = {
        responsive: true, displaylogo: false,
        toImageButtonOptions: { format: 'png' as any, filename: 'autolab_fit', height: 800, width: 1200, scale: 2 },
    };

    return (
        <div className="card" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* ── Header ── */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.8rem', margin: 0 }}>
                    🤖 AutoLab
                </h2>
                <p style={{ color: '#666', marginTop: '0.4rem', fontSize: '1.05rem' }}>
                    AI-Powered Automated Analysis — Upload, Instruct, Get Results
                </p>
            </div>

            {/* ── Two-column layout ── */}
            <div style={{ display: 'grid', gridTemplateColumns: steps.length > 0 ? '1fr 1fr' : '1fr', gap: '2rem' }}>

                {/* ═══ LEFT: Input Panel ═══ */}
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
                                if (f) setFile(f);
                            }}
                            style={{
                                border: '2px dashed #1565c0',
                                borderRadius: '10px',
                                padding: '1.5rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: file ? '#e8f5e9' : '#e3f2fd',
                                transition: 'all 0.2s',
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
                            ref={fileRef}
                            type="file"
                            accept=".xlsx,.xls,.csv,.tsv,.ods,.dat,.txt"
                            onChange={e => setFile(e.target.files?.[0] || null)}
                            style={{ display: 'none' }}
                        />
                    </div>

                    {/* Instructions */}
                    <div className="form-group">
                        <label style={{ fontWeight: 600, fontSize: '1rem' }}>📝 Instructions</label>
                        <textarea
                            value={instructions}
                            onChange={e => setInstructions(e.target.value)}
                            rows={5}
                            placeholder="Describe your analysis in plain language. For example:&#10;&#10;&quot;Use sheet 2, columns 1-4 are x, δx, y, δy. Fit a sinusoidal model. Calculate amplitude × omega² from the fit. Compare to 42.0 ± 2.0.&quot;"
                            style={{ fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: 1.5 }}
                        />
                    </div>

                    {/* Quick fill examples */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        {EXAMPLE_INSTRUCTIONS.map(ex => (
                            <button key={ex.label} className="btn-accent"
                                onClick={() => setInstructions(ex.text)}
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}>
                                {ex.label}
                            </button>
                        ))}
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
                                    placeholder="e.g. 42.0"
                                    style={{ fontFamily: 'monospace' }} />
                            </div>
                            <div className="form-group" style={{ flex: 1, margin: 0 }}>
                                <label>Uncertainty</label>
                                <input type="text" value={theoUnc}
                                    onChange={e => setTheoUnc(e.target.value)}
                                    placeholder="e.g. 2.0"
                                    style={{ fontFamily: 'monospace' }} />
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
                            cursor: running ? 'wait' : 'pointer',
                            transition: 'all 0.3s',
                        }}
                    >
                        {running ? (
                            <span>⏳ AI is analyzing… please wait</span>
                        ) : (
                            <span>🚀 Run AutoLab</span>
                        )}
                    </button>

                    {error && (
                        <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>
                    )}
                </div>

                {/* ═══ RIGHT: Results Panel ═══ */}
                {steps.length > 0 && (
                    <div>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1565c0' }}>
                            📊 Results
                        </h3>

                        {/* Step-by-step results */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {steps.map((s, i) => (
                                <div key={i} style={{
                                    padding: '0.8rem 1rem',
                                    borderRadius: '10px',
                                    border: `2px solid ${s.success === false ? '#ef9a9a' : '#a5d6a7'}`,
                                    background: s.success === false ? '#ffebee' : '#e8f5e9',
                                }}>
                                    <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>
                                        {stepIcon(s)} {stepLabel(s)}
                                    </div>

                                    {/* Parse result */}
                                    {s.step === 'parse' && s.result && !s.result.error && (
                                        <div style={{ fontSize: '0.88rem', color: '#555' }}>
                                            <p>Columns: {s.result.columns?.join(', ')}</p>
                                            <p>Rows: {s.result.num_rows}</p>
                                            {s.result.x_col && <p>X: <strong>{s.result.x_col}</strong></p>}
                                            {s.result.y_col && <p>Y: <strong>{s.result.y_col}</strong></p>}
                                            {s.result.y_err_col && <p>Y error: <strong>{s.result.y_err_col}</strong></p>}
                                            {s.result.x_err_col && <p>X error: <strong>{s.result.x_err_col}</strong></p>}
                                        </div>
                                    )}

                                    {/* Fit result */}
                                    {s.step === 'fit' && s.result && !s.result.error && (
                                        <div style={{ fontSize: '0.88rem', color: '#555' }}>
                                            <p>Model: <strong>{s.result.model_name}</strong></p>
                                            {s.result.parameter_names && s.result.parameters && (
                                                <table style={{ width: '100%', fontSize: '0.85rem', marginTop: '0.4rem' }}>
                                                    <thead>
                                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                                                            <th>Param</th><th>Value</th><th>± Uncertainty</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(s.result.parameter_names as string[]).map((name: string, j: number) => (
                                                            <tr key={name}>
                                                                <td><strong>{name}</strong></td>
                                                                <td>{typeof s.result!.parameters[j] === 'number'
                                                                    ? (s.result!.parameters[j] as number).toFixed(6) : s.result!.parameters[j]}</td>
                                                                <td>{typeof s.result!.uncertainties?.[j] === 'number'
                                                                    ? (s.result!.uncertainties[j] as number).toFixed(6) : s.result!.uncertainties?.[j]}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                            <div style={{ marginTop: '0.4rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                {s.result.reduced_chi_squared != null && (
                                                    <span>χ²/dof = <strong>{Number(s.result.reduced_chi_squared).toFixed(4)}</strong></span>
                                                )}
                                                {s.result.p_value != null && (
                                                    <span>P = <strong>{Number(s.result.p_value).toFixed(4)}</strong></span>
                                                )}
                                                {s.result.dof != null && (
                                                    <span>dof = <strong>{s.result.dof}</strong></span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Formula result */}
                                    {s.step === 'formula' && s.result && !s.result.error && (
                                        <div style={{ fontSize: '0.9rem' }}>
                                            <p style={{ fontFamily: 'monospace' }}>
                                                {s.args?.expression} = <strong>{s.result.formatted}</strong>
                                            </p>
                                        </div>
                                    )}

                                    {/* N-sigma result */}
                                    {s.step === 'nsigma' && s.result && !s.result.error && (
                                        <div style={{ fontSize: '0.9rem' }}>
                                            <p>
                                                N-σ = <strong style={{
                                                    color: s.result.n_sigma <= 3 ? '#2e7d32' : '#c62828',
                                                    fontSize: '1.1rem',
                                                }}>{s.result.n_sigma}</strong>
                                                &nbsp;— {s.result.verdict}
                                            </p>
                                        </div>
                                    )}

                                    {/* Summary */}
                                    {s.step === 'summary' && s.message && (
                                        <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                            {s.message}
                                        </div>
                                    )}

                                    {/* Error */}
                                    {s.result?.error && (
                                        <div style={{ color: '#c62828', fontSize: '0.85rem' }}>
                                            Error: {s.result.error}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ FIT PLOT (full width below the grid) ═══ */}
            {fitData && fitData.x_data && (
                <div style={{ marginTop: '2rem' }}>
                    <h3 style={{ color: '#1565c0' }}>📉 Fit Plot</h3>
                    <Plot
                        data={[
                            {
                                x: fitData.x_data,
                                y: fitData.y_data,
                                error_y: fitData.y_errors ? {
                                    type: 'data' as const, array: fitData.y_errors,
                                    visible: true, color: '#1565c0', thickness: 1.5,
                                } : undefined,
                                type: 'scatter' as const,
                                mode: 'markers' as const,
                                name: 'Data',
                                marker: { size: 6, color: '#1565c0' },
                            },
                            {
                                x: fitData.x_fit,
                                y: fitData.y_fit,
                                type: 'scatter' as const,
                                mode: 'lines' as const,
                                name: `Fit (${fitData.model_name})`,
                                line: { width: 2.5, color: '#d32f2f' },
                            },
                        ]}
                        layout={{
                            title: { text: `AutoLab Fit — ${fitData.model_name}` },
                            xaxis: { title: { text: 'X' }, gridcolor: '#e0e0e0' },
                            yaxis: { title: { text: 'Y' }, gridcolor: '#e0e0e0' },
                            height: 420,
                            margin: { l: 60, r: 30, t: 55, b: 55 },
                            legend: { x: 0, y: 1.15, orientation: 'h' as const },
                            plot_bgcolor: '#fafafa',
                            paper_bgcolor: '#fff',
                        }}
                        useResizeHandler
                        style={{ width: '100%' }}
                        config={plotConfig}
                    />

                    {/* Residuals */}
                    {fitData.residuals && (
                        <Plot
                            data={[{
                                x: fitData.x_data,
                                y: fitData.residuals,
                                type: 'scatter' as const,
                                mode: 'markers' as const,
                                name: 'Residuals',
                                marker: { size: 5, color: '#7b1fa2' },
                            }, {
                                x: [Math.min(...fitData.x_data), Math.max(...fitData.x_data)],
                                y: [0, 0],
                                type: 'scatter' as const,
                                mode: 'lines' as const,
                                name: 'Zero',
                                line: { width: 1, color: '#999', dash: 'dash' },
                                showlegend: false,
                            }]}
                            layout={{
                                title: { text: 'Residuals' },
                                xaxis: { title: { text: 'X' }, gridcolor: '#e0e0e0' },
                                yaxis: { title: { text: 'y - f(x)' }, gridcolor: '#e0e0e0' },
                                height: 280,
                                margin: { l: 60, r: 30, t: 45, b: 45 },
                                plot_bgcolor: '#fafafa',
                                paper_bgcolor: '#fff',
                            }}
                            useResizeHandler
                            style={{ width: '100%' }}
                            config={plotConfig}
                        />
                    )}

                    <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        📷 Use the camera icon on each plot to download as PNG.
                    </p>
                </div>
            )}
        </div>
    );
}

export default AutoLab;
