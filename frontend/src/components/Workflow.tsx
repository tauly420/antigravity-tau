import { useState, useRef } from 'react';
import Plot from 'react-plotly.js';
import * as api from '../services/api';
import FormulaCalculator from './FormulaCalculator';
import NSigmaCalculator from './NSigmaCalculator';
// @ts-ignore - plotly.js types
import Plotly from 'plotly.js';

/* ─── types ─── */
interface FileInfo {
    sheetNames: string[];
    sheetsInfo: Record<string, string[]>;
}
interface ParsedData {
    columns: string[];
    rows: Record<string, any>[];
}
interface FitResult {
    parameters: number[];
    uncertainties: number[];
    parameter_names: string[];
    r_squared: number;
    chi_squared: number;
    model_name: string;
    x_fit: number[];
    y_fit: number[];
    residuals: number[];
}
interface FormulaResult { value: number; uncertainty: number }

/* stepper labels */
const STEPS = ['Upload Data', 'Select Columns', 'Fit & Plot', 'Calculate', 'Compare N-σ'] as const;
type Step = 0 | 1 | 2 | 3 | 4;

const MODELS = [
    { value: 'linear', label: 'Linear  (a·x + b)' },
    { value: 'quadratic', label: 'Quadratic  (a·x² + b·x + c)' },
    { value: 'cubic', label: 'Cubic  (a·x³ + …)' },
    { value: 'power', label: 'Power  (a·x^b)' },
    { value: 'exponential', label: 'Exponential  (a·exp(b·x))' },
    { value: 'sinusoidal', label: 'Sinusoidal  (A·sin(ω·x + φ) + D)' },
    { value: 'custom', label: 'Custom expression' },
];

