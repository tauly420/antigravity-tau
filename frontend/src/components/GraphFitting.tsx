import { useState, useEffect } from 'react';
import Plot from './PlotWrapper';
import * as api from '../services/api';
import { useAnalysis } from '../context/AnalysisContext';
import { smartFormat, formatPValue } from '../utils/format';

/* ─── types ─── */
interface ParsedData {
    columns: string[];
    rows: Record<string, any>[];
    sheetNames: string[];
}

interface FitResult {
    parameters: number[];
    uncertainties: number[];
    parameter_names: string[];
    r_squared: number;
    chi_squared: number;
    reduced_chi_squared: number;
    p_value: number | null;
    dof: number;
    n_data: number;
    n_params: number;
    model_name: string;
    x_fit: number[];
    y_fit: number[];
    residuals: number[];
}

const MODELS = [
    { value: 'linear', label: 'Linear  (a·x + b)' },
    { value: 'quadratic', label: 'Quadratic  (a·x² + b·x + c)' },
    { value: 'cubic', label: 'Cubic  (a·x³ + …)' },
    { value: 'power', label: 'Power  (a·xᵇ)' },
    { value: 'exponential', label: 'Exponential  (a·exp(b·x))' },
    { value: 'sinusoidal', label: 'Sinusoidal  (A·sin(ω·x + φ) + D)' },
    { value: 'custom', label: 'Custom expression' },
];

/* Example data: Hooke's Law */
const EXAMPLE_DATA = {
    name: "Hooke's Law (F = k·x)",
    columns: ['Extension (m)', 'Force (N)', 'Force Error (N)', 'Extension Error (m)'],
    rows: [
        { 'Extension (m)': 0.01, 'Force (N)': 0.51, 'Force Error (N)': 0.05, 'Extension Error (m)': 0.001 },
        { 'Extension (m)': 0.02, 'Force (N)': 0.98, 'Force Error (N)': 0.05, 'Extension Error (m)': 0.001 },
        { 'Extension (m)': 0.03, 'Force (N)': 1.52, 'Force Error (N)': 0.06, 'Extension Error (m)': 0.001 },
        { 'Extension (m)': 0.04, 'Force (N)': 2.05, 'Force Error (N)': 0.06, 'Extension Error (m)': 0.001 },
        { 'Extension (m)': 0.05, 'Force (N)': 2.48, 'Force Error (N)': 0.07, 'Extension Error (m)': 0.001 },
        { 'Extension (m)': 0.06, 'Force (N)': 3.02, 'Force Error (N)': 0.07, 'Extension Error (m)': 0.001 },
        { 'Extension (m)': 0.07, 'Force (N)': 3.55, 'Force Error (N)': 0.08, 'Extension Error (m)': 0.001 },
        { 'Extension (m)': 0.08, 'Force (N)': 4.01, 'Force Error (N)': 0.08, 'Extension Error (m)': 0.001 },
        { 'Extension (m)': 0.09, 'Force (N)': 4.53, 'Force Error (N)': 0.09, 'Extension Error (m)': 0.001 },
        { 'Extension (m)': 0.10, 'Force (N)': 5.05, 'Force Error (N)': 0.09, 'Extension Error (m)': 0.001 },
    ],
};

