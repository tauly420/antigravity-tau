import { useState, useRef } from 'react';
import Plot from './PlotWrapper';
import * as api from '../services/api';
import FormulaCalculator from './FormulaCalculator';
import NSigmaCalculator from './NSigmaCalculator';

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

const MODELS = [
    { value: 'linear', label: 'Linear  (a·x + b)' },
    { value: 'quadratic', label: 'Quadratic  (a·x² + b·x + c)' },
    { value: 'cubic', label: 'Cubic  (a·x³ + …)' },
    { value: 'power', label: 'Power  (a·xᵇ)' },
    { value: 'exponential', label: 'Exponential  (a·exp(b·x))' },
    { value: 'sinusoidal', label: 'Sinusoidal  (A·sin(ω·x + φ) + D)' },
    { value: 'custom', label: 'Custom expression' },
];

/* ─── Example data: free-fall parabola ─── */
const EXAMPLE_DATA = {
    name: 'Free Fall (g ≈ 9.81 m/s²)',
    columns: ['Time (s)', 'Height (m)', 'Height Error (m)'],
    rows: [
        { 'Time (s)': 0.0, 'Height (m)': 0.00, 'Height Error (m)': 0.02 },
        { 'Time (s)': 0.1, 'Height (m)': 0.05, 'Height Error (m)': 0.02 },
        { 'Time (s)': 0.2, 'Height (m)': 0.19, 'Height Error (m)': 0.03 },
        { 'Time (s)': 0.3, 'Height (m)': 0.45, 'Height Error (m)': 0.03 },
        { 'Time (s)': 0.4, 'Height (m)': 0.77, 'Height Error (m)': 0.04 },
        { 'Time (s)': 0.5, 'Height (m)': 1.23, 'Height Error (m)': 0.04 },
        { 'Time (s)': 0.6, 'Height (m)': 1.76, 'Height Error (m)': 0.05 },
        { 'Time (s)': 0.7, 'Height (m)': 2.42, 'Height Error (m)': 0.05 },
        { 'Time (s)': 0.8, 'Height (m)': 3.13, 'Height Error (m)': 0.06 },
        { 'Time (s)': 0.9, 'Height (m)': 3.95, 'Height Error (m)': 0.06 },
        { 'Time (s)': 1.0, 'Height (m)': 4.89, 'Height Error (m)': 0.07 },
        { 'Time (s)': 1.1, 'Height (m)': 5.93, 'Height Error (m)': 0.07 },
        { 'Time (s)': 1.2, 'Height (m)': 7.05, 'Height Error (m)': 0.08 },
        { 'Time (s)': 1.3, 'Height (m)': 8.28, 'Height Error (m)': 0.08 },
        { 'Time (s)': 1.4, 'Height (m)': 9.61, 'Height Error (m)': 0.09 },
        { 'Time (s)': 1.5, 'Height (m)': 11.03, 'Height Error (m)': 0.09 },
    ],
};