function Workflow() {
    /* ── step state ── */
    const [step, setStep] = useState<Step>(0);

    /* step 1 – upload */
    const [file, setFile] = useState<File | null>(null);
    const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [uploadError, setUploadError] = useState('');
    const [uploading, setUploading] = useState(false);

    /* step 2 – columns */
    const [xCol, setXCol] = useState('');
    const [yCol, setYCol] = useState('');
    const [xErrCol, setXErrCol] = useState('None');
    const [yErrCol, setYErrCol] = useState('None');
    const [xLabel, setXLabel] = useState('');
    const [yLabel, setYLabel] = useState('');
    const [plotTitle, setPlotTitle] = useState('');

    /* step 3 – fit */
    const [model, setModel] = useState('linear');
    const [customExpr, setCustomExpr] = useState('');
    const [fitResult, setFitResult] = useState<FitResult | null>(null);
    const [fitError, setFitError] = useState('');
    const [fitting, setFitting] = useState(false);
    const mainPlotRef = useRef<HTMLDivElement>(null);
    const residualPlotRef = useRef<HTMLDivElement>(null);

    /* step 4 – formula linked result */
    const [formulaResult, setFormulaResult] = useState<FormulaResult | null>(null);

    /* ──────── STEP 1: Upload ──────── */
    const handleFileSelect = async (f: File) => {
        setFile(f);
        setUploadError('');
        setUploading(true);
        try {
            if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) {
                const info = await api.parseFileInfo(f);
                setFileInfo({
                    sheetNames: info.sheet_names,
                    sheetsInfo: info.sheets_info,
                });
                if (info.sheet_names.length > 0) setSelectedSheet(info.sheet_names[0]);
            } else {
                // CSV — go straight to loading data
                const data = await api.parseFileData(f);
                setParsedData({ columns: data.columns, rows: data.rows });
                setFileInfo({ sheetNames: ['Sheet1'], sheetsInfo: { Sheet1: data.columns } });
                setSelectedSheet('Sheet1');
            }
        } catch (err: any) {
            setUploadError(err.response?.data?.error || err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const loadSheet = async () => {
        if (!file || !selectedSheet) return;
        setUploading(true);
        setUploadError('');
        try {
            const data = await api.parseFileData(file, selectedSheet);
            setParsedData({ columns: data.columns, rows: data.rows });
            // Auto-select first two numeric columns
            if (data.columns.length >= 2) {
                setXCol(data.columns[0]);
                setYCol(data.columns[1]);
                setXLabel(data.columns[0]);
                setYLabel(data.columns[1]);
            }
            setStep(1);
        } catch (err: any) {
            setUploadError(err.response?.data?.error || err.message || 'Failed to load sheet');
        } finally {
            setUploading(false);
        }
    };

    /* ──────── STEP 3: Fit ──────── */
    const handleFit = async () => {
        if (!parsedData || !xCol || !yCol) return;
        setFitting(true);
        setFitError('');
        setFitResult(null);

        try {
            const xData = parsedData.rows.map(r => Number(r[xCol])).filter(v => !isNaN(v));
            const yData = parsedData.rows.map(r => Number(r[yCol])).filter(v => !isNaN(v));
            const yErrors = yErrCol !== 'None'
                ? parsedData.rows.map(r => Number(r[yErrCol])).filter(v => !isNaN(v))
                : undefined;

            const payload: any = {
                x_data: xData,
                y_data: yData,
                model,
            };
            if (yErrors && yErrors.length === yData.length) payload.y_errors = yErrors;
            if (model === 'custom') payload.custom_expr = customExpr;

            const result = await api.fitData(payload);
            if (result.error) throw new Error(result.error);
            setFitResult(result);
        } catch (err: any) {
            setFitError(err.response?.data?.error || err.message || 'Fitting failed');
        } finally {
            setFitting(false);
        }
    };

    /* ──────── download plot ──────── */
    const downloadPlot = async (plotDiv: HTMLDivElement | null, filename: string) => {
        if (!plotDiv) return;
        const gd = plotDiv.querySelector('.js-plotly-plot') as any;
        if (gd) {
            await Plotly.downloadImage(gd, { format: 'png', width: 1200, height: 800, filename });
        }
    };

    /* ──────── build prefilled map for formula ──────── */
    const fitPrefilled = (): Record<string, { value: number; uncertainty: number }> => {
        if (!fitResult) return {};
        const map: Record<string, { value: number; uncertainty: number }> = {};
        fitResult.parameter_names.forEach((name, i) => {
            map[name] = {
                value: fitResult.parameters[i],
                uncertainty: fitResult.uncertainties[i],
            };
        });
        return map;
    };

    /* ──────── helpers for plot data ──────── */
    const getPlotData = () => {
        if (!parsedData || !fitResult) return [];
        const xData = parsedData.rows.map(r => Number(r[xCol]));
        const yData = parsedData.rows.map(r => Number(r[yCol]));
        const traces: any[] = [
            {
                x: xData,
                y: yData,
                mode: 'markers' as const,
                type: 'scatter' as const,
                name: 'Data',
                marker: { color: '#1976d2', size: 7 },
                error_y: yErrCol !== 'None' ? {
                    type: 'data' as const,
                    array: parsedData.rows.map(r => Number(r[yErrCol])),
                    visible: true
                } : undefined,
                error_x: xErrCol !== 'None' ? {
                    type: 'data' as const,
                    array: parsedData.rows.map(r => Number(r[xErrCol])),
                    visible: true
                } : undefined,
            },
            {
                x: fitResult.x_fit,
                y: fitResult.y_fit,
                mode: 'lines' as const,
                name: fitResult.model_name,
                line: { color: '#d32f2f', width: 2.5 },
            },
        ];
        return traces;
    };

    const getResidualData = () => {
        if (!parsedData || !fitResult) return [];
        const xData = parsedData.rows.map(r => Number(r[xCol]));
        return [{
            x: xData,
            y: fitResult.residuals,
            mode: 'markers' as const,
            type: 'scatter' as const,
            name: 'Residuals',
            marker: { color: '#ff7043', size: 6 },
        }];
    };

    /* ──────── RENDER ──────── */
    return (
        <div className="card">
            <h2>Lab Workflow</h2>

            {/* stepper bar */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '2rem', overflowX: 'auto' }}>
                {STEPS.map((label, i) => (
                    <button
                        key={i}
                        onClick={() => { if (i <= step || (i === step + 1)) setStep(i as Step); }}
                        style={{
                            flex: 1,
                            padding: '0.6rem 0.4rem',
                            background: i === step ? 'var(--primary)' : i < step ? '#c8e6c9' : '#eee',
                            color: i === step ? '#fff' : i < step ? '#2e7d32' : '#666',
                            border: 'none',
                            fontWeight: i === step ? 700 : 400,
                            cursor: 'pointer',
                            borderRadius: i === 0 ? '6px 0 0 6px' : i === STEPS.length - 1 ? '0 6px 6px 0' : '0',
                            fontSize: '0.85rem',
                            whiteSpace: 'nowrap',
                            transition: 'background 0.2s',
                        }}
                    >
                        {i + 1}. {label}
                    </button>
                ))}
            </div>

            {/* ─── Step 0: Upload ─── */}
            {step === 0 && (
                <div>
                    <h3>Step 1 — Upload Excel / CSV</h3>
                    <div className="form-group">
                        <label>Choose file</label>
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                        />
                    </div>

                    {uploading && <p>Loading file…</p>}
                    {uploadError && <div className="error-message">{uploadError}</div>}

                    {fileInfo && fileInfo.sheetNames.length > 1 && (
                        <div className="form-group">
                            <label>Select sheet</label>
                            <select value={selectedSheet} onChange={e => setSelectedSheet(e.target.value)}>
                                {fileInfo.sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}

                    {fileInfo && (
                        <div style={{ marginTop: '0.5rem' }}>
                            <p style={{ color: '#666' }}>
                                Sheets: {fileInfo.sheetNames.join(', ')}
                                {selectedSheet && fileInfo.sheetsInfo[selectedSheet] && (
                                    <> — Columns: {fileInfo.sheetsInfo[selectedSheet].join(', ')}</>
                                )}
                            </p>
                            <button onClick={loadSheet} disabled={uploading} style={{ marginTop: '1rem' }}>
                                Load Data & Continue →
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Step 1: Column selection ─── */}
            {step === 1 && parsedData && (
                <div>
                    <h3>Step 2 — Choose Columns & Name Axes</h3>
                    <p style={{ color: '#666', marginBottom: '1rem' }}>
                        {parsedData.rows.length} rows loaded. Choose which columns to plot.
                    </p>

                    <div className="grid grid-2">
                        <div className="form-group">
                            <label>X column</label>
                            <select value={xCol} onChange={e => { setXCol(e.target.value); if (!xLabel) setXLabel(e.target.value); }}>
                                <option value="">— select —</option>
                                {parsedData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Y column</label>
                            <select value={yCol} onChange={e => { setYCol(e.target.value); if (!yLabel) setYLabel(e.target.value); }}>
                                <option value="">— select —</option>
                                {parsedData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>X error column (optional)</label>
                            <select value={xErrCol} onChange={e => setXErrCol(e.target.value)}>
                                <option value="None">None</option>
                                {parsedData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Y error column (optional)</label>
                            <select value={yErrCol} onChange={e => setYErrCol(e.target.value)}>
                                <option value="None">None</option>
                                {parsedData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-3" style={{ marginTop: '1rem' }}>
                        <div className="form-group">
                            <label>X axis name</label>
                            <input value={xLabel} onChange={e => setXLabel(e.target.value)} placeholder="e.g. Time [s]" />
                        </div>
                        <div className="form-group">
                            <label>Y axis name</label>
                            <input value={yLabel} onChange={e => setYLabel(e.target.value)} placeholder="e.g. Distance [m]" />
                        </div>
                        <div className="form-group">
                            <label>Plot title</label>
                            <input value={plotTitle} onChange={e => setPlotTitle(e.target.value)} placeholder="e.g. Position vs Time" />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button onClick={() => setStep(0)} style={{ background: '#666' }}>← Back</button>
                        <button onClick={() => setStep(2)} disabled={!xCol || !yCol}>Continue to Fit →</button>
                    </div>
                </div>
            )}

            {/* ─── Step 2: Fit ─── */}
            {step === 2 && (
                <div>
                    <h3>Step 3 — Curve Fitting</h3>

                    <div className="grid grid-2">
                        <div className="form-group">
                            <label>Fit model</label>
                            <select value={model} onChange={e => setModel(e.target.value)}>
                                {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        {model === 'custom' && (
                            <div className="form-group">
                                <label>Custom expression (use <code>x</code> as variable)</label>
                                <input
                                    value={customExpr}
                                    onChange={e => setCustomExpr(e.target.value)}
                                    placeholder="e.g. a*sin(b*x) + c*x**2"
                                    style={{ fontFamily: 'monospace' }}
                                />
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button onClick={() => setStep(1)} style={{ background: '#666' }}>← Back</button>
                        <button onClick={handleFit} disabled={fitting}>
                            {fitting ? 'Fitting…' : 'Run Fit'}
                        </button>
                    </div>

                    {fitError && <div className="error-message" style={{ marginTop: '1rem' }}>{fitError}</div>}

                    {fitResult && (
                        <>
                            {/* Parameters table */}
                            <div style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
                                <h4>Fit Parameters — {fitResult.model_name}</h4>
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f5f5f5' }}>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Param</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Value</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #ddd' }}>± Uncertainty</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fitResult.parameter_names.map((name, i) => (
                                            <tr key={name}>
                                                <td style={{ padding: '0.4rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{name}</td>
                                                <td style={{ padding: '0.4rem', textAlign: 'right', fontFamily: 'monospace' }}>{fitResult.parameters[i].toExponential(4)}</td>
                                                <td style={{ padding: '0.4rem', textAlign: 'right', fontFamily: 'monospace' }}>{fitResult.uncertainties[i].toExponential(4)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                    R² = {fitResult.r_squared.toFixed(6)} &nbsp;|&nbsp; χ²/dof = {fitResult.chi_squared.toFixed(4)}
                                </p>
                            </div>

                            {/* Main plot */}
                            <div ref={mainPlotRef} style={{ marginTop: '1.5rem' }}>
                                <Plot
                                    data={getPlotData()}
                                    layout={{
                                        title: { text: plotTitle || 'Data + Fit' },
                                        xaxis: { title: { text: xLabel || 'X' } },
                                        yaxis: { title: { text: yLabel || 'Y' } },
                                        height: 450,
                                        legend: { x: 0, y: 1.15, orientation: 'h' as const },
                                        margin: { l: 60, r: 30, t: 50, b: 60 },
                                    }}
                                    useResizeHandler
                                    style={{ width: '100%' }}
                                    config={{ responsive: true }}
                                />
                            </div>

                            {/* Residuals plot */}
                            <div ref={residualPlotRef} style={{ marginTop: '1rem' }}>
                                <Plot
                                    data={getResidualData()}
                                    layout={{
                                        title: { text: 'Residuals' },
                                        xaxis: { title: { text: xLabel || 'X' } },
                                        yaxis: { title: { text: 'Residual (data − fit)' } },
                                        height: 300,
                                        margin: { l: 60, r: 30, t: 40, b: 50 },
                                        shapes: [{
                                            type: 'line',
                                            x0: 0, x1: 1, xref: 'paper',
                                            y0: 0, y1: 0,
                                            line: { color: '#888', width: 1, dash: 'dash' }
                                        }],
                                    }}
                                    useResizeHandler
                                    style={{ width: '100%' }}
                                    config={{ responsive: true }}
                                />
                            </div>

                            {/* Download buttons */}
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                                <button onClick={() => downloadPlot(mainPlotRef.current, plotTitle || 'fit_plot')} style={{ background: '#1976d2' }}>
                                    📥 Download Plot
                                </button>
                                <button onClick={() => downloadPlot(residualPlotRef.current, 'residuals')} style={{ background: '#1976d2' }}>
                                    📥 Download Residuals
                                </button>
                                <button onClick={() => setStep(3)} style={{ marginLeft: 'auto' }}>
                                    Continue to Formula →
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ─── Step 3: Formula calculator (embedded) ─── */}
            {step === 3 && (
                <div>
                    <h3>Step 4 — Formula Calculator</h3>
                    <p style={{ color: '#666', marginBottom: '1rem' }}>
                        Fit parameters are auto-loaded below. Add your expression and any extra variables.
                    </p>

                    <FormulaCalculator
                        embedded
                        prefilled={fitPrefilled()}
                        onResult={(val, unc) => setFormulaResult({ value: val, uncertainty: unc })}
                    />

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button onClick={() => setStep(2)} style={{ background: '#666' }}>← Back to Fit</button>
                        <button onClick={() => setStep(4)} disabled={!formulaResult}>
                            Continue to N-σ →
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Step 4: N-Sigma (embedded) ─── */}
            {step === 4 && (
                <div>
                    <h3>Step 5 — N-σ Comparison</h3>
                    {formulaResult && (
                        <div style={{ background: '#e8f5e9', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                            <strong>From formula:</strong>{' '}
                            {formulaResult.value.toExponential(4)} ± {formulaResult.uncertainty.toExponential(4)}
                        </div>
                    )}

                    <NSigmaCalculator
                        prefilled1={formulaResult ? { value: formulaResult.value, uncertainty: formulaResult.uncertainty } : undefined}
                    />

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button onClick={() => setStep(3)} style={{ background: '#666' }}>← Back</button>
                        <button onClick={() => { setStep(0); setFitResult(null); setFormulaResult(null); setParsedData(null); setFile(null); setFileInfo(null); }}>
                            🔄 Start New Workflow
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Workflow;
