import { useState, useRef } from 'react';
import Plot from './PlotWrapper';
import * as api from '../services/api';
import FormulaCalculator from './FormulaCalculator';
import NSigmaCalculator from './NSigmaCalculator';
import { smartFormat, formatPValue } from '../utils/format';

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
    columns: ['Time (s)', 'Height (m)', 'Height Error (m)', 'Time Error (s)'],
    rows: [
        { 'Time (s)': 0.0, 'Height (m)': 0.00, 'Height Error (m)': 0.10, 'Time Error (s)': 0.02 },
        { 'Time (s)': 0.1, 'Height (m)': 0.05, 'Height Error (m)': 0.10, 'Time Error (s)': 0.02 },
        { 'Time (s)': 0.2, 'Height (m)': 0.19, 'Height Error (m)': 0.12, 'Time Error (s)': 0.02 },
        { 'Time (s)': 0.3, 'Height (m)': 0.45, 'Height Error (m)': 0.15, 'Time Error (s)': 0.02 },
        { 'Time (s)': 0.4, 'Height (m)': 0.77, 'Height Error (m)': 0.18, 'Time Error (s)': 0.02 },
        { 'Time (s)': 0.5, 'Height (m)': 1.23, 'Height Error (m)': 0.20, 'Time Error (s)': 0.02 },
        { 'Time (s)': 0.6, 'Height (m)': 1.76, 'Height Error (m)': 0.22, 'Time Error (s)': 0.02 },
        { 'Time (s)': 0.7, 'Height (m)': 2.42, 'Height Error (m)': 0.25, 'Time Error (s)': 0.02 },
        { 'Time (s)': 0.8, 'Height (m)': 3.13, 'Height Error (m)': 0.28, 'Time Error (s)': 0.02 },
        { 'Time (s)': 0.9, 'Height (m)': 3.95, 'Height Error (m)': 0.30, 'Time Error (s)': 0.02 },
        { 'Time (s)': 1.0, 'Height (m)': 4.89, 'Height Error (m)': 0.35, 'Time Error (s)': 0.02 },
        { 'Time (s)': 1.1, 'Height (m)': 5.93, 'Height Error (m)': 0.38, 'Time Error (s)': 0.02 },
        { 'Time (s)': 1.2, 'Height (m)': 7.05, 'Height Error (m)': 0.40, 'Time Error (s)': 0.02 },
        { 'Time (s)': 1.3, 'Height (m)': 8.28, 'Height Error (m)': 0.42, 'Time Error (s)': 0.02 },
        { 'Time (s)': 1.4, 'Height (m)': 9.61, 'Height Error (m)': 0.45, 'Time Error (s)': 0.02 },
        { 'Time (s)': 1.5, 'Height (m)': 11.03, 'Height Error (m)': 0.50, 'Time Error (s)': 0.02 },
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
    const sec6Ref = useRef<HTMLDivElement>(null);

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

    /* step 5 – N-sigma */
    const [nSigmaResult, setNSigmaResult] = useState<{ n_sigma: number; verdict: string; message: string } | null>(null);

    /* step 6 – report */
    const [reportLang, setReportLang] = useState<'en' | 'he'>('en');
    const [experimentContext, setExperimentContext] = useState('');
    const [generatedReport, setGeneratedReport] = useState('');
    const [reportLoading, setReportLoading] = useState(false);
    const [showReportDialog, setShowReportDialog] = useState(false);

    /* ──────── LOAD EXAMPLE DATA ──────── */
    const loadExampleData = () => {
        setParsedData({ columns: EXAMPLE_DATA.columns, rows: EXAMPLE_DATA.rows });
        setXCol(EXAMPLE_DATA.columns[0]);
        setYCol(EXAMPLE_DATA.columns[1]);
        setYErrCol(EXAMPLE_DATA.columns[2]);
        setXErrCol(EXAMPLE_DATA.columns[3]);
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
                error_y: yErrCol !== 'None' ? { type: 'data' as const, array: parsedData.rows.map(r => Number(r[yErrCol])), visible: true, color: '#1976d2', thickness: 1.5 } : undefined,
                error_x: xErrCol !== 'None' ? { type: 'data' as const, array: parsedData.rows.map(r => Number(r[xErrCol])), visible: true, color: '#1976d2', thickness: 1.5 } : undefined,
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
        return [{
            x: parsedData.rows.map(r => Number(r[xCol])),
            y: fitResult.residuals,
            mode: 'markers' as const,
            type: 'scatter' as const,
            name: 'Residuals',
            marker: { color: '#ff7043', size: 7 },
            error_y: yErrCol !== 'None' ? { type: 'data' as const, array: parsedData.rows.map(r => Number(r[yErrCol])), visible: true, color: '#ff7043' } : undefined,
            error_x: xErrCol !== 'None' ? { type: 'data' as const, array: parsedData.rows.map(r => Number(r[xErrCol])), visible: true, color: '#ff7043' } : undefined,
        }];
    };

    /* section header helper */
    const SectionHeader = ({ num, title, isUnlocked }: { num: number; title: string; isUnlocked: boolean }) => (
        <div className="wf-section-header" style={{ opacity: isUnlocked ? 1 : 0.4 }}>
            <span className={`wf-num ${isUnlocked ? 'active' : ''}`}>{num}</span>
            <h3 style={{ margin: 0 }}>{title}</h3>
            {!isUnlocked && <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#999' }}>🔒 Complete step {num - 1} first</span>}
        </div>
    );

    /* ──────── GENERATE REPORT ──────── */
    const handleGenerateReport = async () => {
        setReportLoading(true);
        setGeneratedReport('');
        try {
            // Build a detailed prompt
            const lang = reportLang === 'he' ? 'Hebrew' : 'English';
            let prompt = `Write a concise lab report paragraph in ${lang} summarizing the following experimental results.\n\n`;

            if (experimentContext.trim()) {
                prompt += `EXPERIMENT DESCRIPTION: ${experimentContext.trim()}\n\n`;
            }

            if (fitResult) {
                prompt += `FIT MODEL: ${fitResult.model_name}\n`;
                prompt += `PARAMETERS:\n`;
                fitResult.parameter_names.forEach((name: string, i: number) => {
                    prompt += `  ${name} = ${fitResult.parameters[i]} ± ${fitResult.uncertainties[i]}\n`;
                });
                prompt += `χ² (total) = ${fitResult.chi_squared}\n`;
                prompt += `χ² reduced (χ²/dof) = ${fitResult.reduced_chi_squared}\n`;
                prompt += `P-value = ${fitResult.p_value}\n`;
                prompt += `Degrees of freedom = ${fitResult.dof}\n`;
                prompt += `Data points = ${fitResult.n_data}, Parameters = ${fitResult.n_params}\n\n`;
            }

            if (nSigmaResult) {
                prompt += `N-SIGMA COMPARISON:\n`;
                prompt += `  N-sigma = ${nSigmaResult.n_sigma.toFixed(3)}\n`;
                prompt += `  Verdict = ${nSigmaResult.verdict}\n\n`;
            }

            prompt += `INSTRUCTIONS FOR THE REPORT:\n`;
            prompt += `- Refer to χ²/dof as "chi-squared reduced" (χ²_reduced). Do NOT mention or use R².\n`;
            prompt += `- Interpret chi-squared reduced:\n`;
            prompt += `  * If χ²_reduced ≈ 1: good fit, errors well estimated\n`;
            prompt += `  * If χ²_reduced >> 1: poor fit or measurement errors were UNDERESTIMATED\n`;
            prompt += `  * If χ²_reduced << 1: measurement errors were OVERESTIMATED (uncertainties too large)\n`;
            prompt += `- Interpret the P-value (probability of getting this chi-squared or worse if model is correct)\n`;
            prompt += `- If N-sigma result is available, discuss whether the measured and expected values agree\n`;
            prompt += `- Write as a coherent paragraph suitable for a physics lab report, NOT bullet points\n`;
            prompt += `- Use proper Unicode math symbols that can be copy-pasted into Word/Google Docs:\n`;
            prompt += `  Use: χ² (not chi^2), ± (not +/-), σ (not sigma), π (not pi), √ (not sqrt)\n`;
            prompt += `  Write parameter values like: a = 4.91 ± 0.03\n`;
            prompt += `- Be quantitative — cite the actual numbers from the results\n`;
            if (reportLang === 'he') {
                prompt += `- Write entirely in Hebrew. Use proper Hebrew physics terminology.\n`;
                prompt += `- Format numbers left-to-right even within Hebrew text.\n`;
                prompt += `- Use Hebrew terms: התאמה (fit), שגיאות (errors), מדידה (measurement), ניסוי (experiment)\n`;
            }

            const data = await api.chatWithAssistant({
                message: prompt,
                context: {
                    current_page: '/workflow',
                    current_tool: 'Lab Workflow - Report Generator',
                    generating_report: true,
                },
            });
            setGeneratedReport(data.response || data.message || 'No report generated.');
        } catch (err: any) {
            setGeneratedReport(`⚠️ Error generating report: ${err.response?.data?.error || err.message}`);
        } finally {
            setReportLoading(false);
        }
    };

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
                        <input type="file" accept=".xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.dat,.txt" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
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
                                                    <td style={{ fontFamily: 'monospace' }}>{smartFormat(fitResult.parameters[i])}</td>
                                                    <td style={{ fontFamily: 'monospace' }}>{smartFormat(fitResult.uncertainties[i])}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="params-table-wrap" style={{ marginTop: '1rem' }}>
                                    <h4>Goodness of Fit</h4>
                                    <table className="params-table">
                                        <tbody>
                                            <tr><td>R²</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{fitResult.r_squared.toFixed(6)}</td></tr>
                                            <tr><td>χ²</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{smartFormat(fitResult.chi_squared)}</td></tr>
                                            <tr><td>χ²/dof (reduced)</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{smartFormat(fitResult.reduced_chi_squared)}</td></tr>
                                            <tr><td>P-value</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{formatPValue(fitResult.p_value)}</td></tr>
                                            <tr><td>Degrees of freedom</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{fitResult.dof}</td></tr>
                                            <tr><td>Data points / Parameters</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{fitResult.n_data} / {fitResult.n_params}</td></tr>
                                        </tbody>
                                    </table>
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
                        <NSigmaCalculator
                            prefilled1={formulaResult ? { value: formulaResult.value, uncertainty: formulaResult.uncertainty } : undefined}
                            onResult={(r) => { setNSigmaResult(r); setUnlocked(u => Math.max(u, 6)); setTimeout(() => sec6Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); }}
                        />
                    </div>
                )}
            </div>

            {/* ════ Section 6: Generate Report ════ */}
            <div className="wf-section" ref={sec6Ref} style={{ opacity: unlocked >= 3 ? 1 : 0.4, pointerEvents: unlocked >= 3 ? 'auto' : 'none' }}>
                <SectionHeader num={6} title="📝 Generate Report" isUnlocked={unlocked >= 3} />
                {unlocked >= 3 && (
                    <div className="wf-body">
                        <p className="step-desc">Generate an AI-written paragraph summarizing your results — fit quality, χ²/dof interpretation, P-value, and N-σ comparison.</p>

                        {/* Language toggle */}
                        <div style={{ display: 'flex', gap: '0', marginBottom: '1rem' }}>
                            <button
                                onClick={() => setReportLang('en')}
                                style={{
                                    fontSize: '0.9rem', padding: '0.5rem 1.3rem', cursor: 'pointer',
                                    border: '2px solid #1565c0', borderRadius: '8px 0 0 8px',
                                    background: reportLang === 'en' ? '#1565c0' : 'white',
                                    color: reportLang === 'en' ? 'white' : '#1565c0',
                                    fontWeight: reportLang === 'en' ? 700 : 400,
                                }}
                            >
                                🇬🇧 English
                            </button>
                            <button
                                onClick={() => setReportLang('he')}
                                style={{
                                    fontSize: '0.9rem', padding: '0.5rem 1.3rem', cursor: 'pointer',
                                    border: '2px solid #1565c0', borderLeft: 'none', borderRadius: '0 8px 8px 0',
                                    background: reportLang === 'he' ? '#1565c0' : 'white',
                                    color: reportLang === 'he' ? 'white' : '#1565c0',
                                    fontWeight: reportLang === 'he' ? 700 : 400,
                                }}
                            >
                                🇮🇱 עברית
                            </button>
                        </div>

                        {/* Experiment context */}
                        {!showReportDialog ? (
                            <button className="btn-primary" onClick={() => setShowReportDialog(true)} style={{ fontSize: '0.95rem' }}>
                                📝 Generate Report
                            </button>
                        ) : (
                            <div style={{ background: '#f5f5f5', borderRadius: '10px', padding: '1rem', border: '1px solid #e0e0e0' }}>
                                <h4 style={{ margin: '0 0 0.75rem 0' }}>Tell the AI about your experiment</h4>
                                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>
                                    {reportLang === 'he'
                                        ? 'תאר את הניסוי: מה מדדת, מה ההשוואה ב-N-σ, ופרטים נוספים שיעזרו ליצור דו"ח טוב.'
                                        : 'Describe your experiment: what did you measure, what are you comparing in the N-σ test, and any other relevant details.'}
                                </p>
                                <textarea
                                    value={experimentContext}
                                    onChange={e => setExperimentContext(e.target.value)}
                                    placeholder={reportLang === 'he'
                                        ? 'לדוגמה: מדדנו את תקופת המטוטלת T כפונקציה של L, והשוונו את ערך g שקיבלנו לערך התיאורטי...'
                                        : 'e.g. We measured pendulum period T vs length L, fitted to T = 2π√(L/g), and compared the extracted g to the theoretical value...'}
                                    rows={3}
                                    style={{ width: '100%', fontSize: '0.9rem', marginBottom: '0.75rem' }}
                                />
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button className="btn-primary" onClick={handleGenerateReport} disabled={reportLoading}>
                                        {reportLoading ? '⏳ Generating…' : '✨ Generate'}
                                    </button>
                                    <button className="btn-accent" onClick={() => setShowReportDialog(false)}>Cancel</button>
                                </div>
                            </div>
                        )}

                        {/* Generated report display */}
                        {generatedReport && (
                            <div style={{
                                marginTop: '1.5rem', padding: '1.25rem', background: '#fafafa',
                                borderRadius: '10px', border: '1px solid #e0e0e0',
                                direction: reportLang === 'he' ? 'rtl' : 'ltr',
                                textAlign: reportLang === 'he' ? 'right' : 'left',
                                lineHeight: 1.7, fontSize: '0.95rem',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', direction: 'ltr' }}>
                                    <h4 style={{ margin: 0 }}>📄 Generated Report</h4>
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(generatedReport); }}
                                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem', cursor: 'pointer' }}
                                        className="btn-accent"
                                    >
                                        📋 Copy
                                    </button>
                                </div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{generatedReport}</div>
                            </div>
                        )}

                        <button onClick={() => { setUnlocked(1); setFitResult(null); setFormulaResult(null); setNSigmaResult(null); setParsedData(null); setFile(null); setFileInfo(null); setGeneratedReport(''); setShowReportDialog(false); }}
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
