import { useState, useEffect, useRef } from 'react';
import Plot from './PlotWrapper';
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

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setError('');
        setStats(null);
        setData([]);
        setSelectedColumn('');

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
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
                if (jsonData.length === 0) {
                    setError('Spreadsheet appears empty.');
                    return;
                }
                const columns = Object.keys(jsonData[0]);
                setFileData({ columns, rows: jsonData.map(row => {
                    const out: Record<string, string> = {};
                    columns.forEach(c => out[c] = String(row[c] ?? ''));
                    return out;
                })});
                const firstNumCol = columns.find(col =>
                    jsonData.some(row => !isNaN(Number(row[col])) && String(row[col]).trim() !== '')
                );
                if (firstNumCol) setSelectedColumn(firstNumCol);
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
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
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
            <div style={{ display: 'flex', gap: '0', marginTop: '1rem', borderRadius: '8px', overflow: 'hidden', border: '2px solid #1565c0' }}>
                <button
                    onClick={() => { setInputMode('manual'); setError(''); }}
                    style={{
                        flex: 1, padding: '0.6rem',
                        backgroundColor: inputMode === 'manual' ? '#1565c0' : '#fff',
                        color: inputMode === 'manual' ? '#fff' : '#1565c0',
                        border: 'none', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    {'\u270D\uFE0F'} Manual Input
                </button>
                <button
                    onClick={() => { setInputMode('file'); setError(''); }}
                    style={{
                        flex: 1, padding: '0.6rem',
                        backgroundColor: inputMode === 'file' ? '#1565c0' : '#fff',
                        color: inputMode === 'file' ? '#fff' : '#1565c0',
                        border: 'none', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
                        borderLeft: '2px solid #1565c0',
                        transition: 'all 0.2s',
                    }}
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
                            border: '1px solid #ccc',
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
                            backgroundColor: '#f5f9ff',
                            transition: 'border-color 0.2s, background-color 0.2s',
                        }}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#1565c0'; e.currentTarget.style.backgroundColor = '#e3f2fd'; }}
                        onDragLeave={(e) => { e.currentTarget.style.borderColor = '#90caf9'; e.currentTarget.style.backgroundColor = '#f5f9ff'; }}
                        onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.borderColor = '#90caf9';
                            e.currentTarget.style.backgroundColor = '#f5f9ff';
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
                                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                                    {fileData ? `${fileData.columns.length} columns, ${fileData.rows.length} rows` : 'Loading...'}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>Click to upload a different file</div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{'\uD83D\uDCC2'}</div>
                                <div style={{ fontWeight: 'bold', color: '#333' }}>Click or drag a file here</div>
                                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>Supports .csv, .tsv, .xlsx, .xls</div>
                            </div>
                        )}
                    </div>

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
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderRadius: '20px',
                                                border: isSelected ? '2px solid #1565c0' : '2px solid #ddd',
                                                backgroundColor: isSelected ? '#e3f2fd' : (hasNumbers ? '#fff' : '#f5f5f5'),
                                                color: isSelected ? '#1565c0' : (hasNumbers ? '#333' : '#999'),
                                                cursor: hasNumbers ? 'pointer' : 'default',
                                                fontWeight: isSelected ? 700 : 400,
                                                fontSize: '0.9rem',
                                                transition: 'all 0.2s',
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
                                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                                    {'\u2139\uFE0F'} {selectedColumn}: {getColumnPreview(selectedColumn)}
                                </div>
                            )}

                            {/* Data preview */}
                            {selectedColumn && (
                                <div style={{ marginTop: '0.75rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ position: 'sticky', top: 0, padding: '0.4rem 0.75rem', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', textAlign: 'left', width: '50px' }}>#</th>
                                                <th style={{ position: 'sticky', top: 0, padding: '0.4rem 0.75rem', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{selectedColumn}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fileData.rows.slice(0, 20).map((row, i) => (
                                                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                                    <td style={{ padding: '0.3rem 0.75rem', color: '#999' }}>{i + 1}</td>
                                                    <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right' }}>{row[selectedColumn]}</td>
                                                </tr>
                                            ))}
                                            {fileData.rows.length > 20 && (
                                                <tr><td colSpan={2} style={{ padding: '0.3rem 0.75rem', color: '#999', textAlign: 'center' }}>... {fileData.rows.length - 20} more rows</td></tr>
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
                    onClick={handleCalculate}
                    disabled={inputMode === 'file' && !selectedColumn}
                    style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: (inputMode === 'file' && !selectedColumn) ? '#ccc' : '#c62828',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: (inputMode === 'file' && !selectedColumn) ? 'not-allowed' : 'pointer',
                    }}
                >
                    {'\uD83D\uDD2C'} Analyze
                </button>
                <button
                    onClick={handleTryExample}
                    style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#1565c0',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        cursor: 'pointer',
                    }}
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
                        <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
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
                                onClick={handleCopy}
                                style={{
                                    padding: '0.4rem 1.2rem',
                                    backgroundColor: copied ? '#2e7d32' : '#c62828',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s',
                                }}
                            >
                                {copied ? '\u2714 Copied!' : '\uD83D\uDCCB Copy Result'}
                            </button>
                            <button
                                onClick={handleCopyTable}
                                style={{
                                    padding: '0.4rem 1.2rem',
                                    backgroundColor: '#7b1fa2',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                }}
                            >
                                {'\uD83D\uDCCA'} Copy All Stats
                            </button>
                        </div>
                    </div>

                    {/* Quick interpretation */}
                    <div style={{
                        marginTop: '1rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#fff8e1',
                        borderRadius: '8px',
                        border: '1px solid #ffe082',
                        fontSize: '0.9rem',
                        color: '#5d4037',
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
                                            backgroundColor: '#e3f2fd',
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
                                            backgroundColor: '#e3f2fd',
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
                                    gridcolor: '#eee',
                                },
                                yaxis: {
                                    title: 'Count' as any,
                                    gridcolor: '#eee',
                                },
                                shapes: [
                                    {
                                        type: 'line',
                                        x0: stats.mean,
                                        x1: stats.mean,
                                        y0: 0,
                                        y1: 1,
                                        yref: 'paper',
                                        line: { color: '#c62828', width: 2.5, dash: 'dash' },
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
                                        font: { color: '#c62828', size: 12, family: 'monospace' },
                                    },
                                    {
                                        x: stats.mean + stats.std,
                                        y: 0.95,
                                        yref: 'paper',
                                        text: `+\u03C3`,
                                        showarrow: false,
                                        font: { color: '#c62828', size: 11 },
                                    },
                                    {
                                        x: stats.mean - stats.std,
                                        y: 0.95,
                                        yref: 'paper',
                                        text: `-\u03C3`,
                                        showarrow: false,
                                        font: { color: '#c62828', size: 11 },
                                    },
                                ],
                                plot_bgcolor: '#fafafa',
                                paper_bgcolor: '#fff',
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
                                    gridcolor: '#eee',
                                },
                                plot_bgcolor: '#fafafa',
                                paper_bgcolor: '#fff',
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
