import { useState, useEffect } from 'react';
import Plot from './PlotWrapper';
import { useAnalysis } from '../context/AnalysisContext';

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

    const formatted = formatResult(mean, sem);

    return { n, mean, std, sem, median, min, max, range, formatted };
}

/**
 * Scientific rounding: round uncertainty to 1 significant figure,
 * then round the mean to the same decimal place.
 */
function formatResult(mean: number, uncertainty: number): string {
    if (uncertainty === 0) return `${mean} \u00B1 0`;

    // Find the order of magnitude of the uncertainty
    const orderOfMagnitude = Math.floor(Math.log10(Math.abs(uncertainty)));
    // Round uncertainty to 1 significant figure
    const factor = Math.pow(10, orderOfMagnitude);
    const roundedUncertainty = Math.round(uncertainty / factor) * factor;

    // Determine decimal places from the rounded uncertainty
    const decimalPlaces = Math.max(0, -orderOfMagnitude);
    const roundedMean = parseFloat(mean.toFixed(decimalPlaces));
    const roundedUnc = parseFloat(roundedUncertainty.toFixed(decimalPlaces));

    return `${roundedMean.toFixed(decimalPlaces)} \u00B1 ${roundedUnc.toFixed(decimalPlaces)}`;
}

function StatisticsCalculator() {
    const [input, setInput] = useState('');
    const [stats, setStats] = useState<Stats | null>(null);
    const [data, setData] = useState<number[]>([]);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const { setCurrentTool } = useAnalysis();

    useEffect(() => {
        setCurrentTool('Statistics');
    }, []);

    const handleCalculate = () => {
        setError('');
        setStats(null);
        setCopied(false);

        const parsed = parseData(input);
        if (parsed.length < 2) {
            setError('Please enter at least 2 numeric measurements.');
            setData([]);
            return;
        }

        setData(parsed);
        setStats(computeStats(parsed));
    };

    const handleTryExample = () => {
        setInput(EXAMPLE_DATA);
        setCopied(false);
        // Auto-calculate with example data
        const parsed = parseData(EXAMPLE_DATA);
        setData(parsed);
        setStats(computeStats(parsed));
        setError('');
    };

    const handleCopy = async () => {
        if (!stats) return;
        try {
            await navigator.clipboard.writeText(stats.formatted);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
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

    const tableRows: { label: string; value: string }[] = stats
        ? [
              { label: 'N (count)', value: String(stats.n) },
              { label: 'Mean (\u0078\u0304)', value: stats.mean.toPrecision(6) },
              { label: 'Std Dev (\u03C3)', value: stats.std.toPrecision(4) },
              { label: 'Std Error (\u03C3/\u221AN)', value: stats.sem.toPrecision(4) },
              { label: 'Median', value: stats.median.toPrecision(6) },
              { label: 'Min', value: String(stats.min) },
              { label: 'Max', value: String(stats.max) },
              { label: 'Range', value: stats.range.toPrecision(4) },
          ]
        : [];

    return (
        <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>
                {'\uD83D\uDCCA'} Statistics Calculator
            </h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                Analyze repeated measurements: get mean, standard deviation, standard error, and more.
            </p>

            {/* Instructions */}
            <div className="instructions">
                <p><strong>Instructions:</strong></p>
                <p>{'\u2022'} Paste or type your repeated measurements below (one per line, or comma/space separated).</p>
                <p>{'\u2022'} Click <strong>Calculate</strong> to see descriptive statistics and a histogram.</p>
                <p>{'\u2022'} The result is properly rounded using scientific conventions.</p>
            </div>

            {/* Input area */}
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

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                    onClick={handleCalculate}
                    style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: '#c62828',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                    }}
                >
                    Calculate
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
                    Try Example
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
                        <button
                            onClick={handleCopy}
                            style={{
                                marginTop: '0.75rem',
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
                                // Histogram of measurements
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
                                    title: 'Value',
                                    gridcolor: '#eee',
                                },
                                yaxis: {
                                    title: 'Count',
                                    gridcolor: '#eee',
                                },
                                shapes: [
                                    // Vertical line at mean
                                    {
                                        type: 'line',
                                        x0: stats.mean,
                                        x1: stats.mean,
                                        y0: 0,
                                        y1: 1,
                                        yref: 'paper',
                                        line: { color: '#c62828', width: 2.5, dash: 'dash' },
                                    },
                                    // Shaded +/- sigma region
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
                </>
            )}
        </div>
    );
}

export default StatisticsCalculator;
