import { useState, useRef, useEffect } from 'react';
import Plot from './PlotWrapper';
import DataPreview from './DataPreview';
import { useAnalysis } from '../context/AnalysisContext';
import * as api from '../services/api';
import { fitData, evaluateFormula, calculateNSigma, autolabChat } from '../services/api';
import { roundWithUncertainty, smartFormat, formatPValue } from '../utils/format';
import ReportSection from './report/ReportSection';
import ReportExpander from './report/ReportExpander';
import { normalizeAnalysisData } from '../utils/normalize';
import { exportResultsPdf, exportResultsDocx } from '../services/api';
// @ts-ignore - plotly.js-dist-min has no types
import Plotly from 'plotly.js-dist-min';

/* ===================================================================
   AutoLab -- Automated Analysis
   Upload data + configure form -> get complete results
   =================================================================== */

/* -- Built-in example datasets -- */
const EXAMPLE_DATASETS = [
    {
        label: 'Free Fall (Quadratic)',
        xCol: 'Time_s',
        yCol: 'Height_m',
        xErrCol: 'Time_Error_s',
        yErrCol: 'Height_Error_m',
        xLabel: 'Time [s]',
        yLabel: 'Height [m]',
        model: 'quadratic',
        formulaExpr: '2*a',
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
            notes: 'Goal: Verify the free-fall acceleration g by dropping a metal ball from rest and measuring its height h as a function of time t. According to kinematics, h(t) = \u00BDgt\u00B2 + v\u2080t + h\u2080. Since the ball starts from rest (v\u2080 \u2248 0), fitting a quadratic h = at\u00B2 + bt + c gives g = 2a. A photogate sensor recorded times at 0.1 s intervals while the ball fell ~11 m. Height uncertainty grows with distance due to parallax. Compare the extracted g to the accepted value 9.81 \u00B1 0.01 m/s\u00B2 using an n-sigma test.',
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

/** Model formula map for display */
const MODEL_FORMULAS: Record<string, string> = {
    linear: 'y = ax + b',
    quadratic: 'y = ax\u00B2 + bx + c',
    cubic: 'y = ax\u00B3 + bx\u00B2 + cx + d',
    power: 'y = ax\u1D47 + c',
    exponential: 'y = ae^(bx) + c',
    sinusoidal: 'y = A\u00B7sin(\u03C9x + \u03C6) + D',
    fractional: 'y = a/(b\u00B7x+c) + d',
    gaussian: 'y = A\u00B7exp(-(x-\u03BC)\u00B2/(2\u03C3\u00B2)) + D',
};

/** Parameter names for each model (used for fixing constants) */
const MODEL_PARAMS: Record<string, string[]> = {
    linear: ['a', 'b'],
    quadratic: ['a', 'b', 'c'],
    cubic: ['a', 'b', 'c', 'd'],
    power: ['a', 'b', 'c'],
    exponential: ['a', 'b', 'c'],
    sinusoidal: ['A', 'omega', 'phi', 'D'],
    fractional: ['a', 'b', 'c', 'd'],
    gaussian: ['A', 'mu', 'sigma', 'D'],
};

/** Fit model options for the dropdown (no Auto option -- D-05) */
const FIT_MODEL_OPTIONS = [
    { value: 'linear', label: '\uD83D\uDCCF Linear', desc: 'y = ax + b' },
    { value: 'quadratic', label: '\uD83D\uDCD0 Quadratic', desc: 'y = ax\u00B2 + bx + c' },
    { value: 'cubic', label: '\uD83D\uDD23 Cubic', desc: 'y = ax\u00B3 + bx\u00B2 + cx + d' },
    { value: 'power', label: '\u26A1 Power', desc: 'y = ax\u1D47 + c' },
    { value: 'exponential', label: '\uD83D\uDCC8 Exponential', desc: 'y = ae^(bx) + c' },
    { value: 'sinusoidal', label: '\uD83C\uDF0A Sinusoidal', desc: 'y = A\u00B7sin(\u03C9x + \u03C6) + D' },
    { value: 'fractional', label: '\u2797 Fractional', desc: 'y = a/(b\u00B7x+c) + d' },
    { value: 'gaussian', label: '\uD83D\uDD14 Gaussian', desc: 'y = A\u00B7exp(-(x-\u03BC)\u00B2/(2\u03C3\u00B2)) + D' },
    { value: 'custom', label: '\u270F\uFE0F Custom', desc: 'Enter your own expression' },
];

/** N-sigma colour: green <= 2, orange 2-3, red > 3 */
function nsigmaColor(ns: number): string {
    if (ns <= 2) return '#2e7d32';
    if (ns <= 3) return '#e65100';
    return '#c62828';
}

/** Auto-detect column assignments from column names */
function autoDetectColumns(columns: string[]): { xCol: string; yCol: string; xErrCol: string; yErrCol: string } {
    const errPattern = /error|err|uncertainty|unc|delta|sigma/i;
    const errorCols = columns.filter(c => errPattern.test(c));
    const dataCols = columns.filter(c => !errPattern.test(c));

    const xCol = dataCols[0] || '';
    const yCol = dataCols[1] || '';

    // Try to match error columns to their data columns
    let xErrCol = 'None';
    let yErrCol = 'None';
    for (const ec of errorCols) {
        const ecLower = ec.toLowerCase();
        if (xCol && ecLower.includes(xCol.toLowerCase().replace(/[_\s]/g, '').substring(0, 4))) {
            xErrCol = ec;
        } else if (yCol && ecLower.includes(yCol.toLowerCase().replace(/[_\s]/g, '').substring(0, 4))) {
            yErrCol = ec;
        } else if (yErrCol === 'None') {
            yErrCol = ec;
        } else if (xErrCol === 'None') {
            xErrCol = ec;
        }
    }

    return { xCol, yCol, xErrCol, yErrCol };
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
    const [theoVal, setTheoVal] = useState('');
    const [theoUnc, setTheoUnc] = useState('');

    /* Fit model selection */
    const [selectedModel, setSelectedModel] = useState('linear');
    const [customExpr, setCustomExpr] = useState('');
    const [fixedParams, setFixedParams] = useState<Record<string, string>>({});

    /* Column assignment (D-03) */
    const [xCol, setXCol] = useState('');
    const [yCol, setYCol] = useState('');
    const [xErrCol, setXErrCol] = useState('None');
    const [yErrCol, setYErrCol] = useState('None');
    const [xLabel, setXLabel] = useState('');
    const [yLabel, setYLabel] = useState('');
    const [formulaExpr, setFormulaExpr] = useState('');
    const [extraParams, setExtraParams] = useState<{ name: string; value: string; uncertainty: string }[]>([]);

    /* Analysis data for plot rendering */
    const [analysisXData, setAnalysisXData] = useState<number[]>([]);
    const [analysisYData, setAnalysisYData] = useState<number[]>([]);
    const [analysisYErrors, setAnalysisYErrors] = useState<number[] | null>(null);
    const [analysisXErrors, setAnalysisXErrors] = useState<number[] | null>(null);

    /* Direct result state (replaces steps/fitData/analysisState) */
    const [fitResult, setFitResult] = useState<any>(null);
    const [formulaResult, setFormulaResult] = useState<any>(null);
    const [nsigmaResult, setNsigmaResult] = useState<any>(null);
    const [summaryText, setSummaryText] = useState<string | null>(null);

    const [running, setRunning] = useState(false);
    const [error, setError] = useState('');

    /* Data preview state */
    const [previewData, setPreviewData] = useState<{ columns: string[]; rows: Record<string, any>[] } | null>(null);
    const [previewError, setPreviewError] = useState('');
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState('');

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
        if (fitResult && !plotImages.fit) {
            const timer = setTimeout(capturePlots, 500);
            return () => clearTimeout(timer);
        }
    }, [fitResult, plotImages.fit]);

    /** Preview-limited row count (only first N rows sent from backend) */
    const PREVIEW_MAX_ROWS = 15;

    /* Apply auto-detect when preview data changes */
    const applyAutoDetect = (columns: string[]) => {
        const detected = autoDetectColumns(columns);
        setXCol(detected.xCol);
        setYCol(detected.yCol);
        setXErrCol(detected.xErrCol);
        setYErrCol(detected.yErrCol);
        if (detected.xCol) setXLabel(detected.xCol.replace(/[_]/g, ' '));
        if (detected.yCol) setYLabel(detected.yCol.replace(/[_]/g, ' '));
    };

    /* Parse file for preview when user selects one */
    const handleFileChange = async (f: File) => {
        setFile(f);
        setPreviewData(null);
        setPreviewError('');
        setSheetNames([]);
        setSelectedSheet('');
        try {
            const isExcel = f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.xlsm') || f.name.endsWith('.xlsb');
            if (isExcel) {
                const info = await api.parseFileInfo(f);
                if (info.sheet_names.length > 1) {
                    setSheetNames(info.sheet_names);
                    setSelectedSheet(info.sheet_names[0]);
                    await loadPreviewForSheet(f, info.sheet_names[0]);
                    return;
                }
                const data = await api.parseFileData(f, info.sheet_names[0], PREVIEW_MAX_ROWS);
                if (Array.isArray(data?.columns) && data.columns.length > 0 && Array.isArray(data?.rows)) {
                    const cols = data.columns.map(String);
                    setPreviewData({ columns: cols, rows: data.rows });
                    applyAutoDetect(cols);
                }
            } else {
                const data = await api.parseFileData(f, undefined, PREVIEW_MAX_ROWS);
                if (Array.isArray(data?.columns) && data.columns.length > 0 && Array.isArray(data?.rows)) {
                    const cols = data.columns.map(String);
                    setPreviewData({ columns: cols, rows: data.rows });
                    applyAutoDetect(cols);
                }
            }
        } catch {
            setPreviewError('Could not preview file -- analysis will still work when you click Run.');
        }
    };

    /* Load a specific sheet for preview (multi-sheet Excel) */
    const loadPreviewForSheet = async (f: File, sheet: string) => {
        setPreviewError('');
        setPreviewData(null);
        try {
            const data = await api.parseFileData(f, sheet, PREVIEW_MAX_ROWS);
            if (Array.isArray(data?.columns) && data.columns.length > 0 && Array.isArray(data?.rows)) {
                const cols = data.columns.map(String);
                setPreviewData({ columns: cols, rows: data.rows });
                applyAutoDetect(cols);
            }
        } catch {
            setPreviewError('Could not load sheet preview.');
        }
    };

    /* Auto-load preview when sheet selection changes */
    const handleSheetChange = (sheet: string) => {
        setSelectedSheet(sheet);
        if (file) loadPreviewForSheet(file, sheet);
    };

    /* Load example dataset -- pre-fills structured form fields (D-08) */
    const loadExample = (ex: typeof EXAMPLE_DATASETS[0]) => {
        const f = rowsToFile(ex.columns, ex.rows, `${ex.label.replace(/\s+/g, '_')}.csv`);
        setFile(f);
        setPreviewData({ columns: ex.columns, rows: ex.rows });
        setSheetNames([]);
        setSelectedSheet('');

        // Set structured form fields
        setXCol(ex.xCol);
        setYCol(ex.yCol);
        setXErrCol(ex.xErrCol);
        setYErrCol(ex.yErrCol);
        setXLabel(ex.xLabel);
        setYLabel(ex.yLabel);
        setSelectedModel(ex.model);
        setFormulaExpr(ex.formulaExpr);
        setTheoVal(ex.theoVal || '');
        setTheoUnc(ex.theoUnc || '');
        setCustomExpr('');
        setFixedParams({});
        setExtraParams([]);

        // Clear previous results
        setFitResult(null);
        setFormulaResult(null);
        setNsigmaResult(null);
        setSummaryText(null);
        setPlotImages({ fit: null, residuals: null });
        setReportExpanded(false);
        setError('');

        if (ex.reportContext) {
            setDemoReportContext({ ...ex.reportContext, titlePage: ex.titlePage });
        } else {
            setDemoReportContext(null);
        }
    };

    /* Direct API pipeline (D-02) -- replaces AI orchestrator */
    const handleRunAnalysis = async () => {
        if (!file || !previewData || !xCol || !yCol) return;
        setRunning(true);
        setFitResult(null);
        setFormulaResult(null);
        setNsigmaResult(null);
        setSummaryText(null);
        setPlotImages({ fit: null, residuals: null });
        setReportExpanded(false);
        setError('');

        try {
            // 1. Extract data arrays from previewData -- need FULL data, not just preview
            // Re-parse the full file to get all rows
            let allRows: Record<string, any>[];
            try {
                const fullData = await api.parseFileData(file, selectedSheet || undefined);
                allRows = fullData.rows;
            } catch {
                // Fallback to preview rows if full parse fails
                allRows = previewData.rows;
            }

            const xRaw = allRows.map(r => Number(r[xCol]));
            const yRaw = allRows.map(r => Number(r[yCol]));
            const yErrRaw = yErrCol !== 'None' ? allRows.map(r => Number(r[yErrCol])) : null;
            const xErrRaw = xErrCol !== 'None' ? allRows.map(r => Number(r[xErrCol])) : null;

            // Filter: keep only rows where BOTH x and y are valid numbers
            const validIndices = xRaw.map((x, i) => (!isNaN(x) && !isNaN(yRaw[i])) ? i : -1).filter(i => i >= 0);
            const xData = validIndices.map(i => xRaw[i]);
            const yData = validIndices.map(i => yRaw[i]);
            const yErrors = yErrRaw ? validIndices.map(i => yErrRaw[i]) : undefined;
            const xErrors = xErrRaw ? validIndices.map(i => xErrRaw[i]) : undefined;

            setAnalysisXData(xData);
            setAnalysisYData(yData);
            setAnalysisYErrors(yErrors ?? null);
            setAnalysisXErrors(xErrors ?? null);

            // 2. Call /api/fitting/fit
            const fitPayload: any = { x_data: xData, y_data: yData, model: selectedModel };
            if (yErrors && yErrors.length === yData.length) fitPayload.y_errors = yErrors;
            if (selectedModel === 'custom' && customExpr.trim()) fitPayload.custom_expr = customExpr.trim();
            const fixedEntries = Object.entries(fixedParams).filter(([, v]) => v.trim() !== '');
            if (fixedEntries.length > 0) {
                const paramNames = MODEL_PARAMS[selectedModel] || [];
                const guess = paramNames.map(p => {
                    const fixed = fixedParams[p];
                    return fixed?.trim() ? parseFloat(fixed) : 1;
                });
                fitPayload.initial_guess = guess;
            }

            const fitRes = await fitData(fitPayload);
            if (fitRes.error) throw new Error(fitRes.error);
            setFitResult(fitRes);

            // 3. If formula expression provided, call /api/formula/evaluate
            let fResult = null;
            if (formulaExpr.trim()) {
                const vars: Record<string, number> = {};
                const uncs: Record<string, number> = {};
                fitRes.parameter_names.forEach((name: string, i: number) => {
                    vars[name] = fitRes.parameters[i];
                    uncs[name] = fitRes.uncertainties[i];
                });
                // Include user-defined extra parameters
                for (const ep of extraParams) {
                    if (ep.name.trim() && ep.value.trim()) {
                        vars[ep.name.trim()] = parseFloat(ep.value);
                        uncs[ep.name.trim()] = ep.uncertainty.trim() ? parseFloat(ep.uncertainty) : 0;
                    }
                }
                fResult = await evaluateFormula({
                    expression: formulaExpr.trim(),
                    is_latex: false,
                    variables: vars,
                    uncertainties: uncs,
                });
                if (fResult.error) throw new Error(fResult.error);
                setFormulaResult(fResult);
            }

            // 4. If theoretical value provided AND formula result exists, call /api/nsigma/calculate
            let nsResult = null;
            if (theoVal.trim() && fResult && !fResult.error) {
                nsResult = await calculateNSigma({
                    value1: fResult.value,
                    uncertainty1: fResult.uncertainty,
                    value2: parseFloat(theoVal),
                    uncertainty2: parseFloat(theoUnc) || 0,
                });
                if (nsResult.error) throw new Error(nsResult.error);
                setNsigmaResult(nsResult);
            }

            // 5. AI summary via /api/autolab/chat
            const context: any = {
                fit: {
                    model_name: fitRes.model_name,
                    parameter_names: fitRes.parameter_names,
                    parameters: fitRes.parameters,
                    uncertainties: fitRes.uncertainties,
                    reduced_chi_squared: fitRes.reduced_chi_squared,
                    p_value: fitRes.p_value,
                    r_squared: fitRes.r_squared,
                },
            };
            if (fResult) context.formula = { expression: formulaExpr, ...fResult };
            if (nsResult) context.nsigma = { ...nsResult, theoretical_value: parseFloat(theoVal), theoretical_uncertainty: parseFloat(theoUnc) || 0 };
            try {
                const chatRes = await autolabChat({
                    messages: [{ role: 'user', content: 'Summarize these analysis results in 3-5 sentences for a lab report.' }],
                    context,
                });
                setSummaryText(chatRes.reply);
            } catch { /* summary is non-critical */ }

            // 6. Share with sidebar context
            setAutolabResults({ fit: context.fit, formula: context.formula, nsigma: context.nsigma, filename: file?.name });

        } catch (err: any) {
            setError(err.message || 'Analysis failed');
        } finally {
            setRunning(false);
        }
    };

    /* Results export handler (DOCX or PDF) */
    const handleExportResults = async () => {
        setResultsExporting(true);
        setResultsExportError(null);
        try {
            const stateForNormalize: Record<string, any> = {
                fit: fitResult ? {
                    ...fitResult,
                    x_data: analysisXData,
                    y_data: analysisYData,
                    x_errors: analysisXErrors,
                    y_errors: analysisYErrors,
                } : undefined,
                formula: formulaResult ? { expression: formulaExpr, ...formulaResult } : undefined,
                nsigma: nsigmaResult ? { ...nsigmaResult, theoretical_value: parseFloat(theoVal), theoretical_uncertainty: parseFloat(theoUnc) || 0 } : undefined,
            };
            const normalized = normalizeAnalysisData(stateForNormalize);
            const exportData = {
                analysis_data: normalized,
                plots: plotImages,
                summary: summaryText || '',
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
        const names = fitResult?.parameter_names as string[] || [];
        const params = fitResult?.parameters || [];
        const uncs = fitResult?.uncertainties || [];
        const modelKey = selectedModel.toLowerCase();
        const formula = MODEL_FORMULAS[modelKey] || customExpr || '';

        let html = '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">';
        html += '<thead><tr style="background:#e3f2fd"><th>Quantity</th><th>Rounded</th><th>Full Precision</th></tr></thead><tbody>';

        names.forEach((name: string, j: number) => {
            const v = Number(params[j]);
            const u = Number(uncs[j]);
            const fmt = roundWithUncertainty(v, u);
            html += `<tr><td>${name}</td><td>${fmt.rounded}</td><td>${fmt.unrounded}</td></tr>`;
        });

        if (fitResult?.reduced_chi_squared != null) {
            const chi2 = Number(fitResult.reduced_chi_squared);
            html += `<tr><td>\u03C7\u00B2 reduced</td><td>${isFinite(chi2) ? chi2.toFixed(3) : '\u2014'}</td><td>${isFinite(chi2) ? chi2 : '\u2014'}</td></tr>`;
        }

        if (fitResult?.p_value != null) {
            const pv = Number(fitResult.p_value);
            html += `<tr><td>P-value</td><td>${formatPValue(pv)}</td><td>${isFinite(pv) ? pv : '\u2014'}</td></tr>`;
        }

        if (formulaResult) {
            const val = Number(formulaResult.value);
            const unc = Number(formulaResult.uncertainty);
            if (isFinite(val) && isFinite(unc) && unc > 0) {
                const fmt = roundWithUncertainty(val, unc);
                html += `<tr><td>${formulaExpr}</td><td>${fmt.rounded}</td><td>${fmt.unrounded}</td></tr>`;
            } else {
                html += `<tr><td>${formulaExpr}</td><td>${formulaResult.formatted ?? '\u2014'}</td><td>${smartFormat(val)} \u00B1 ${smartFormat(unc)}</td></tr>`;
            }
        }

        if (nsigmaResult) {
            const ns = Number(nsigmaResult.n_sigma);
            html += `<tr><td>N-\u03C3</td><td>${ns.toFixed(2)}\u03C3 \u2014 ${nsigmaResult.verdict}</td><td>${ns}\u03C3</td></tr>`;
        }

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
        if (fitResult?.reduced_chi_squared != null) {
            const chi2 = Number(fitResult.reduced_chi_squared);
            plain += `\u03C7\u00B2 reduced\t${isFinite(chi2) ? chi2.toFixed(3) : '\u2014'}\t${isFinite(chi2) ? chi2 : '\u2014'}\n`;
        }
        if (fitResult?.p_value != null) {
            const pv = Number(fitResult.p_value);
            plain += `P-value\t${formatPValue(pv)}\t${isFinite(pv) ? pv : '\u2014'}\n`;
        }
        if (formulaResult) {
            const val = Number(formulaResult.value);
            const unc = Number(formulaResult.uncertainty);
            const fmt = (isFinite(val) && isFinite(unc) && unc > 0) ? roundWithUncertainty(val, unc) : { rounded: String(formulaResult.formatted ?? '\u2014'), unrounded: `${smartFormat(val)} \u00B1 ${smartFormat(unc)}` };
            plain += `${formulaExpr}\t${fmt.rounded}\t${fmt.unrounded}\n`;
        }
        if (nsigmaResult) {
            const ns = Number(nsigmaResult.n_sigma);
            plain += `N-\u03C3\t${ns.toFixed(2)}\u03C3 \u2014 ${nsigmaResult.verdict}\t${ns}\u03C3\n`;
        }
        if (formula) {
            plain += `Fit Formula\t${formula}\n`;
        }

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

    const hasResults = !!fitResult;

    /** Copy table as rich HTML (pastes as table in Docs/Word) + plain text fallback */
    const handleCopyTable = () => {
        const names = fitResult?.parameter_names as string[] || [];
        const params = fitResult?.parameters || [];
        const uncs = fitResult?.uncertainties || [];

        const plainLines = ['Parameter\tRounded\tFull Precision'];
        names.forEach((name: string, j: number) => {
            const fmt = roundWithUncertainty(Number(params[j]), Number(uncs[j]));
            plainLines.push(`${name}\t${fmt.rounded}\t${fmt.unrounded}`);
        });
        const plainText = plainLines.join('\n');

        const htmlStr = buildHtmlTable(names, params, uncs, roundWithUncertainty);

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

    /* Column dropdown style */
    const colSelectStyle: React.CSSProperties = {
        width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.9rem',
        border: '1px solid var(--border)', borderRadius: '6px',
        background: 'var(--surface)', fontFamily: 'inherit',
    };

    return (
        <div className="card" style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {/* -- Header -- */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.8rem', margin: 0 }}>🔬 AutoLab</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem', fontSize: '1.05rem' }}>
                    Automated Analysis — Upload, Configure, Get Results
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

                {/* Sheet selector for multi-sheet Excel */}
                {sheetNames.length > 1 && (
                    <div className="form-group">
                        <label>Select sheet</label>
                        <select value={selectedSheet} onChange={e => handleSheetChange(e.target.value)} style={{ width: '100%' }}>
                            {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                )}

                {/* Data preview */}
                {previewData && (
                    <DataPreview columns={previewData.columns} rows={previewData.rows} />
                )}

                {/* Column Assignment (D-03, D-04) -- shown after file upload */}
                {previewData && (
                    <div style={{
                        padding: '1rem', background: 'var(--info-bg)', borderRadius: '10px',
                        border: '1px solid var(--border)', marginBottom: '1rem',
                    }}>
                        <p style={{ fontWeight: 600, margin: '0 0 0.6rem', fontSize: '0.95rem' }}>
                            📊 Column Assignment
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>X Column</label>
                                <select value={xCol} onChange={e => { setXCol(e.target.value); setXLabel(e.target.value.replace(/[_]/g, ' ')); }} style={colSelectStyle}>
                                    <option value="">-- select --</option>
                                    {previewData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Y Column</label>
                                <select value={yCol} onChange={e => { setYCol(e.target.value); setYLabel(e.target.value.replace(/[_]/g, ' ')); }} style={colSelectStyle}>
                                    <option value="">-- select --</option>
                                    {previewData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>X Error (optional)</label>
                                <select value={xErrCol} onChange={e => setXErrCol(e.target.value)} style={colSelectStyle}>
                                    <option value="None">None</option>
                                    {previewData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Y Error (optional)</label>
                                <select value={yErrCol} onChange={e => setYErrCol(e.target.value)} style={colSelectStyle}>
                                    <option value="None">None</option>
                                    {previewData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        {/* Axis labels */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.6rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>X Axis Label</label>
                                <input type="text" value={xLabel} onChange={e => setXLabel(e.target.value)}
                                    placeholder="e.g. Time [s]"
                                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.9rem', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Y Axis Label</label>
                                <input type="text" value={yLabel} onChange={e => setYLabel(e.target.value)}
                                    placeholder="e.g. Height [m]"
                                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.9rem', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Example datasets */}
                <div style={{
                    padding: '0.8rem 1rem', background: 'var(--success-bg)', borderRadius: '10px',
                    border: '1px solid var(--success-border)', marginBottom: '1rem',
                }}>
                    <p style={{ fontWeight: 600, margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                        🧪 Try an example (loads data + form fields):
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
                    {selectedModel !== 'custom' && MODEL_PARAMS[selectedModel] && (
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

                {/* Formula Expression (optional, D-06) */}
                <div style={{
                    padding: '1rem', background: 'var(--surface-alt)', borderRadius: '10px',
                    border: '1px solid var(--border)', marginBottom: '1rem',
                }}>
                    <p style={{ fontWeight: 600, margin: '0 0 0.5rem', fontSize: '0.95rem' }}>
                        🔢 Formula Expression (optional)
                    </p>
                    <input
                        type="text"
                        value={formulaExpr}
                        onChange={e => setFormulaExpr(e.target.value)}
                        placeholder="e.g. 2*a for g from quadratic fit"
                        style={{
                            width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.9rem',
                            border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'monospace',
                            boxSizing: 'border-box',
                        }}
                    />
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>
                        Calculate a derived quantity from fit parameters.
                        {selectedModel && MODEL_PARAMS[selectedModel] && (
                            <> Fit parameters: <strong>{MODEL_PARAMS[selectedModel].join(', ')}</strong></>
                        )}
                    </p>

                    {/* Extra user-defined parameters for formula */}
                    {extraParams.length > 0 && (
                        <div style={{ marginTop: '0.6rem' }}>
                            {extraParams.map((ep, i) => (
                                <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                                    <input type="text" value={ep.name} placeholder="name"
                                        onChange={e => { const arr = [...extraParams]; arr[i] = { ...arr[i], name: e.target.value }; setExtraParams(arr); }}
                                        style={{ width: '5rem', padding: '0.3rem 0.5rem', fontSize: '0.85rem', fontFamily: 'monospace', border: '1px solid var(--border)', borderRadius: '5px' }} />
                                    <span style={{ fontSize: '0.85rem' }}>=</span>
                                    <input type="text" value={ep.value} placeholder="value"
                                        onChange={e => { const arr = [...extraParams]; arr[i] = { ...arr[i], value: e.target.value }; setExtraParams(arr); }}
                                        style={{ width: '6rem', padding: '0.3rem 0.5rem', fontSize: '0.85rem', fontFamily: 'monospace', border: '1px solid var(--border)', borderRadius: '5px' }} />
                                    <span style={{ fontSize: '0.85rem' }}>±</span>
                                    <input type="text" value={ep.uncertainty} placeholder="unc."
                                        onChange={e => { const arr = [...extraParams]; arr[i] = { ...arr[i], uncertainty: e.target.value }; setExtraParams(arr); }}
                                        style={{ width: '6rem', padding: '0.3rem 0.5rem', fontSize: '0.85rem', fontFamily: 'monospace', border: '1px solid var(--border)', borderRadius: '5px' }} />
                                    <button onClick={() => setExtraParams(extraParams.filter((_, j) => j !== i))}
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--border)', borderRadius: '5px', background: 'var(--surface)', cursor: 'pointer' }}>
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <button onClick={() => setExtraParams([...extraParams, { name: '', value: '', uncertainty: '' }])}
                        style={{ marginTop: '0.4rem', padding: '0.3rem 0.7rem', fontSize: '0.8rem', border: '1px solid var(--border)', borderRadius: '5px', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        + Add parameter
                    </button>
                </div>

                {/* Theoretical value (optional) */}
                <div style={{
                    padding: '1rem', background: 'var(--surface-alt)', borderRadius: '10px',
                    border: '1px solid var(--border)', marginBottom: '1rem',
                }}>
                    <p style={{ fontWeight: 600, margin: '0 0 0.5rem', fontSize: '0.95rem' }}>
                        🎯 Theoretical Value (optional)
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
                        Requires a formula expression above to specify which quantity to compare.
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
                    onClick={handleRunAnalysis}
                    disabled={running || !file || !xCol || !yCol || !selectedModel}
                    className="btn-primary"
                    style={{
                        width: '100%', fontSize: '1.15rem', padding: '0.9rem',
                        background: running ? '#90a4ae' : 'linear-gradient(135deg, #1565c0, #1976d2)',
                        border: 'none', borderRadius: '10px', color: 'white',
                        cursor: running ? 'wait' : 'pointer', transition: 'all 0.3s',
                    }}
                >
                    {running ? <span>🔄 Analyzing... please wait</span> : <span>🚀 Run Analysis</span>}
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

                    {/* -- AI Summary -- */}
                    {summaryText && (
                        <div style={{
                            padding: '1rem 1.2rem', borderRadius: '10px',
                            background: 'var(--success-bg)', border: '1px solid var(--success-border)',
                            marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: 1.6,
                        }}>
                            <strong style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--success)' }}>
                                ✅ Analysis Summary
                            </strong>
                            <span style={{ color: 'var(--text)' }}>{summaryText}</span>
                        </div>
                    )}

                    {/* -- Parameter table -- */}
                    {fitResult && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                            <h4 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>
                                Fit Parameters -- <em style={{ fontWeight: 400 }}>{fitResult.model_name || selectedModel}</em>
                                {(() => {
                                    const modelKey = selectedModel.toLowerCase();
                                    const formula = MODEL_FORMULAS[modelKey] || (selectedModel === 'custom' ? customExpr : null);
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
                                {tableCopied ? '\u2705 Copied!' : '\uD83D\uDCCB Copy Table'}
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
                                        {(fitResult.parameter_names as string[] || []).map((name: string, j: number) => {
                                            const val = Number(fitResult.parameters?.[j]);
                                            const unc = Number(fitResult.uncertainties?.[j]);
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
                                {fitResult.reduced_chi_squared != null && (
                                    <span>{'\u03C7\u00B2'} reduced = <strong>{Number(fitResult.reduced_chi_squared).toFixed(3)}</strong></span>
                                )}
                                {fitResult.p_value != null && (
                                    <span>P = <strong>{formatPValue(Number(fitResult.p_value))}</strong></span>
                                )}
                                {fitResult.dof != null && (
                                    <span>dof = <strong>{fitResult.dof}</strong></span>
                                )}
                                {fitResult.r_squared != null && (
                                    <span>R{'\u00B2'} = <strong>{Number(fitResult.r_squared).toFixed(5)}</strong></span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* -- Formula result -- */}
                    {formulaResult && (
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
                                    Expression: <strong style={{ color: 'var(--text)' }}>{formulaExpr}</strong>
                                </div>
                                {(() => {
                                    const val = Number(formulaResult.value);
                                    const unc = Number(formulaResult.uncertainty);
                                    const fmt = (isFinite(val) && isFinite(unc) && unc > 0)
                                        ? roundWithUncertainty(val, unc)
                                        : { rounded: String(formulaResult.formatted ?? '--'), unrounded: `${smartFormat(val)} \u00B1 ${smartFormat(unc)}` };
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
                    {nsigmaResult && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 0.6rem', color: 'var(--text)', fontSize: '1rem' }}>
                                🎯 N-Sigma Comparison
                            </h4>
                            {(() => {
                                const ns = Number(nsigmaResult.n_sigma);
                                const col = nsigmaColor(ns);
                                const tv = theoVal;
                                const tu = theoUnc;
                                const measVal = Number(formulaResult?.value);
                                const measUnc = Number(formulaResult?.uncertainty);
                                const measFmt = (isFinite(measVal) && isFinite(measUnc) && measUnc > 0)
                                    ? roundWithUncertainty(measVal, measUnc).rounded
                                    : String(formulaResult?.formatted ?? '--');
                                return (
                                    <div style={{
                                        padding: '0.85rem 1rem', borderRadius: '8px',
                                        border: `2px solid ${col}`,
                                        background: ns <= 2 ? 'var(--success-bg)' : ns <= 3 ? 'var(--warning-bg)' : 'var(--danger-bg)',
                                    }}>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: col }}>
                                            N-{'\u03C3'} = {ns.toFixed(2)}
                                            <span style={{ fontSize: '0.95rem', fontWeight: 500, marginLeft: '0.75rem', color: 'var(--text)' }}>
                                                -- {nsigmaResult.verdict}
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
                    {fitResult && fitResult.x_fit && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ color: 'var(--text)', margin: '0 0 0.5rem', fontSize: '1rem' }}>📈 Fit Plot</h4>
                            <div ref={fitPlotRef}>
                            <Plot
                                data={[
                                    {
                                        x: analysisXData,
                                        y: analysisYData,
                                        error_y: analysisYErrors ? {
                                            type: 'data' as const, array: analysisYErrors,
                                            visible: true, color: '#999', thickness: 1.5,
                                        } : undefined,
                                        error_x: analysisXErrors ? {
                                            type: 'data' as const, array: analysisXErrors,
                                            visible: true, color: '#999', thickness: 1.5,
                                        } : undefined,
                                        type: 'scatter' as const, mode: 'markers' as const,
                                        name: 'Data', marker: { size: 7, color: '#1565c0' },
                                    },
                                    {
                                        x: fitResult.x_fit, y: fitResult.y_fit,
                                        type: 'scatter' as const, mode: 'lines' as const,
                                        name: `Fit (${fitResult.model_name})`,
                                        line: { width: 2.5, color: '#d32f2f' },
                                    },
                                ]}
                                layout={{
                                    title: { text: `Fit -- ${fitResult.model_name}`, font: { color: '#333' } },
                                    xaxis: { title: { text: xLabel || 'X', font: { color: '#333' } }, gridcolor: '#ddd', tickfont: { color: '#333' } },
                                    yaxis: { title: { text: yLabel || 'Y', font: { color: '#333' } }, gridcolor: '#ddd', tickfont: { color: '#333' } },
                                    height: 420, margin: { l: 60, r: 30, t: 55, b: 55 },
                                    legend: { x: 0, y: 1.15, orientation: 'h' as const, font: { color: '#333' } },
                                    plot_bgcolor: '#ffffff', paper_bgcolor: '#ffffff',
                                }}
                                useResizeHandler style={{ width: '100%' }} config={plotConfig}
                            />
                            </div>

                            {/* Residuals plot */}
                            {fitResult.residuals && (
                                <div ref={residualsPlotRef}>
                                <Plot
                                    data={[{
                                        x: analysisXData, y: fitResult.residuals,
                                        error_y: analysisYErrors ? {
                                            type: 'data' as const, array: analysisYErrors,
                                            visible: true, color: '#999', thickness: 1.5,
                                        } : undefined,
                                        error_x: analysisXErrors ? {
                                            type: 'data' as const, array: analysisXErrors,
                                            visible: true, color: '#999', thickness: 1.5,
                                        } : undefined,
                                        type: 'scatter' as const, mode: 'markers' as const,
                                        name: 'Residuals', marker: { size: 6, color: '#1565c0' },
                                    }, {
                                        x: [Math.min(...analysisXData), Math.max(...analysisXData)],
                                        y: [0, 0],
                                        type: 'scatter' as const, mode: 'lines' as const,
                                        line: { width: 1.5, color: '#999', dash: 'dash' },
                                        showlegend: false,
                                    }]}
                                    layout={{
                                        title: { text: 'Residuals (data \u2212 fit)', font: { color: '#333' } },
                                        xaxis: { title: { text: xLabel || 'X', font: { color: '#333' } }, gridcolor: '#ddd', tickfont: { color: '#333' } },
                                        yaxis: { title: { text: `${yLabel || 'Y'} \u2212 f(${xLabel || 'X'})`, font: { color: '#333' } }, gridcolor: '#ddd', tickfont: { color: '#333' } },
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
                    {fitResult && (
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
                                {reportCopied ? '\u2705 Table Copied to Clipboard!' : '\uD83D\uDCCB Copy Results as Table'}
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
                                    {resultsExporting ? '\u23F3 Exporting...' : exportFormat === 'docx' ? '\uD83D\uDCC4 Export as DOCX' : '\uD83D\uDCC4 Export as PDF'}
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

                    {/* Report Expander + Full Report Section */}
                    <ReportExpander expanded={reportExpanded} onToggle={() => setReportExpanded(prev => !prev)}>
                        <ReportSection
                            analysisData={fitResult ? {
                                fit: {
                                    ...fitResult,
                                    x_data: analysisXData,
                                    y_data: analysisYData,
                                    x_errors: analysisXErrors,
                                    y_errors: analysisYErrors,
                                },
                                formula: formulaResult ? { expression: formulaExpr, ...formulaResult } : undefined,
                                nsigma: nsigmaResult ? { ...nsigmaResult, theoretical_value: parseFloat(theoVal), theoretical_uncertainty: parseFloat(theoUnc) || 0 } : undefined,
                            } : null}
                            plotImages={plotImages}
                            initialTitle={file?.name?.replace(/\.(xlsx?|csv|tsv|ods)$/i, '').replace(/[_-]/g, ' ') || ''}
                            instructions=""
                            demoContext={demoReportContext}
                        />
                    </ReportExpander>
                </div>
            )}
        </div>
    );
}

export default AutoLab;
