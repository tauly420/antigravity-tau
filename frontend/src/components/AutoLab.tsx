import { useState, useRef, useEffect } from 'react';
import Plot from './PlotWrapper';
import DataPreview from './DataPreview';
import { useAnalysis } from '../context/AnalysisContext';
import * as api from '../services/api';
import { roundWithUncertainty, smartFormat, formatPValue } from '../utils/format';
import ReportSection from './report/ReportSection';
import ReportExpander from './report/ReportExpander';
import { normalizeAnalysisData } from '../utils/normalize';
import { exportResultsPdf, exportResultsDocx } from '../services/api';
// @ts-ignore - plotly.js-dist-min has no types
import Plotly from 'plotly.js-dist-min';

/* ===================================================================
   AutoLab -- AI-Powered Automated Analysis
   Upload data + give instructions -> get complete results
   =================================================================== */

/* -- Built-in example datasets -- */
const EXAMPLE_DATASETS = [
    {
        label: 'Free Fall (Quadratic)',
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
        reportContext: {
            title: 'Free Fall Experiment',
            subject: 'Classical Mechanics',
            equipment: 'Timer, meter stick, metal ball, photogate sensor',
            notes: 'Goal: Verify the free-fall acceleration g by dropping a metal ball from rest and measuring its height h as a function of time t. According to kinematics, h(t) = ½gt² + v₀t + h₀. Since the ball starts from rest (v₀ ≈ 0), fitting a quadratic h = at² + bt + c gives g = 2a. A photogate sensor recorded times at 0.1 s intervals while the ball fell ~11 m. Height uncertainty grows with distance due to parallax. Compare the extracted g to the accepted value 9.81 ± 0.01 m/s² using an n-sigma test.',
        },
        titlePage: {
            studentName: 'Demo User',
            studentId: '123456789',
            labPartner: 'Demo Partner',
            labPartnerId: '987654321',
            courseName: 'Physics Lab 1',
            experimentTitle: 'Free Fall Experiment',
            date: new Date().toISOString().split('T')[0],
        },
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


/** Model formula map for display */
const MODEL_FORMULAS: Record<string, string> = {
    linear: 'y = ax + b',
    quadratic: 'y = ax\u00B2 + bx + c',
    cubic: 'y = ax\u00B3 + bx\u00B2 + cx + d',
    power: 'y = ax\u1D47 + c',
    exponential: 'y = ae^(bx) + c',
    sinusoidal: 'y = A\u00B7sin(\u03C9x + \u03C6) + D',
};

/** Parameter names for each model (used for fixing constants) */
const MODEL_PARAMS: Record<string, string[]> = {
    linear: ['a', 'b'],
    quadratic: ['a', 'b', 'c'],
    cubic: ['a', 'b', 'c', 'd'],
    power: ['a', 'b', 'c'],
    exponential: ['a', 'b', 'c'],
    sinusoidal: ['A', 'omega', 'phi', 'D'],
};

/** Fit model options for the dropdown */
const FIT_MODEL_OPTIONS = [
    { value: 'auto', label: '🤖 Auto (AI chooses)', desc: 'Let the AI pick the best model' },
    { value: 'linear', label: '📏 Linear', desc: 'y = ax + b' },
    { value: 'quadratic', label: '📐 Quadratic', desc: 'y = ax² + bx + c' },
    { value: 'cubic', label: '🔣 Cubic', desc: 'y = ax³ + bx² + cx + d' },
    { value: 'power', label: '⚡ Power', desc: 'y = axᵇ + c' },
    { value: 'exponential', label: '📈 Exponential', desc: 'y = ae^(bx) + c' },
    { value: 'sinusoidal', label: '🌊 Sinusoidal', desc: 'y = A·sin(ωx + φ) + D' },
    { value: 'custom', label: '✏️ Custom', desc: 'Enter your own expression' },
];

/** N-sigma colour: green <= 2, orange 2-3, red > 3 */
function nsigmaColor(ns: number): string {
    if (ns <= 2) return '#2e7d32';
    if (ns <= 3) return '#e65100';
    return '#c62828';
}

/* -- Table cell styles -- */
const thStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem', textAlign: 'left',
    borderBottom: '2px solid #90caf9',
    fontSize: '0.85rem', fontWeight: 700,
};
const tdStyle: React.CSSProperties = {
    padding: '0.4rem 0.75rem', borderBottom: '1px solid #eee',
    fontFamily: 'monospace',
};

/** Build an HTML table string for clipboard (pastes as table in Google Docs/Word) */
function buildHtmlTable(names: string[], params: number[], uncs: number[], roundFn: (v: number, u: number) => { rounded: string; unrounded: string }): string {
    let html = '<table><thead><tr><th>Parameter</th><th>Rounded</th><th>Full Precision</th></tr></thead><tbody>';
    names.forEach((name, j) => {
        const fmt = roundFn(Number(params[j]), Number(uncs[j]));
        html += `<tr><td>${name}</td><td>${fmt.rounded}</td><td>${fmt.unrounded}</td></tr>`;
    });
    html += '</tbody></table>';
    return html;
}

function AutoLab() {
    const [file, setFile] = useState<File | null>(null);
    const [instructions, setInstructions] = useState('');
    const [theoVal, setTheoVal] = useState('');
    const [theoUnc, setTheoUnc] = useState('');

    /* Fit model selection */
    const [selectedModel, setSelectedModel] = useState('auto');
    const [customExpr, setCustomExpr] = useState('');
    const [fixedParams, setFixedParams] = useState<Record<string, string>>({});

    const [running, setRunning] = useState(false);
    const [steps, setSteps] = useState<StepResult[]>([]);
    const [fitData, setFitData] = useState<any>(null);
    const [analysisState, setAnalysisState] = useState<any>(null);
    const [error, setError] = useState('');

    /* Data preview state */
    const [previewData, setPreviewData] = useState<{ columns: string[]; rows: Record<string, any>[] } | null>(null);
    const [previewError, setPreviewError] = useState('');

    const [tableCopied, setTableCopied] = useState(false);
    const [reportCopied, setReportCopied] = useState(false);
    const [demoReportContext, setDemoReportContext] = useState<{
        title: string; subject: string; equipment: string; notes: string;
        titlePage?: Record<string, string>;
    } | null>(null);

    /* Report expander + plot capture state */
    const [reportExpanded, setReportExpanded] = useState(false);
    const [plotImages, setPlotImages] = useState<{ fit: string | null; residuals: string | null }>({ fit: null, residuals: null });
    const [resultsExporting, setResultsExporting] = useState(false);
    const [resultsExportError, setResultsExportError] = useState<string | null>(null);
    const [exportFormat, setExportFormat] = useState<'docx' | 'pdf'>('docx');

    const fileRef = useRef<HTMLInputElement>(null);
    const fitPlotRef = useRef<HTMLDivElement>(null);
    const residualsPlotRef = useRef<HTMLDivElement>(null);
    const { setCurrentTool, setAutolabResults } = useAnalysis();

    useEffect(() => { setCurrentTool('AutoLab'); }, []);

    /* Capture plot images after analysis for PDF export */
    useEffect(() => {
        const capturePlots = async () => {
            try {
                const fitEl = fitPlotRef.current?.querySelector('.js-plotly-plot') as HTMLElement | null;
                if (fitEl) {
                    const fitImg = await Plotly.toImage(fitEl, { format: 'png', width: 700, height: 400, scale: 2 });
                    const residualsEl = residualsPlotRef.current?.querySelector('.js-plotly-plot') as HTMLElement | null;
                    const residualsImg = residualsEl
                        ? await Plotly.toImage(residualsEl, { format: 'png', width: 700, height: 300, scale: 2 })
                        : null;
                    setPlotImages({ fit: fitImg, residuals: residualsImg });
                }
            } catch (e) {
                console.warn('Could not capture plot images:', e);
            }
        };
        if (fitData && !plotImages.fit) {
            const timer = setTimeout(capturePlots, 500);
            return () => clearTimeout(timer);
        }
    }, [fitData, plotImages.fit]);

    /* Parse file for preview when user selects one */
    const handleFileChange = async (f: File) => {
        setFile(f);
        setPreviewData(null);
        setPreviewError('');
        try {
            const data = await api.parseFileData(f);
            if (Array.isArray(data?.columns) && data.columns.length > 0 && Array.isArray(data?.rows)) {
                setPreviewData({ columns: data.columns.map(String), rows: data.rows });
            }
        } catch {
            setPreviewError('Could not preview file -- analysis will still work when you click Run.');
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
        setPlotImages({ fit: null, residuals: null });
        setReportExpanded(false);
        setError('');
        setSelectedModel('auto');
        setCustomExpr('');
        setFixedParams({});
        if (ex.reportContext) {
            setDemoReportContext({ ...ex.reportContext, titlePage: ex.titlePage });
        } else {
            setDemoReportContext(null);
        }
    };

    const handleRun = async () => {
        if (!file || !instructions.trim()) return;
        setRunning(true);
        setSteps([]);
        setFitData(null);
        setAnalysisState(null);
        setPlotImages({ fit: null, residuals: null });
        setReportExpanded(false);
        setError('');

        try {
            // Build augmented instructions with model selection and fixed params
            let augmented = instructions;
            if (selectedModel !== 'auto') {
                if (selectedModel === 'custom' && customExpr.trim()) {
                    augmented += `\n\n[MODEL SELECTION: Use a custom model with expression: ${customExpr.trim()}]`;
                } else {
                    augmented += `\n\n[MODEL SELECTION: Use the ${selectedModel} model.]`;
                }
            }
            const fixedEntries = Object.entries(fixedParams).filter(([, v]) => v.trim() !== '');
            if (fixedEntries.length > 0) {
                const fixedStr = fixedEntries.map(([k, v]) => `${k}=${v}`).join(', ');
                augmented += `\n[FIXED PARAMETERS: Fix these parameters to the given values: ${fixedStr}]`;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('instructions', augmented);
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

    /* Results export handler (DOCX or PDF) */
    const handleExportResults = async () => {
        setResultsExporting(true);
        setResultsExportError(null);
        try {
            const normalized = analysisState ? normalizeAnalysisData(analysisState) : {};
            const exportData = {
                analysis_data: normalized,
                plots: plotImages,
                summary: summaryStep?.message || '',
                language: 'en',
            };
            const blob = exportFormat === 'docx'
                ? await exportResultsDocx(exportData)
                : await exportResultsPdf(exportData);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = exportFormat === 'docx' ? 'analysis-results.docx' : 'analysis-results.pdf';
            a.click();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            setResultsExportError(e?.response?.data?.error || e?.message || 'Export failed');
        } finally {
            setResultsExporting(false);
        }
    };

    const plotConfig = {
        responsive: true, displaylogo: false,
        toImageButtonOptions: { format: 'png' as any, filename: 'autolab_fit', height: 800, width: 1200, scale: 2 },
    };

    /** Export results as a clean table for pasting into Docs/Word/Sheets */
    const handleExportReport = () => {
        const names = fitStep?.result?.parameter_names as string[] || [];
        const params = fitStep?.result?.parameters || [];
        const uncs = fitStep?.result?.uncertainties || [];
        const modelKey = (fitStep?.args?.model || '').toLowerCase();
        const formula = MODEL_FORMULAS[modelKey] || fitStep?.args?.custom_expr || '';

        // Build HTML table
        let html = '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">';
        html += '<thead><tr style="background:#e3f2fd"><th>Quantity</th><th>Rounded</th><th>Full Precision</th></tr></thead><tbody>';

        // Parameter rows
        names.forEach((name: string, j: number) => {
            const v = Number(params[j]);
            const u = Number(uncs[j]);
            const fmt = roundWithUncertainty(v, u);
            html += `<tr><td>${name}</td><td>${fmt.rounded}</td><td>${fmt.unrounded}</td></tr>`;
        });

        // Chi-squared reduced
        if (fitStep?.result?.reduced_chi_squared != null) {
            const chi2 = Number(fitStep.result.reduced_chi_squared);
            html += `<tr><td>χ² reduced</td><td>${isFinite(chi2) ? chi2.toFixed(3) : '—'}</td><td>${isFinite(chi2) ? chi2 : '—'}</td></tr>`;
        }

        // P-value
        if (fitStep?.result?.p_value != null) {
            const pv = Number(fitStep.result.p_value);
            html += `<tr><td>P-value</td><td>${formatPValue(pv)}</td><td>${isFinite(pv) ? pv : '—'}</td></tr>`;
        }

        // Calculated formula result
        if (formulaStep?.result) {
            const val = Number(formulaStep.result.value);
            const unc = Number(formulaStep.result.uncertainty);
            const expr = formulaStep.args?.expression || '';
            if (isFinite(val) && isFinite(unc) && unc > 0) {
                const fmt = roundWithUncertainty(val, unc);
                html += `<tr><td>${expr}</td><td>${fmt.rounded}</td><td>${fmt.unrounded}</td></tr>`;
            } else {
                html += `<tr><td>${expr}</td><td>${formulaStep.result.formatted ?? '—'}</td><td>${smartFormat(val)} ± ${smartFormat(unc)}</td></tr>`;
            }
        }

        // N-sigma result
        if (nsigmaStep?.result) {
            const ns = Number(nsigmaStep.result.n_sigma);
            html += `<tr><td>N-σ</td><td>${ns.toFixed(2)}σ — ${nsigmaStep.result.verdict}</td><td>${ns}σ</td></tr>`;
        }

        // Fit formula row
        if (formula) {
            html += `<tr><td>Fit Formula</td><td colspan="2">${formula}</td></tr>`;
        }

        html += '</tbody></table>';

        // Plain text version (tab-separated)
        let plain = 'Quantity\tRounded\tFull Precision\n';
        names.forEach((name: string, j: number) => {
            const v = Number(params[j]);
            const u = Number(uncs[j]);
            const fmt = roundWithUncertainty(v, u);
            plain += `${name}\t${fmt.rounded}\t${fmt.unrounded}\n`;
        });
        if (fitStep?.result?.reduced_chi_squared != null) {
            const chi2 = Number(fitStep.result.reduced_chi_squared);
            plain += `χ² reduced\t${isFinite(chi2) ? chi2.toFixed(3) : '—'}\t${isFinite(chi2) ? chi2 : '—'}\n`;
        }
        if (fitStep?.result?.p_value != null) {
            const pv = Number(fitStep.result.p_value);
            plain += `P-value\t${formatPValue(pv)}\t${isFinite(pv) ? pv : '—'}\n`;
        }
        if (formulaStep?.result) {
            const val = Number(formulaStep.result.value);
            const unc = Number(formulaStep.result.uncertainty);
            const expr = formulaStep.args?.expression || '';
            const fmt = (isFinite(val) && isFinite(unc) && unc > 0) ? roundWithUncertainty(val, unc) : { rounded: String(formulaStep.result.formatted ?? '—'), unrounded: `${smartFormat(val)} ± ${smartFormat(unc)}` };
            plain += `${expr}\t${fmt.rounded}\t${fmt.unrounded}\n`;
        }
        if (nsigmaStep?.result) {
            const ns = Number(nsigmaStep.result.n_sigma);
            plain += `N-σ\t${ns.toFixed(2)}σ — ${nsigmaStep.result.verdict}\t${ns}σ\n`;
        }
        if (formula) {
            plain += `Fit Formula\t${formula}\n`;
        }

        // Copy as rich HTML table
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            const item = new ClipboardItem({
                'text/html': new Blob([html], { type: 'text/html' }),
                'text/plain': new Blob([plain], { type: 'text/plain' }),
            });
            navigator.clipboard.write([item]);
        } else {
            navigator.clipboard.writeText(plain);
        }
        setReportCopied(true);
        setTimeout(() => setReportCopied(false), 2000);
    };

    /* -- Derive structured result sections from steps -- */
    const summaryStep = steps.find(s => s.step === 'summary' && s.message);
    const fitStep = steps.find(s => s.step === 'fit' && s.success && s.result && !s.result.error);
    const formulaStep = steps.find(s => s.step === 'formula' && s.success && s.result && !s.result.error);
    const nsigmaStep = steps.find(s => s.step === 'nsigma' && s.success && s.result && !s.result.error);
    const errorSteps = steps.filter(s => s.success === false || s.result?.error);
    const hasResults = steps.length > 0;

    /* -- Resolve axis labels from parsed state or AI instructions -- */
    const xLabel = analysisState?.parsed?.x_col || 'X';
    const yLabel = analysisState?.parsed?.y_col || 'Y';

    /** Copy table as rich HTML (pastes as table in Docs/Word) + plain text fallback */
    const handleCopyTable = () => {
        const names = fitStep?.result?.parameter_names as string[] || [];
        const params = fitStep?.result?.parameters || [];
        const uncs = fitStep?.result?.uncertainties || [];

        // Plain text (tab-separated)
        const plainLines = ['Parameter\tRounded\tFull Precision'];
        names.forEach((name: string, j: number) => {
            const fmt = roundWithUncertainty(Number(params[j]), Number(uncs[j]));
            plainLines.push(`${name}\t${fmt.rounded}\t${fmt.unrounded}`);
        });
        const plainText = plainLines.join('\n');

        // Rich HTML table
        const htmlStr = buildHtmlTable(names, params, uncs, roundWithUncertainty);

        // Use Clipboard API with both formats
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            const item = new ClipboardItem({
                'text/html': new Blob([htmlStr], { type: 'text/html' }),
                'text/plain': new Blob([plainText], { type: 'text/plain' }),
            });
            navigator.clipboard.write([item]);
        } else {
            navigator.clipboard.writeText(plainText);
        }
        setTableCopied(true);
        setTimeout(() => setTableCopied(false), 1500);
    };

    return (
        <div className="card" style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {/* -- Header -- */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.8rem', margin: 0 }}>🤖 AutoLab</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem', fontSize: '1.05rem' }}>
                    🔬 AI-Powered Automated Analysis — Upload, Instruct, Get Results
                </p>
            </div>

            {/* === INPUT PANEL === */}
            <div>
                {/* File upload */}
                <div className="form-group">
                    <label style={{ fontWeight: 600, fontSize: '1rem' }}>📁 Data File</label>
                    <div
                        onClick={() => fileRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={e => {
                            e.preventDefault();
                            const f = e.dataTransfer.files[0];
                            if (f) handleFileChange(f);
                        }}
                        style={{
                            border: '2px dashed var(--primary)', borderRadius: '10px', padding: '1.5rem',
                            textAlign: 'center', cursor: 'pointer',
                            background: file ? 'var(--success-bg)' : 'var(--info-bg)', transition: 'all 0.2s',
                        }}
                    >
                        {file ? (
                            <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                                {file.name} ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                        ) : (
                            <span style={{ color: 'var(--primary)' }}>
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
                        <p style={{ color: 'var(--warning)', fontSize: '0.85rem', margin: '0.3rem 0 0' }}>
                            {previewError}
                        </p>
                    )}
                </div>

                {/* Data preview */}
                {previewData && (
                    <DataPreview columns={previewData.columns} rows={previewData.rows} />
                )}

                {/* Example datasets */}
                <div style={{
                    padding: '0.8rem 1rem', background: 'var(--success-bg)', borderRadius: '10px',
                    border: '1px solid var(--success-border)', marginBottom: '1rem',
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
                        rows={6}
                        placeholder={
                            'Tell the model about your analysis. Include:\n' +
                            '\n' +
                            '  - What experiment you performed (e.g. "RC discharge", "Hooke\'s law")\n' +
                            '  - Which fit model to use (linear, quadratic, exponential, sinusoidal, custom...)\n' +
                            '  - How your file is organized: column names for x, y, and errors\n' +
                            '  - Which sheet to use (if Excel with multiple sheets)\n' +
                            '  - Any formulas to calculate from fitted parameters (e.g. "period T = 2*pi/omega")\n' +
                            '  - Axis labels if you want custom names (e.g. "label x-axis as Time [s]")\n' +
                            '  - Theoretical values to compare against are entered below'
                        }
                        style={{ fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: 1.5 }}
                    />
                </div>

                {/* Fit Model Selection */}
                <div style={{
                    padding: '1rem', background: 'var(--info-bg)', borderRadius: '10px',
                    border: '1px solid var(--border)', marginBottom: '1rem',
                }}>
                    <p style={{ fontWeight: 600, margin: '0 0 0.5rem', fontSize: '0.95rem' }}>
                        📊 Fit Model
                    </p>
                    <select
                        value={selectedModel}
                        onChange={e => { setSelectedModel(e.target.value); setFixedParams({}); }}
                        style={{
                            width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.95rem',
                            border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)',
                            fontFamily: 'inherit', cursor: 'pointer',
                        }}
                    >
                        {FIT_MODEL_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label} — {opt.desc}
                            </option>
                        ))}
                    </select>

                    {/* Custom expression input */}
                    {selectedModel === 'custom' && (
                        <div style={{ marginTop: '0.6rem' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Custom expression (use x as variable):</label>
                            <input
                                type="text"
                                value={customExpr}
                                onChange={e => setCustomExpr(e.target.value)}
                                placeholder="e.g. A*exp(-x/tau) + C"
                                style={{
                                    width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.9rem',
                                    border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'monospace',
                                    marginTop: '0.3rem', boxSizing: 'border-box',
                                }}
                            />
                        </div>
                    )}

                    {/* Fixed parameters (show when a specific model is selected) */}
                    {selectedModel !== 'auto' && selectedModel !== 'custom' && MODEL_PARAMS[selectedModel] && (
                        <div style={{ marginTop: '0.6rem' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.4rem' }}>
                                🔒 Fix constants (leave blank to fit freely):
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {MODEL_PARAMS[selectedModel].map(param => (
                                    <div key={param} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <label style={{
                                            fontSize: '0.88rem', fontFamily: 'monospace',
                                            fontWeight: 600, color: 'var(--text)', minWidth: '1.5rem',
                                        }}>{param} =</label>
                                        <input
                                            type="text"
                                            value={fixedParams[param] || ''}
                                            onChange={e => setFixedParams(prev => ({ ...prev, [param]: e.target.value }))}
                                            placeholder="free"
                                            style={{
                                                width: '5rem', padding: '0.3rem 0.5rem',
                                                fontSize: '0.85rem', border: '1px solid var(--border)',
                                                borderRadius: '5px', fontFamily: 'monospace',
                                                background: fixedParams[param]?.trim() ? '#fff3e0' : 'var(--surface)',
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>
                                Tip: Set c=0 for no vertical offset, b=0 to remove a term, etc.
                            </p>
                        </div>
                    )}
                </div>

                {/* Theoretical value (optional) */}
                <div style={{
                    padding: '1rem', background: 'var(--surface-alt)', borderRadius: '10px',
                    border: '1px solid var(--border)', marginBottom: '1rem',
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
                        background: running ? '#90a4ae' : 'linear-gradient(135deg, #c62828, #d32f2f)',
                        border: 'none', borderRadius: '10px', color: 'white',
                        cursor: running ? 'wait' : 'pointer', transition: 'all 0.3s',
                    }}
                >
                    {running ? <span>🔄 AI is analyzing... please wait</span> : <span>🚀 Run AutoLab</span>}
                </button>

                {error && (
                    <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>
                )}
            </div>

            {/* === RESULTS SECTION === */}
            {hasResults && (
                <div style={{ marginTop: '2.5rem' }}>
                    <h3 style={{ color: 'var(--text)', marginBottom: '1.25rem', fontSize: '1.2rem' }}>
                        📊 Results
                    </h3>

                    {/* -- Errors -- */}
                    {errorSteps.length > 0 && (
                        <div style={{
                            padding: '0.8rem 1rem', borderRadius: '10px',
                            border: '2px solid var(--danger-border)', background: 'var(--danger-bg)', marginBottom: '1rem',
                        }}>
                            <strong>⚠️ Errors during analysis:</strong>
                            {errorSteps.map((s, i) => (
                                <p key={i} style={{ margin: '0.3rem 0 0', fontSize: '0.88rem', color: 'var(--danger)' }}>
                                    {s.step}: {s.result?.error || s.message}
                                </p>
                            ))}
                        </div>
                    )}

                    {/* -- AI Summary -- */}
                    {summaryStep && summaryStep.message && (
                        <div style={{
                            padding: '1rem 1.2rem', borderRadius: '10px',
                            background: 'var(--success-bg)', border: '1px solid var(--success-border)',
                            marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: 1.6,
                        }}>
                            <strong style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--success)' }}>
                                ✅ Analysis Summary
                            </strong>
                            <span style={{ color: 'var(--text)' }}>{summaryStep.message}</span>
                        </div>
                    )}

                    {/* -- Parameter table (raw results, shown first) -- */}
                    {fitStep && fitStep.result && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                            <h4 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>
                                Fit Parameters -- <em style={{ fontWeight: 400 }}>{fitStep.result.model_name || fitStep.args?.model}</em>
                                {(() => {
                                    const modelKey = (fitStep.args?.model || '').toLowerCase();
                                    const formula = MODEL_FORMULAS[modelKey] || (fitStep.args?.custom_expr ? fitStep.args.custom_expr : null);
                                    return formula ? (
                                        <span style={{ marginLeft: '0.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                            ({formula})
                                        </span>
                                    ) : null;
                                })()}
                            </h4>
                            <button
                                onClick={handleCopyTable}
                                style={{
                                    padding: '0.3rem 0.7rem', fontSize: '0.8rem',
                                    border: '1px solid var(--border)', borderRadius: '6px',
                                    background: tableCopied ? 'var(--success-bg)' : 'var(--surface)',
                                    color: tableCopied ? 'var(--success)' : 'var(--text-secondary)',
                                    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                                }}
                            >
                                {tableCopied ? '✅ Copied!' : '📋 Copy Table'}
                            </button>
                            </div>
                            <div style={{ overflowX: 'auto', userSelect: 'text' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--surface-alt)' }}>
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
                                                <tr key={name} style={{ background: j % 2 === 0 ? 'var(--surface)' : 'var(--surface-alt)' }}>
                                                    <td style={tdStyle}><strong>{name}</strong></td>
                                                    <td style={tdStyle}>{fmt.rounded}</td>
                                                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.82rem' }}>{fmt.unrounded}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {/* Fit statistics */}
                            <div style={{
                                marginTop: '0.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
                                fontSize: '0.88rem', color: 'var(--text-secondary)',
                                padding: '0.5rem 0.75rem', background: 'var(--surface-alt)', borderRadius: '6px',
                            }}>
                                {fitStep.result.reduced_chi_squared != null && (
                                    <span>{'\u03C7\u00B2'} reduced = <strong>{Number(fitStep.result.reduced_chi_squared).toFixed(3)}</strong></span>
                                )}
                                {fitStep.result.p_value != null && (
                                    <span>P = <strong>{formatPValue(Number(fitStep.result.p_value))}</strong></span>
                                )}
                                {fitStep.result.dof != null && (
                                    <span>dof = <strong>{fitStep.result.dof}</strong></span>
                                )}
                                {analysisState?.fit?.r_squared != null && (
                                    <span>R{'\u00B2'} = <strong>{Number(analysisState.fit.r_squared).toFixed(5)}</strong></span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* -- Formula result -- */}
                    {formulaStep && formulaStep.result && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 0.6rem', color: 'var(--text)', fontSize: '1rem' }}>
                                🔢 Formula Calculation
                            </h4>
                            <div style={{
                                padding: '0.85rem 1rem', background: 'var(--surface-alt)',
                                borderRadius: '8px', border: '1px solid var(--border)',
                                fontFamily: 'monospace', fontSize: '0.95rem',
                            }}>
                                <div style={{ marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                                    Expression: <strong style={{ color: 'var(--text)' }}>{formulaStep.args?.expression}</strong>
                                </div>
                                {(() => {
                                    const val = Number(formulaStep.result!.value);
                                    const unc = Number(formulaStep.result!.uncertainty);
                                    const fmt = (isFinite(val) && isFinite(unc) && unc > 0)
                                        ? roundWithUncertainty(val, unc)
                                        : { rounded: String(formulaStep.result!.formatted ?? '--'), unrounded: `${smartFormat(val)} \u00B1 ${smartFormat(unc)}` };
                                    return (
                                        <>
                                            <div>
                                                Result (rounded):&nbsp;
                                                <strong style={{ fontSize: '1.05rem', color: 'var(--text)' }}>{fmt.rounded}</strong>
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', marginTop: '0.25rem' }}>
                                                Full: {fmt.unrounded}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* -- N-sigma result -- */}
                    {nsigmaStep && nsigmaStep.result && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 0.6rem', color: 'var(--text)', fontSize: '1rem' }}>
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
                                    : String(formulaStep?.result?.formatted ?? '--');
                                return (
                                    <div style={{
                                        padding: '0.85rem 1rem', borderRadius: '8px',
                                        border: `2px solid ${col}`,
                                        background: ns <= 2 ? 'var(--success-bg)' : ns <= 3 ? 'var(--warning-bg)' : 'var(--danger-bg)',
                                    }}>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: col }}>
                                            N-{'\u03C3'} = {ns.toFixed(2)}
                                            <span style={{ fontSize: '0.95rem', fontWeight: 500, marginLeft: '0.75rem', color: 'var(--text)' }}>
                                                -- {nsigmaStep.result!.verdict}
                                            </span>
                                        </div>
                                        <div style={{ marginTop: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                            Measured: <strong>{measFmt}</strong>
                                            <span style={{ margin: '0 0.75rem', color: 'var(--text-muted)' }}>vs</span>
                                            Theoretical: <strong>{tv}{tu ? ` \u00B1 ${tu}` : ''}</strong>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* === FIT PLOT === */}
                    {fitData && fitData.x_data && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ color: 'var(--text)', margin: '0 0 0.5rem', fontSize: '1rem' }}>📈 Fit Plot</h4>
                            <div ref={fitPlotRef}>
                            <Plot
                                data={[
                                    {
                                        x: fitData.x_data,
                                        y: fitData.y_data,
                                        error_y: fitData.y_errors ? {
                                            type: 'data' as const, array: fitData.y_errors,
                                            visible: true, color: '#999', thickness: 1.5,
                                        } : undefined,
                                        error_x: fitData.x_errors ? {
                                            type: 'data' as const, array: fitData.x_errors,
                                            visible: true, color: '#999', thickness: 1.5,
                                        } : undefined,
                                        type: 'scatter' as const, mode: 'markers' as const,
                                        name: 'Data', marker: { size: 7, color: '#1565c0' },
                                    },
                                    {
                                        x: fitData.x_fit, y: fitData.y_fit,
                                        type: 'scatter' as const, mode: 'lines' as const,
                                        name: `Fit (${fitData.model_name})`,
                                        line: { width: 2.5, color: '#d32f2f' },
                                    },
                                ]}
                                layout={{
                                    title: { text: `Fit -- ${fitData.model_name}`, font: { color: '#333' } },
                                    xaxis: { title: { text: xLabel, font: { color: '#333' } }, gridcolor: '#ddd', tickfont: { color: '#333' } },
                                    yaxis: { title: { text: yLabel, font: { color: '#333' } }, gridcolor: '#ddd', tickfont: { color: '#333' } },
                                    height: 420, margin: { l: 60, r: 30, t: 55, b: 55 },
                                    legend: { x: 0, y: 1.15, orientation: 'h' as const, font: { color: '#333' } },
                                    plot_bgcolor: '#ffffff', paper_bgcolor: '#ffffff',
                                }}
                                useResizeHandler style={{ width: '100%' }} config={plotConfig}
                            />
                            </div>

                            {/* Residuals plot */}
                            {fitData.residuals && (
                                <div ref={residualsPlotRef}>
                                <Plot
                                    data={[{
                                        x: fitData.x_data, y: fitData.residuals,
                                        error_y: fitData.y_errors ? {
                                            type: 'data' as const, array: fitData.y_errors,
                                            visible: true, color: '#999', thickness: 1.5,
                                        } : undefined,
                                        error_x: fitData.x_errors ? {
                                            type: 'data' as const, array: fitData.x_errors,
                                            visible: true, color: '#999', thickness: 1.5,
                                        } : undefined,
                                        type: 'scatter' as const, mode: 'markers' as const,
                                        name: 'Residuals', marker: { size: 6, color: '#1565c0' },
                                    }, {
                                        x: [Math.min(...fitData.x_data), Math.max(...fitData.x_data)],
                                        y: [0, 0],
                                        type: 'scatter' as const, mode: 'lines' as const,
                                        line: { width: 1.5, color: '#999', dash: 'dash' },
                                        showlegend: false,
                                    }]}
                                    layout={{
                                        title: { text: 'Residuals (data \u2212 fit)', font: { color: '#333' } },
                                        xaxis: { title: { text: xLabel, font: { color: '#333' } }, gridcolor: '#ddd', tickfont: { color: '#333' } },
                                        yaxis: { title: { text: `${yLabel} \u2212 f(${xLabel})`, font: { color: '#333' } }, gridcolor: '#ddd', tickfont: { color: '#333' } },
                                        height: 280, margin: { l: 60, r: 30, t: 45, b: 45 },
                                        plot_bgcolor: '#ffffff', paper_bgcolor: '#ffffff',
                                    }}
                                    useResizeHandler style={{ width: '100%' }} config={plotConfig}
                                />
                                </div>
                            )}
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
                                Use the camera icon on each plot to download as PNG.
                            </p>
                        </div>
                    )}

                    {/* === EXPORT BUTTONS === */}
                    {fitStep && (
                        <div style={{
                            marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap',
                        }}>
                            <button
                                onClick={handleExportReport}
                                style={{
                                    padding: '0.6rem 1.5rem', fontSize: '0.95rem',
                                    border: '2px solid var(--primary)', borderRadius: '8px',
                                    background: reportCopied ? 'var(--success-bg)' : 'var(--info-bg)',
                                    color: reportCopied ? 'var(--success)' : 'var(--primary)',
                                    cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
                                    fontFamily: "'Inter', sans-serif",
                                }}
                            >
                                {reportCopied ? '✅ Report Copied to Clipboard!' : '📋 Copy Results as Lab Report'}
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <select
                                    value={exportFormat}
                                    onChange={e => setExportFormat(e.target.value as 'docx' | 'pdf')}
                                    style={{
                                        padding: '0.6rem 0.8rem', fontSize: '0.95rem',
                                        border: '2px solid var(--primary)', borderRadius: '8px',
                                        background: 'var(--surface)', color: 'var(--primary)',
                                        fontWeight: 600, fontFamily: "'Inter', sans-serif",
                                        cursor: 'pointer',
                                    }}
                                >
                                    <option value="docx">DOCX (Recommended)</option>
                                    <option value="pdf">PDF</option>
                                </select>
                                <button
                                    onClick={handleExportResults}
                                    disabled={resultsExporting}
                                    style={{
                                        padding: '0.6rem 1.5rem', fontSize: '0.95rem',
                                        border: '2px solid var(--primary)', borderRadius: '8px',
                                        background: resultsExporting ? 'var(--surface-alt)' : 'var(--surface)',
                                        color: 'var(--primary)',
                                        cursor: resultsExporting ? 'wait' : 'pointer',
                                        fontWeight: 600, transition: 'all 0.2s',
                                        fontFamily: "'Inter', sans-serif",
                                    }}
                                >
                                    {resultsExporting ? '⏳ Exporting...' : exportFormat === 'docx' ? '📄 Export as DOCX' : '📄 Export as PDF'}
                                </button>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', textAlign: 'center' }}>
                                DOCX recommended — editable equations, better Word compatibility
                            </p>
                        </div>
                    )}
                    {resultsExportError && (
                        <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '8px', textAlign: 'center' }}>
                            Export failed: {resultsExportError}. Please try again.
                        </p>
                    )}

                    {/* Report Expander + Full Report Section (D-01, D-03) */}
                    <ReportExpander expanded={reportExpanded} onToggle={() => setReportExpanded(prev => !prev)}>
                        <ReportSection
                            analysisData={analysisState}
                            plotImages={plotImages}
                            initialTitle={file?.name?.replace(/\.(xlsx?|csv|tsv|ods)$/i, '').replace(/[_-]/g, ' ') || ''}
                            instructions={instructions}
                            demoContext={demoReportContext}
                        />
                    </ReportExpander>
                </div>
            )}
        </div>
    );
}

export default AutoLab;