function Workflow() {
    /* which sections are unlocked (cumulative) */
    const [unlocked, setUnlocked] = useState(1); // starts with section 1 open

    /* refs for auto-scroll */
    const sec2Ref = useRef<HTMLDivElement>(null);
    const sec3Ref = useRef<HTMLDivElement>(null);
    const sec4Ref = useRef<HTMLDivElement>(null);
    const sec5Ref = useRef<HTMLDivElement>(null);

    const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
        setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    };

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

    /* step 4 – formula */
    const [formulaResult, setFormulaResult] = useState<FormulaResult | null>(null);

    /* ──────── LOAD EXAMPLE DATA ──────── */
    const loadExampleData = () => {
        setParsedData({ columns: EXAMPLE_DATA.columns, rows: EXAMPLE_DATA.rows });
        setXCol(EXAMPLE_DATA.columns[0]);
        setYCol(EXAMPLE_DATA.columns[1]);
        setYErrCol(EXAMPLE_DATA.columns[2]);
        setXErrCol('None');
        setXLabel('Time [s]');
        setYLabel('Height [m]');
        setPlotTitle('Free Fall — Height vs Time');
        setModel('quadratic');
        setUnlocked(2);
        scrollTo(sec2Ref);
    };

    /* ──────── STEP 1: Upload ──────── */
    const handleFileSelect = async (f: File) => {
        setFile(f);
        setUploadError('');
        setUploading(true);
        try {
            if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) {
                const info = await api.parseFileInfo(f);
                setFileInfo({ sheetNames: info.sheet_names, sheetsInfo: info.sheets_info });
                if (info.sheet_names.length > 0) setSelectedSheet(info.sheet_names[0]);
            } else {
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
            if (data.columns.length >= 2) {
                setXCol(data.columns[0]);
                setYCol(data.columns[1]);
                setXLabel(data.columns[0]);
                setYLabel(data.columns[1]);
            }
            setUnlocked(2);
            scrollTo(sec2Ref);
        } catch (err: any) {
            setUploadError(err.response?.data?.error || err.message || 'Failed to load sheet');
        } finally {
            setUploading(false);
        }
    };

    /* ──────── STEP 2: Confirm columns ──────── */
    const confirmColumns = () => {
        setUnlocked(3);
        scrollTo(sec3Ref);
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

            const payload: any = { x_data: xData, y_data: yData, model };
            if (yErrors && yErrors.length === yData.length) payload.y_errors = yErrors;
            if (model === 'custom') payload.custom_expr = customExpr;

            const result = await api.fitData(payload);
            if (result.error) throw new Error(result.error);
            setFitResult(result);
            setUnlocked(4);
            setTimeout(() => sec4Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
        } catch (err: any) {
            setFitError(err.response?.data?.error || err.message || 'Fitting failed');
        } finally {
            setFitting(false);
        }
    };

    /* ──────── prefilled map for formula ──────── */
    const fitPrefilled = (): Record<string, { value: number; uncertainty: number }> => {
        if (!fitResult) return {};
        const map: Record<string, { value: number; uncertainty: number }> = {};
        fitResult.parameter_names.forEach((name, i) => {
            map[name] = { value: fitResult.parameters[i], uncertainty: fitResult.uncertainties[i] };
        });
        return map;
    };

    /* ──────── plot data helpers ──────── */
    const getPlotData = (): any[] => {
        if (!parsedData || !fitResult) return [];
        const xData = parsedData.rows.map(r => Number(r[xCol]));
        const yData = parsedData.rows.map(r => Number(r[yCol]));
        return [
            {
                x: xData, y: yData,
                mode: 'markers' as const, type: 'scatter' as const, name: 'Data',
                marker: { color: '#1976d2', size: 8, line: { width: 1, color: '#0d47a1' } },
                error_y: yErrCol !== 'None' ? { type: 'data' as const, array: parsedData.rows.map(r => Number(r[yErrCol])), visible: true, color: '#1976d2' } : undefined,
                error_x: xErrCol !== 'None' ? { type: 'data' as const, array: parsedData.rows.map(r => Number(r[xErrCol])), visible: true, color: '#1976d2' } : undefined,
            },
            {
                x: fitResult.x_fit, y: fitResult.y_fit,
                mode: 'lines' as const, name: fitResult.model_name,
                line: { color: '#d32f2f', width: 2.5 },
            },
        ];
    };

    const getResidualData = (): any[] => {
        if (!parsedData || !fitResult) return [];
        return [{ x: parsedData.rows.map(r => Number(r[xCol])), y: fitResult.residuals, mode: 'markers' as const, type: 'scatter' as const, name: 'Residuals', marker: { color: '#ff7043', size: 7 } }];
    };

    /* section header helper */
    const SectionHeader = ({ num, title, isUnlocked }: { num: number; title: string; isUnlocked: boolean }) => (
        <div className="wf-section-header" style={{ opacity: isUnlocked ? 1 : 0.4 }}>
            <span className={`wf-num ${isUnlocked ? 'active' : ''}`}>{num}</span>
            <h3 style={{ margin: 0 }}>{title}</h3>
            {!isUnlocked && <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#999' }}>🔒 Complete step {num - 1} first</span>}
        </div>
    );

    /* ──────── RENDER ──────── */
    return (
        <div className="workflow-page">
            <div className="card" style={{ marginBottom: '0' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <img src="/Workflow.png" alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                    Lab Workflow
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    Complete guided pipeline: upload data → select columns → fit → calculate → compare.
                </p>
            </div>

            {/* ════ Section 1: Upload ════ */}
            <div className="wf-section">
                <SectionHeader num={1} title="Upload Data" isUnlocked={true} />
                <div className="wf-body">
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                        <button className="btn-accent" onClick={loadExampleData}>🧪 Load Example: Free Fall Data</button>
                    </div>

                    <div className="form-group">
                        <label>Or upload an Excel / CSV file</label>
                        <input type="file" accept=".xlsx,.xls,.csv" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                    </div>

                    {uploading && <div className="loading-spinner">Loading file…</div>}
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
                        <div className="sheet-info">
                            <p><strong>Sheets:</strong> {fileInfo.sheetNames.join(', ')}
                                {selectedSheet && fileInfo.sheetsInfo[selectedSheet] && (
                                    <> — <strong>Columns:</strong> {fileInfo.sheetsInfo[selectedSheet].join(', ')}</>
                                )}
                            </p>
                            <button onClick={loadSheet} disabled={uploading} className="btn-primary">Load Data & Continue ↓</button>
                        </div>
                    )}
                </div>
            </div>

            {/* ════ Section 2: Columns ════ */}
            <div className="wf-section" ref={sec2Ref} style={{ opacity: unlocked >= 2 ? 1 : 0.4, pointerEvents: unlocked >= 2 ? 'auto' : 'none' }}>
                <SectionHeader num={2} title="Select Columns & Name Axes" isUnlocked={unlocked >= 2} />
                {unlocked >= 2 && parsedData && (
                    <div className="wf-body">
                        <p className="step-desc">{parsedData.rows.length} rows loaded.</p>
                        <div className="grid grid-2">
                            <div className="form-group">
                                <label>X column</label>
                                <select value={xCol} onChange={e => { setXCol(e.target.value); if (!xLabel || xLabel === xCol) setXLabel(e.target.value); }}>
                                    <option value="">— select —</option>
                                    {parsedData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Y column</label>
                                <select value={yCol} onChange={e => { setYCol(e.target.value); if (!yLabel || yLabel === yCol) setYLabel(e.target.value); }}>
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
                            <div className="form-group"><label>X axis</label><input value={xLabel} onChange={e => setXLabel(e.target.value)} placeholder="e.g. Time [s]" /></div>
                            <div className="form-group"><label>Y axis</label><input value={yLabel} onChange={e => setYLabel(e.target.value)} placeholder="e.g. Distance [m]" /></div>
                            <div className="form-group"><label>Plot title</label><input value={plotTitle} onChange={e => setPlotTitle(e.target.value)} placeholder="e.g. Position vs Time" /></div>
                        </div>
                        <button onClick={confirmColumns} disabled={!xCol || !yCol} className="btn-primary" style={{ marginTop: '1rem' }}>
                            Confirm Columns ↓
                        </button>
                    </div>
                )}
            </div>

            {/* ════ Section 3: Fit ════ */}
            <div className="wf-section" ref={sec3Ref} style={{ opacity: unlocked >= 3 ? 1 : 0.4, pointerEvents: unlocked >= 3 ? 'auto' : 'none' }}>
                <SectionHeader num={3} title="Curve Fitting" isUnlocked={unlocked >= 3} />
                {unlocked >= 3 && (
                    <div className="wf-body">
                        <div className="grid grid-2">
                            <div className="form-group">
                                <label>Fit model</label>
                                <select value={model} onChange={e => setModel(e.target.value)}>
                                    {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                            {model === 'custom' && (
                                <div className="form-group">
                                    <label>Custom expression (use <code>x</code>)</label>
                                    <input value={customExpr} onChange={e => setCustomExpr(e.target.value)} placeholder="e.g. a*sin(b*x)+c" style={{ fontFamily: 'monospace' }} />
                                </div>
                            )}
                        </div>
                        <button onClick={handleFit} disabled={fitting} className="btn-primary" style={{ marginTop: '0.75rem' }}>
                            {fitting ? '⏳ Fitting…' : '▶ Run Fit'}
                        </button>
                        {fitError && <div className="error-message" style={{ marginTop: '1rem' }}>{fitError}</div>}

                        {fitResult && (
                            <>
                                <div className="params-table-wrap">
                                    <h4>Fit Parameters — {fitResult.model_name}</h4>
                                    <table className="params-table">
                                        <thead><tr><th>Param</th><th>Value</th><th>± Uncertainty</th></tr></thead>
                                        <tbody>
                                            {fitResult.parameter_names.map((name, i) => (
                                                <tr key={name}>
                                                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{name}</td>
                                                    <td style={{ fontFamily: 'monospace' }}>{fitResult.parameters[i].toExponential(4)}</td>
                                                    <td style={{ fontFamily: 'monospace' }}>{fitResult.uncertainties[i].toExponential(4)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <p className="fit-stats">R² = {fitResult.r_squared.toFixed(6)} &nbsp;|&nbsp; χ²/dof = {fitResult.chi_squared.toFixed(4)}</p>
                                </div>

                                <Plot data={getPlotData()} layout={{
                                    title: { text: plotTitle || 'Data + Fit' },
                                    xaxis: { title: { text: xLabel || 'X' }, gridcolor: '#e0e0e0' },
                                    yaxis: { title: { text: yLabel || 'Y' }, gridcolor: '#e0e0e0' },
                                    height: 450, legend: { x: 0, y: 1.15, orientation: 'h' as const },
                                    margin: { l: 65, r: 30, t: 55, b: 60 }, plot_bgcolor: '#fafafa', paper_bgcolor: '#fff',
                                }} useResizeHandler style={{ width: '100%' }} config={{ responsive: true, displaylogo: false, toImageButtonOptions: { format: 'png' as any, filename: plotTitle || 'fit_plot', height: 800, width: 1200, scale: 2 } }} />

                                <Plot data={getResidualData()} layout={{
                                    title: { text: 'Residuals' },
                                    xaxis: { title: { text: xLabel || 'X' }, gridcolor: '#e0e0e0' },
                                    yaxis: { title: { text: 'Residual' }, gridcolor: '#e0e0e0' },
                                    height: 280, margin: { l: 65, r: 30, t: 40, b: 55 }, plot_bgcolor: '#fafafa', paper_bgcolor: '#fff',
                                    shapes: [{ type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 0, y1: 0, line: { color: '#888', width: 1, dash: 'dash' } }],
                                }} useResizeHandler style={{ width: '100%' }} config={{ responsive: true, displaylogo: false }} />

                                <p style={{ color: '#888', fontSize: '0.85rem' }}>📷 Use the camera icon on each plot to download as PNG.</p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ════ Section 4: Formula ════ */}
            <div className="wf-section" ref={sec4Ref} style={{ opacity: unlocked >= 4 ? 1 : 0.4, pointerEvents: unlocked >= 4 ? 'auto' : 'none' }}>
                <SectionHeader num={4} title="Formula Calculator" isUnlocked={unlocked >= 4} />
                {unlocked >= 4 && (
                    <div className="wf-body">
                        <p className="step-desc">Fit parameters are available — type them in your expression and they'll auto-fill.</p>
                        <FormulaCalculator
                            embedded
                            prefilled={fitPrefilled()}
                            onResult={(val, unc) => {
                                setFormulaResult({ value: val, uncertainty: unc });
                                setUnlocked(u => Math.max(u, 5));
                                setTimeout(() => sec5Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
                            }}
                        />
                    </div>
                )}
            </div>

            {/* ════ Section 5: N-Sigma ════ */}
            <div className="wf-section" ref={sec5Ref} style={{ opacity: unlocked >= 5 ? 1 : 0.4, pointerEvents: unlocked >= 5 ? 'auto' : 'none' }}>
                <SectionHeader num={5} title="N-σ Comparison" isUnlocked={unlocked >= 5} />
                {unlocked >= 5 && (
                    <div className="wf-body">
                        {formulaResult && (
                            <div className="prefilled-banner">
                                <strong>From formula:</strong> {formulaResult.value.toExponential(4)} ± {formulaResult.uncertainty.toExponential(4)}
                            </div>
                        )}
                        <NSigmaCalculator prefilled1={formulaResult ? { value: formulaResult.value, uncertainty: formulaResult.uncertainty } : undefined} />
                        <button onClick={() => { setUnlocked(1); setFitResult(null); setFormulaResult(null); setParsedData(null); setFile(null); setFileInfo(null); }}
                            className="btn-accent" style={{ marginTop: '1.5rem' }}>
                            🔄 Start New Workflow
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Workflow;
