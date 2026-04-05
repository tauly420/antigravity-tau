import { useState, useEffect, useRef } from 'react';
import Plot from './PlotWrapper';
import DataPreview from './DataPreview';
import { useAnalysis } from '../context/AnalysisContext';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const EXAMPLE_DATA = `9.81
9.78
9.83
9.79
9.82
9.80
9.84
9.77
9.81
9.79
9.83
9.80
9.82
9.78
9.81`;

interface Stats {
    n: number;
    mean: number;
    std: number;
    sem: number;
    median: number;
    min: number;
    max: number;
    range: number;
    q1: number;
    q3: number;
    iqr: number;
    skewness: number;
    kurtosis: number;
    formatted: string;
}

function parseData(text: string): number[] {
    return text
        .split(/[\n,;\s]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(Number)
        .filter(v => !isNaN(v));
}

function computeStats(data: number[]): Stats {
    const n = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const variance = data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1);
    const std = Math.sqrt(variance);
    const sem = std / Math.sqrt(n);

    const sorted = [...data].sort((a, b) => a - b);
    const median = n % 2 === 1
        ? sorted[Math.floor(n / 2)]
        : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const range = max - min;

    // Quartiles
    const q1Idx = (n - 1) * 0.25;
    const q3Idx = (n - 1) * 0.75;
    const q1 = sorted[Math.floor(q1Idx)] + (q1Idx % 1) * (sorted[Math.ceil(q1Idx)] - sorted[Math.floor(q1Idx)]);
    const q3 = sorted[Math.floor(q3Idx)] + (q3Idx % 1) * (sorted[Math.ceil(q3Idx)] - sorted[Math.floor(q3Idx)]);
    const iqr = q3 - q1;

    // Skewness (Fisher)
    const m3 = data.reduce((sum, x) => sum + ((x - mean) / std) ** 3, 0) / n;
    const skewness = n > 2 ? m3 * (n / ((n - 1) * (n - 2))) * n : 0;

    // Excess kurtosis
    const m4 = data.reduce((sum, x) => sum + ((x - mean) / std) ** 4, 0) / n;
    const kurtosis = m4 - 3;

    const formatted = formatResult(mean, sem);

    return { n, mean, std, sem, median, min, max, range, q1, q3, iqr, skewness, kurtosis, formatted };
}

function formatResult(mean: number, uncertainty: number): string {
    if (uncertainty === 0) return `${mean} \u00B1 0`;

    const orderOfMagnitude = Math.floor(Math.log10(Math.abs(uncertainty)));
    const factor = Math.pow(10, orderOfMagnitude);
    const roundedUncertainty = Math.round(uncertainty / factor) * factor;
    const decimalPlaces = Math.max(0, -orderOfMagnitude);
    const roundedMean = parseFloat(mean.toFixed(decimalPlaces));
    const roundedUnc = parseFloat(roundedUncertainty.toFixed(decimalPlaces));

    return `${roundedMean.toFixed(decimalPlaces)} \u00B1 ${roundedUnc.toFixed(decimalPlaces)}`;
}

type InputMode = 'manual' | 'file';

interface FileData {
    columns: string[];
    rows: Record<string, string>[];
}