function GraphFitting() {
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [fileInfo, setFileInfo] = useState<{ sheetNames: string[]; sheetsInfo: Record<string, string[]> } | null>(null);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const [xCol, setXCol] = useState('');
    const [yCol, setYCol] = useState('');
    const [xErrCol, setXErrCol] = useState('None');
    const [yErrCol, setYErrCol] = useState('None');
    const [xLabel, setXLabel] = useState('');
    const [yLabel, setYLabel] = useState('');
    const [plotTitle, setPlotTitle] = useState('');

    const [model, setModel] = useState('linear');
    const [customExpr, setCustomExpr] = useState('');
    const [initialGuess, setInitialGuess] = useState('');
    const [result, setResult] = useState<FitResult | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const { setLastResult, setCurrentTool, setCurrentData, addToHistory } = useAnalysis();

    useEffect(() => { setCurrentTool('Curve Fitting'); }, []);

    /* Example data loader */
    const loadExample = () => {
        setParsedData({ columns: EXAMPLE_DATA.columns, rows: EXAMPLE_DATA.rows, sheetNames: ['Example'] });
        setXCol(EXAMPLE_DATA.columns[0]);
        setYCol(EXAMPLE_DATA.columns[1]);
        setYErrCol(EXAMPLE_DATA.columns[2]);
        setXErrCol(EXAMPLE_DATA.columns[3]);
        setXLabel('Extension [m]');
        setYLabel('Force [N]');
        setPlotTitle("Hooke's Law — Force vs Extension");
        setModel('linear');
    };

    /* File upload */
    const handleFileSelect = async (f: File) => {
        setFile(f);
        setError('');
        setUploading(true);
        try {
            if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) {
                const info = await api.parseFileInfo(f);
                setFileInfo({ sheetNames: info.sheet_names, sheetsInfo: info.sheets_info });
                if (info.sheet_names.length > 0) setSelectedSheet(info.sheet_names[0]);
                // If only one sheet, auto-load
                if (info.sheet_names.length === 1) {
                    const data = await api.parseFileData(f, info.sheet_names[0]);
                    setParsedData({ columns: data.columns, rows: data.rows, sheetNames: info.sheet_names });
                    autoSelectCols(data.columns);
                }
            } else {
                const data = await api.parseFileData(f);
                setParsedData({ columns: data.columns, rows: data.rows, sheetNames: ['Sheet1'] });
                autoSelectCols(data.columns);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const loadSheet = async () => {
        if (!file || !selectedSheet) return;
        setUploading(true);
        try {
            const data = await api.parseFileData(file, selectedSheet);
            setParsedData({ columns: data.columns, rows: data.rows, sheetNames: fileInfo?.sheetNames || [] });
            autoSelectCols(data.columns);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to load sheet');
        } finally {
            setUploading(false);
        }
    };

    const autoSelectCols = (cols: string[]) => {
        if (cols.length >= 2) {
            setXCol(cols[0]);
            setYCol(cols[1]);
            setXLabel(cols[0]);
            setYLabel(cols[1]);
        }
    };

    /* Fit */
    const handleFit = async () => {
        if (!parsedData || !xCol || !yCol) return;
        setError('');
        setResult(null);
        setLoading(true);

        try {
            const xData = parsedData.rows.map(r => Number(r[xCol])).filter(v => !isNaN(v));
            const yData = parsedData.rows.map(r => Number(r[yCol])).filter(v => !isNaN(v));
            const yErrors = yErrCol !== 'None' ? parsedData.rows.map(r => Number(r[yErrCol])).filter(v => !isNaN(v)) : undefined;

            if (xData.length !== yData.length) throw new Error(`X has ${xData.length} pts, Y has ${yData.length}`);
            if (xData.length < 2) throw new Error('Need at least 2 data points');

            setCurrentData({ xData, yData, yErrors });

            const payload: any = {
                x_data: xData,
                y_data: yData,
                model,
            };
            if (yErrors && yErrors.length === yData.length) payload.y_errors = yErrors;
            if (model === 'custom') {
                payload.custom_expr = customExpr;
                const guess = initialGuess ? initialGuess.split(/[,\s]+/).map(parseFloat).filter(n => !isNaN(n)) : undefined;
                if (guess) payload.initial_guess = guess;
            }

            const response = await api.fitData(payload);
            if (response.error) throw new Error(response.error);
            setResult(response);
            setLastResult(response);
            addToHistory(`Fitted ${model} model`);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Fitting failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src="/graph.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                Graph & Curve Fitting
            </h2>

            {/* ─── Data Source ─── */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <button className="btn-accent" onClick={loadExample}>🧪 Load Example: Hooke's Law</button>
                </div>

                <div className="form-group">
                    <label>Upload Excel / CSV</label>
                    <input type="file" accept=".xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.dat,.txt" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                </div>

                {uploading && <div className="loading-spinner">Loading…</div>}

                {fileInfo && fileInfo.sheetNames.length > 1 && (
                    <div className="form-group">
                        <label>Select sheet</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select value={selectedSheet} onChange={e => setSelectedSheet(e.target.value)} style={{ flex: 1 }}>
                                {fileInfo.sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button onClick={loadSheet} className="btn-primary">Load</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Column Selection ─── */}
            {parsedData && (
                <>
                    <h3>Column Selection ({parsedData.rows.length} rows)</h3>
                    <div className="grid grid-2">
                        <div className="form-group">
                            <label>X column</label>
                            <select value={xCol} onChange={e => { setXCol(e.target.value); setXLabel(e.target.value); }}>
                                <option value="">— select —</option>
                                {parsedData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Y column</label>
                            <select value={yCol} onChange={e => { setYCol(e.target.value); setYLabel(e.target.value); }}>
                                <option value="">— select —</option>
                                {parsedData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>X error <span style={{ opacity: 0.5 }}>(opt.)</span></label>
                            <select value={xErrCol} onChange={e => setXErrCol(e.target.value)}>
                                <option value="None">None</option>
                                {parsedData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Y error <span style={{ opacity: 0.5 }}>(opt.)</span></label>
                            <select value={yErrCol} onChange={e => setYErrCol(e.target.value)}>
                                <option value="None">None</option>
                                {parsedData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-3" style={{ marginTop: '0.75rem' }}>
                        <div className="form-group"><label>X axis label</label><input value={xLabel} onChange={e => setXLabel(e.target.value)} placeholder="e.g. Time [s]" /></div>
                        <div className="form-group"><label>Y axis label</label><input value={yLabel} onChange={e => setYLabel(e.target.value)} placeholder="e.g. Distance [m]" /></div>
                        <div className="form-group"><label>Plot title</label><input value={plotTitle} onChange={e => setPlotTitle(e.target.value)} placeholder="e.g. Force vs Extension" /></div>
                    </div>
                </>
            )}

            {/* ─── Fit Controls ─── */}
            {parsedData && (
                <>
                    <h3 style={{ marginTop: '1.5rem' }}>Fit Model</h3>
                    <div className="grid grid-2">
                        <div className="form-group">
                            <label>Model</label>
                            <select value={model} onChange={e => setModel(e.target.value)}>
                                {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        {model === 'custom' && (
                            <div className="form-group">
                                <label>Custom expression (use <code>x</code>)</label>
                                <input type="text" value={customExpr} onChange={e => setCustomExpr(e.target.value)} placeholder="a*sin(b*x) + c" style={{ fontFamily: 'monospace' }} />
                            </div>
                        )}
                    </div>
                    {model === 'custom' && (
                        <div className="form-group">
                            <label>Initial guess (comma-separated)</label>
                            <input type="text" value={initialGuess} onChange={e => setInitialGuess(e.target.value)} placeholder="1.0, 1.0, 0.0" />
                        </div>
                    )}

                    <button onClick={handleFit} disabled={loading || !xCol || !yCol} style={{ marginTop: '1rem' }}>
                        {loading ? '⏳ Fitting…' : '▶ Fit Data'}
                    </button>
                </>
            )}

            {error && <div className="error-message">{error}</div>}

            {/* ─── Results ─── */}
            {result && parsedData && (
                <div style={{ marginTop: '1.5rem' }}>
                    <div className="params-table-wrap">
                        <h4>Fit Parameters — {result.model_name}</h4>
                        <table className="params-table">
                            <thead><tr><th>Param</th><th>Value</th><th>± Uncertainty</th></tr></thead>
                            <tbody>
                                {result.parameter_names.map((name: string, i: number) => (
                                    <tr key={name}>
                                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{name}</td>
                                        <td style={{ fontFamily: 'monospace' }}>{smartFormat(result.parameters[i])}</td>
                                        <td style={{ fontFamily: 'monospace' }}>{smartFormat(result.uncertainties[i])}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="params-table-wrap" style={{ marginTop: '1rem' }}>
                        <h4>Goodness of Fit</h4>
                        <table className="params-table">
                            <tbody>
                                <tr><td>R²</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{result.r_squared.toFixed(6)}</td></tr>
                                <tr><td>χ²</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{smartFormat(result.chi_squared)}</td></tr>
                                <tr><td>χ²/dof (reduced)</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{smartFormat(result.reduced_chi_squared)}</td></tr>
                                <tr><td>P-value</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{formatPValue(result.p_value)}</td></tr>
                                <tr><td>Degrees of freedom</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{result.dof}</td></tr>
                                <tr><td>Data points / Parameters</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{result.n_data} / {result.n_params}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <Plot
                        data={[
                            {
                                x: parsedData.rows.map(r => Number(r[xCol])),
                                y: parsedData.rows.map(r => Number(r[yCol])),
                                mode: 'markers' as const,
                                type: 'scatter' as const,
                                name: 'Data',
                                marker: { color: '#1976d2', size: 8, line: { width: 1, color: '#0d47a1' } },
                                error_y: yErrCol !== 'None' ? { type: 'data' as const, array: parsedData.rows.map(r => Number(r[yErrCol])), visible: true, color: '#1976d2', thickness: 1.5 } : undefined,
                                error_x: xErrCol !== 'None' ? { type: 'data' as const, array: parsedData.rows.map(r => Number(r[xErrCol])), visible: true, color: '#1976d2', thickness: 1.5 } : undefined,
                            },
                            {
                                x: result.x_fit,
                                y: result.y_fit,
                                mode: 'lines' as const,
                                name: result.model_name,
                                line: { color: '#d32f2f', width: 2.5 },
                            },
                        ]}
                        layout={{
                            title: { text: plotTitle || 'Curve Fit' },
                            xaxis: { title: { text: xLabel || 'X' }, gridcolor: '#e0e0e0' },
                            yaxis: { title: { text: yLabel || 'Y' }, gridcolor: '#e0e0e0' },
                            height: 500,
                            margin: { l: 65, r: 30, t: 55, b: 60 },
                            legend: { x: 0, y: 1.12, orientation: 'h' as const },
                            plot_bgcolor: '#fafafa',
                            paper_bgcolor: '#fff',
                        }}
                        useResizeHandler
                        style={{ width: '100%' }}
                        config={{ responsive: true, displaylogo: false, toImageButtonOptions: { format: 'png' as any, filename: plotTitle || 'fit', height: 800, width: 1200, scale: 2 } }}
                    />

                    {/* Residuals */}
                    <Plot
                        data={[{
                            x: parsedData.rows.map(r => Number(r[xCol])),
                            y: result.residuals,
                            mode: 'markers' as const,
                            type: 'scatter' as const,
                            name: 'Residuals',
                            marker: { color: '#ff7043', size: 7 },
                            error_y: yErrCol !== 'None' ? { type: 'data' as const, array: parsedData.rows.map(r => Number(r[yErrCol])), visible: true, color: '#ff7043' } : undefined,
                            error_x: xErrCol !== 'None' ? { type: 'data' as const, array: parsedData.rows.map(r => Number(r[xErrCol])), visible: true, color: '#ff7043' } : undefined,
                        }]}
                        layout={{
                            title: { text: 'Residuals' },
                            xaxis: { title: { text: xLabel || 'X' }, gridcolor: '#e0e0e0' },
                            yaxis: { title: { text: 'Residual' }, gridcolor: '#e0e0e0' },
                            height: 280,
                            margin: { l: 65, r: 30, t: 40, b: 55 },
                            plot_bgcolor: '#fafafa',
                            paper_bgcolor: '#fff',
                            shapes: [{ type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 0, y1: 0, line: { color: '#888', width: 1, dash: 'dash' } }],
                        }}
                        useResizeHandler
                        style={{ width: '100%' }}
                        config={{ responsive: true, displaylogo: false }}
                    />
                </div>
            )}
        </div>
    );
}

export default GraphFitting;