function StatisticsCalculator() {
    const [inputMode, setInputMode] = useState<InputMode>('manual');
    const [input, setInput] = useState('');
    const [stats, setStats] = useState<Stats | null>(null);
    const [data, setData] = useState<number[]>([]);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    // File upload state
    const [fileData, setFileData] = useState<FileData | null>(null);
    const [selectedColumn, setSelectedColumn] = useState('');
    const [fileName, setFileName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheetIdx, setSelectedSheetIdx] = useState(0);
    const workbookRef = useRef<XLSX.WorkBook | null>(null);

    const { setCurrentTool } = useAnalysis();

    useEffect(() => {
        setCurrentTool('Statistics');
    }, []);

    const handleCalculate = () => {
        setError('');
        setStats(null);
        setCopied(false);

        let parsed: number[];

        if (inputMode === 'file' && fileData && selectedColumn) {
            parsed = fileData.rows
                .map(row => Number(row[selectedColumn]))
                .filter(v => !isNaN(v));
        } else {
            parsed = parseData(input);
        }

        if (parsed.length < 2) {
            setError('Need at least 2 numeric values. Check your data or column selection.');
            setData([]);
            return;
        }

        setData(parsed);
        setStats(computeStats(parsed));
    };

    const handleTryExample = () => {
        setInputMode('manual');
        setInput(EXAMPLE_DATA);
        setCopied(false);
        const parsed = parseData(EXAMPLE_DATA);
        setData(parsed);
        setStats(computeStats(parsed));
        setError('');
    };

    const loadSheetFromWorkbook = (workbook: XLSX.WorkBook, sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
        if (jsonData.length === 0) {
            setError('Sheet appears empty.');
            return;
        }
        const columns = Object.keys(jsonData[0]);
        setFileData({ columns, rows: jsonData.map(row => {
            const out: Record<string, string> = {};
            columns.forEach(c => out[c] = String(row[c] ?? ''));
            return out;
        })});
        setSelectedColumn('');
        const firstNumCol = columns.find(col =>
            jsonData.some(row => !isNaN(Number(row[col])) && String(row[col]).trim() !== '')
        );
        if (firstNumCol) setSelectedColumn(firstNumCol);
    };

    const loadSelectedSheet = () => {
        if (!workbookRef.current || sheetNames.length === 0) return;
        loadSheetFromWorkbook(workbookRef.current, sheetNames[selectedSheetIdx]);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setError('');
        setStats(null);
        setData([]);
        setSelectedColumn('');
        setSheetNames([]);
        setSelectedSheetIdx(0);
        workbookRef.current = null;

        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (result) => {
                    if (result.errors.length > 0 && result.data.length === 0) {
                        setError('Could not parse file. Check format.');
                        return;
                    }
                    const columns = result.meta.fields || [];
                    setFileData({ columns, rows: result.data as Record<string, string>[] });
                    // Auto-select first numeric column
                    const firstNumCol = columns.find(col =>
                        (result.data as Record<string, string>[]).some(row => !isNaN(Number(row[col])) && row[col]?.trim() !== '')
                    );
                    if (firstNumCol) setSelectedColumn(firstNumCol);
                },
            });
        } else if (ext === 'xlsx' || ext === 'xls') {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const arrayBuf = evt.target?.result;
                const workbook = XLSX.read(arrayBuf, { type: 'array' });
                workbookRef.current = workbook;

                if (workbook.SheetNames.length > 1) {
                    setSheetNames(workbook.SheetNames);
                    setSelectedSheetIdx(0);
                    // Don't auto-load -- user picks sheet first
                    return;
                }
                // Single sheet -- load directly
                loadSheetFromWorkbook(workbook, workbook.SheetNames[0]);
            };
            reader.readAsArrayBuffer(file);
        } else {
            setError('Unsupported file type. Use .csv, .tsv, .xlsx, or .xls');
        }
    };

    const handleCopy = async () => {
        if (!stats) return;
        try {
            await navigator.clipboard.writeText(stats.formatted);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = stats.formatted;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleCopyTable = async () => {
        if (!stats) return;
        const rows = [
            ['Statistic', 'Value'],
            ['N', String(stats.n)],
            ['Mean', stats.mean.toPrecision(6)],
            ['Std Dev', stats.std.toPrecision(4)],
            ['Std Error', stats.sem.toPrecision(4)],
            ['Median', stats.median.toPrecision(6)],
            ['Q1', stats.q1.toPrecision(5)],
            ['Q3', stats.q3.toPrecision(5)],
            ['IQR', stats.iqr.toPrecision(4)],
            ['Min', String(stats.min)],
            ['Max', String(stats.max)],
            ['Range', stats.range.toPrecision(4)],
            ['Skewness', stats.skewness.toFixed(3)],
            ['Kurtosis (excess)', stats.kurtosis.toFixed(3)],
            ['Result', stats.formatted],
        ];
        const tsv = rows.map(r => r.join('\t')).join('\n');
        try {
            await navigator.clipboard.writeText(tsv);
        } catch { /* fallback not needed for table */ }
    };

    // Get column preview stats
    const getColumnPreview = (colName: string): string => {
        if (!fileData) return '';
        const nums = fileData.rows.map(r => Number(r[colName])).filter(v => !isNaN(v));
        if (nums.length === 0) return '(no numeric values)';
        return `${nums.length} values, range: ${Math.min(...nums).toPrecision(4)} – ${Math.max(...nums).toPrecision(4)}`;
    };

    const tableRows: { label: string; value: string }[] = stats
        ? [
              { label: 'N (count)', value: String(stats.n) },
              { label: 'Mean (x\u0304)', value: stats.mean.toPrecision(6) },
              { label: 'Std Dev (\u03C3)', value: stats.std.toPrecision(4) },
              { label: 'Std Error (\u03C3/\u221AN)', value: stats.sem.toPrecision(4) },
              { label: 'Median', value: stats.median.toPrecision(6) },
              { label: 'Q1 (25th percentile)', value: stats.q1.toPrecision(5) },
              { label: 'Q3 (75th percentile)', value: stats.q3.toPrecision(5) },
              { label: 'IQR', value: stats.iqr.toPrecision(4) },
              { label: 'Min', value: String(stats.min) },
              { label: 'Max', value: String(stats.max) },
              { label: 'Range', value: stats.range.toPrecision(4) },
              { label: 'Skewness', value: stats.skewness.toFixed(3) },
              { label: 'Kurtosis (excess)', value: stats.kurtosis.toFixed(3) },
          ]
        : [];

    return (
        <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>
                {'\uD83D\uDCCA'} Statistics Buddy
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Your friendly statistics companion — paste data, upload a file, or try the example. Get instant stats, histograms, and more.
            </p>

            {/* Instructions */}
            <div className="instructions">
                <p><strong>How to use:</strong></p>
                <p>{'\u2022'} <strong>Manual:</strong> Paste measurements (one per line, or comma/space separated)</p>
                <p>{'\u2022'} <strong>File Upload:</strong> Drop a CSV or Excel file, pick a column, and analyze</p>
                <p>{'\u2022'} Results are rounded using scientific conventions (uncertainty to 1 sig fig)</p>
            </div>

            {/* Input mode toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                    onClick={() => { setInputMode('manual'); setError(''); }}
                    className={inputMode === 'manual' ? 'btn-primary' : 'btn-secondary'}
                    style={{ flex: 1 }}
                >
                    {'\u270D\uFE0F'} Manual Input
                </button>
                <button
                    onClick={() => { setInputMode('file'); setError(''); }}
                    className={inputMode === 'file' ? 'btn-primary' : 'btn-secondary'}
                    style={{ flex: 1 }}
                >
                    {'\uD83D\uDCC1'} Upload File
                </button>
            </div>

            {/* Manual input */}
            {inputMode === 'manual' && (
                <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
                        Measurements
                    </label>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Enter measurements, e.g.:\n9.81\n9.78\n9.83\n9.79\n\nor: 9.81, 9.78, 9.83, 9.79"
                        rows={8}
                        style={{
                            width: '100%',
                            fontFamily: 'monospace',
                            fontSize: '0.95rem',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>
            )}

            {/* File upload */}
            {inputMode === 'file' && (
                <div style={{ marginTop: '1rem' }}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.tsv,.txt,.xlsx,.xls"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                    />
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: '2px dashed #90caf9',
                            borderRadius: '12px',
                            padding: '2rem',
                            textAlign: 'center',
                            cursor: 'pointer',
                            backgroundColor: 'var(--surface-alt)',
                            transition: 'border-color 0.2s, background-color 0.2s',
                        }}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#1565c0'; e.currentTarget.style.backgroundColor = 'var(--surface-alt)'; }}
                        onDragLeave={(e) => { e.currentTarget.style.borderColor = '#90caf9'; e.currentTarget.style.backgroundColor = 'var(--surface-alt)'; }}
                        onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.borderColor = '#90caf9';
                            e.currentTarget.style.backgroundColor = 'var(--surface-alt)';
                            const file = e.dataTransfer.files[0];
                            if (file && fileInputRef.current) {
                                const dt = new DataTransfer();
                                dt.items.add(file);
                                fileInputRef.current.files = dt.files;
                                fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }}
                    >
                        {fileName ? (
                            <div>
                                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{'\uD83D\uDCC4'}</div>
                                <div style={{ fontWeight: 'bold', color: '#1565c0' }}>{fileName}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    {fileData ? `${fileData.columns.length} columns, ${fileData.rows.length} rows` : 'Loading...'}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Click to upload a different file</div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{'\uD83D\uDCC2'}</div>
                                <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>Click or drag a file here</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Supports .csv, .tsv, .xlsx, .xls</div>
                            </div>
                        )}
                    </div>

                    {/* Sheet selector for multi-sheet Excel */}
                    {sheetNames.length > 1 && (
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
                                Select sheet
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <select
                                    value={selectedSheetIdx}
                                    onChange={e => setSelectedSheetIdx(Number(e.target.value))}
                                    style={{ flex: 1 }}
                                >
                                    {sheetNames.map((s, i) => <option key={s} value={i}>{s}</option>)}
                                </select>
                                <button onClick={loadSelectedSheet} className="btn-primary">Load</button>
                            </div>
                        </div>
                    )}

                    {/* Data preview table */}
                    {fileData && (
                        <div style={{ marginTop: '1rem' }}>
                            <DataPreview columns={fileData.columns} rows={fileData.rows} defaultOpen={false} />
                        </div>
                    )}

                    {/* Column picker */}
                    {fileData && fileData.columns.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                            <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
                                {'\uD83C\uDFAF'} Select column to analyze:
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                                {fileData.columns.map(col => {
                                    const isSelected = col === selectedColumn;
                                    const preview = getColumnPreview(col);
                                    const hasNumbers = !preview.includes('no numeric');
                                    return (
                                        <button
                                            key={col}
                                            onClick={() => { setSelectedColumn(col); setStats(null); setData([]); }}
                                            className={isSelected ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                                            style={{
                                                borderRadius: '20px',
                                                opacity: hasNumbers ? 1 : 0.6,
                                            }}
                                            disabled={!hasNumbers}
                                            title={preview}
                                        >
                                            {col}
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedColumn && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                    {'\u2139\uFE0F'} {selectedColumn}: {getColumnPreview(selectedColumn)}
                                </div>
                            )}

                            {/* Data preview */}
                            {selectedColumn && (
                                <div style={{ marginTop: '0.75rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ position: 'sticky', top: 0, padding: '0.4rem 0.75rem', backgroundColor: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', textAlign: 'left', width: '50px' }}>#</th>
                                                <th style={{ position: 'sticky', top: 0, padding: '0.4rem 0.75rem', backgroundColor: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{selectedColumn}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fileData.rows.slice(0, 20).map((row, i) => (
                                                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                                    <td style={{ padding: '0.3rem 0.75rem', color: 'var(--text-muted)' }}>{i + 1}</td>
                                                    <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right' }}>{row[selectedColumn]}</td>
                                                </tr>
                                            ))}
                                            {fileData.rows.length > 20 && (
                                                <tr><td colSpan={2} style={{ padding: '0.3rem 0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>... {fileData.rows.length - 20} more rows</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                    className="btn-primary"
                    onClick={handleCalculate}
                    disabled={inputMode === 'file' && !selectedColumn}
                    style={{ flex: 1 }}
                >
                    {'\uD83D\uDD2C'} Analyze
                </button>
                <button
                    className="btn-accent"
                    onClick={handleTryExample}
                >
                    {'\uD83D\uDCA1'} Try Example
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="error-message" style={{ marginTop: '1rem' }}>
                    {error}
                </div>
            )}

            {/* Results */}
            {stats && (
                <>
                    {/* Formatted result banner */}
                    <div
                        style={{
                            marginTop: '1.5rem',
                            padding: '1.25rem',
                            background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
                            borderRadius: '8px',
                            textAlign: 'center',
                            border: '1px solid #bbdefb',
                        }}
                    >
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                            Result (x&#772; &plusmn; &sigma;<sub>mean</sub>)
                        </div>
                        <div
                            style={{
                                fontSize: '1.8rem',
                                fontWeight: 'bold',
                                fontFamily: 'monospace',
                                color: '#1565c0',
                            }}
                        >
                            {stats.formatted}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
                            <button
                                className={copied ? 'btn-accent btn-sm' : 'btn-primary btn-sm'}
                                onClick={handleCopy}
                            >
                                {copied ? '\u2714 Copied!' : '\uD83D\uDCCB Copy Result'}
                            </button>
                            <button
                                className="btn-accent btn-sm"
                                onClick={handleCopyTable}
                            >
                                {'\uD83D\uDCCA'} Copy All Stats
                            </button>
                        </div>
                    </div>

                    {/* Quick interpretation */}
                    <div style={{
                        marginTop: '1rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--warning-bg)',
                        borderRadius: '8px',
                        border: '1px solid #ffe082',
                        fontSize: '0.9rem',
                        color: 'var(--text-secondary)',
                    }}>
                        <strong>{'\uD83D\uDCA1'} Quick take:</strong>{' '}
                        {stats.n} measurements, relative uncertainty {((stats.sem / Math.abs(stats.mean)) * 100).toFixed(1)}%.
                        {Math.abs(stats.skewness) > 1 && ` Distribution is ${stats.skewness > 0 ? 'right' : 'left'}-skewed.`}
                        {Math.abs(stats.skewness) <= 1 && ' Distribution looks fairly symmetric.'}
                        {stats.n >= 10 && stats.sem / stats.std < 0.35 && ' Good sample size for reliable statistics.'}
                        {stats.n < 10 && ' Consider more measurements for better reliability.'}
                    </div>

                    {/* Statistics table */}
                    <div style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontFamily: 'monospace',
                                fontSize: '0.95rem',
                            }}
                        >
                            <thead>
                                <tr>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: '0.6rem 1rem',
                                            backgroundColor: 'var(--surface-alt)',
                                            borderBottom: '2px solid #90caf9',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        Statistic
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'right',
                                            padding: '0.6rem 1rem',
                                            backgroundColor: 'var(--surface-alt)',
                                            borderBottom: '2px solid #90caf9',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        Value
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableRows.map((row, i) => (
                                    <tr
                                        key={row.label}
                                        style={{
                                            backgroundColor: i % 2 === 0 ? '#fafafa' : '#fff',
                                        }}
                                    >
                                        <td
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderBottom: '1px solid #eee',
                                                fontFamily: 'sans-serif',
                                            }}
                                        >
                                            {row.label}
                                        </td>
                                        <td
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderBottom: '1px solid #eee',
                                                textAlign: 'right',
                                            }}
                                        >
                                            {row.value}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Histogram */}
                    <div style={{ marginTop: '1.5rem' }}>
                        <h3 style={{ marginBottom: '0.5rem' }}>
                            {'\uD83D\uDCC9'} Distribution Histogram
                        </h3>
                        <Plot
                            data={[
                                {
                                    x: data,
                                    type: 'histogram' as const,
                                    marker: {
                                        color: 'rgba(21, 101, 192, 0.6)',
                                        line: { color: 'rgba(21, 101, 192, 1)', width: 1 },
                                    },
                                    name: 'Measurements',
                                    hovertemplate: 'Bin: %{x}<br>Count: %{y}<extra></extra>',
                                },
                            ]}
                            layout={{
                                xaxis: {
                                    title: 'Value' as any,
                                    gridcolor: '#2a2a4a',
                                },
                                yaxis: {
                                    title: 'Count' as any,
                                    gridcolor: '#2a2a4a',
                                },
                                shapes: [
                                    {
                                        type: 'line',
                                        x0: stats.mean,
                                        x1: stats.mean,
                                        y0: 0,
                                        y1: 1,
                                        yref: 'paper',
                                        line: { color: 'var(--danger)', width: 2.5, dash: 'dash' },
                                    },
                                    {
                                        type: 'rect',
                                        x0: stats.mean - stats.std,
                                        x1: stats.mean + stats.std,
                                        y0: 0,
                                        y1: 1,
                                        yref: 'paper',
                                        fillcolor: 'rgba(198, 40, 40, 0.1)',
                                        line: { width: 0 },
                                    },
                                ],
                                annotations: [
                                    {
                                        x: stats.mean,
                                        y: 1.05,
                                        yref: 'paper',
                                        text: `x\u0304 = ${stats.mean.toPrecision(5)}`,
                                        showarrow: false,
                                        font: { color: 'var(--danger)', size: 12, family: 'monospace' },
                                    },
                                    {
                                        x: stats.mean + stats.std,
                                        y: 0.95,
                                        yref: 'paper',
                                        text: `+\u03C3`,
                                        showarrow: false,
                                        font: { color: 'var(--danger)', size: 11 },
                                    },
                                    {
                                        x: stats.mean - stats.std,
                                        y: 0.95,
                                        yref: 'paper',
                                        text: `-\u03C3`,
                                        showarrow: false,
                                        font: { color: 'var(--danger)', size: 11 },
                                    },
                                ],
                                plot_bgcolor: '#16213e',
                                paper_bgcolor: '#1a1a2e',
                                margin: { t: 40, r: 30, b: 50, l: 60 },
                                bargap: 0.05,
                                showlegend: false,
                            }}
                            config={{ responsive: true, displayModeBar: false }}
                            style={{ width: '100%', height: '350px' }}
                        />
                    </div>

                    {/* Box plot */}
                    <div style={{ marginTop: '1.5rem' }}>
                        <h3 style={{ marginBottom: '0.5rem' }}>
                            {'\uD83D\uDCE6'} Box Plot
                        </h3>
                        <Plot
                            data={[
                                {
                                    y: data,
                                    type: 'box' as const,
                                    marker: { color: '#7b1fa2' },
                                    boxpoints: 'all' as const,
                                    jitter: 0.3,
                                    pointpos: -1.8,
                                    name: inputMode === 'file' && selectedColumn ? selectedColumn : 'Data',
                                    hovertemplate: '%{y}<extra></extra>',
                                },
                            ]}
                            layout={{
                                yaxis: {
                                    title: (inputMode === 'file' && selectedColumn ? selectedColumn : 'Value') as any,
                                    gridcolor: '#2a2a4a',
                                },
                                plot_bgcolor: '#16213e',
                                paper_bgcolor: '#1a1a2e',
                                margin: { t: 20, r: 30, b: 30, l: 60 },
                                showlegend: false,
                            }}
                            config={{ responsive: true, displayModeBar: false }}
                            style={{ width: '100%', height: '300px' }}
                        />
                    </div>
                </>
            )}
        </div>
    );
}

export default StatisticsCalculator;
