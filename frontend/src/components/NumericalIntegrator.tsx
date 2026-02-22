import { useState } from 'react';
import Plot from './PlotWrapper';
import * as api from '../services/api';

function NumericalIntegrator() {
    const [dimension, setDimension] = useState<number>(1);
    const [functionStr, setFunctionStr] = useState<string>('x**2');
    const [bounds, setBounds] = useState<string>('0, 1');
    const [method1D, setMethod1D] = useState<string>('quad');
    const [condition, setCondition] = useState<string>('');
    const [numSamples, setNumSamples] = useState<number>(100000);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const handleIntegrate = async () => {
        setError('');
        setResult(null);
        setLoading(true);

        try {
            if (dimension === 1) {
                const boundsArray = bounds.split(',').map(s => parseFloat(s.trim()));
                if (boundsArray.length !== 2 || boundsArray.some(isNaN)) {
                    throw new Error('For 1D: bounds should be "a, b"');
                }

                const response = await api.integrate1D({
                    function: functionStr,
                    bounds: [boundsArray[0], boundsArray[1]],
                    method: method1D,
                });

                setResult({ dimension: 1, ...response, boundsUsed: boundsArray });
            } else {
                const boundsArray = bounds.split(';').map(b => {
                    const pair = b.trim().split(',').map(s => parseFloat(s.trim()));
                    if (pair.length !== 2 || pair.some(isNaN)) {
                        throw new Error(`Invalid bounds format. Use: "a1, b1; a2, b2; ..."`);
                    }
                    return pair;
                });

                if (boundsArray.length !== dimension) {
                    throw new Error(`Expected ${dimension} pairs of bounds, got ${boundsArray.length}`);
                }

                const response = await api.integrateMulti({
                    function: functionStr,
                    bounds: boundsArray,
                    condition: condition || undefined,
                    num_samples: numSamples,
                });

                setResult({ dimension, ...response });
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Integration failed');
        } finally {
            setLoading(false);
        }
    };

    /* ─── Build 1D plot data: function curve + shaded area ─── */
    const get1DPlotData = () => {
        if (!result || result.dimension !== 1 || !result.boundsUsed) return null;
        const [a, b] = result.boundsUsed;
        const N = 200;
        const dx = (b - a) / N;
        const xFull: number[] = [];
        const yFull: number[] = [];

        // Wider range for context
        const pad = (b - a) * 0.3;
        const xMin = a - pad;
        const xMax = b + pad;
        const dxFull = (xMax - xMin) / N;

        // Evaluate function via simple JS math
        const safeEval = (expr: string, xVal: number): number => {
            try {
                const prepared = expr
                    .replace(/\bx\b/g, `(${xVal})`)
                    .replace(/\*\*/g, '^')
                    .replace(/\bsin\b/g, 'Math.sin')
                    .replace(/\bcos\b/g, 'Math.cos')
                    .replace(/\btan\b/g, 'Math.tan')
                    .replace(/\bexp\b/g, 'Math.exp')
                    .replace(/\blog\b/g, 'Math.log')
                    .replace(/\bsqrt\b/g, 'Math.sqrt')
                    .replace(/\babs\b/g, 'Math.abs')
                    .replace(/\bpi\b/g, 'Math.PI')
                    .replace(/\^/g, '**');
                return Function(`"use strict"; return (${prepared});`)();
            } catch {
                return NaN;
            }
        };

        // Full curve
        for (let i = 0; i <= N; i++) {
            const x = xMin + i * dxFull;
            xFull.push(x);
            yFull.push(safeEval(functionStr, x));
        }

        // Shaded area (between a and b)
        const xShade: number[] = [a];
        const yShade: number[] = [0];
        for (let i = 0; i <= N; i++) {
            const x = a + i * dx;
            xShade.push(x);
            yShade.push(safeEval(functionStr, x));
        }
        xShade.push(b);
        yShade.push(0);

        return { xFull, yFull, xShade, yShade };
    };

    const plotData = (result?.dimension === 1) ? get1DPlotData() : null;

    return (
        <div className="card">
            <h2>Numerical Integrator</h2>

            <div className="instructions">
                <p><strong>1D Integration:</strong> Enter f(x) and bounds [a, b]. The area under the curve will be shown.</p>
                <p><strong>Multi-D:</strong> Uses Monte Carlo. Variables: <code>x, y, z, w, v, u</code>. Bounds: semicolon-separated pairs.</p>
                <p>Functions: <code>sin, cos, exp, log, sqrt, abs</code>, constants: <code>pi, e</code></p>
            </div>

            <div className="form-group">
                <label>Dimension</label>
                <select value={dimension} onChange={(e) => setDimension(parseInt(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}D</option>)}
                </select>
            </div>

            <div className="form-group">
                <label>Function f({dimension === 1 ? 'x' : ['x', 'y', 'z', 'w', 'v', 'u'].slice(0, dimension).join(', ')})</label>
                <textarea
                    value={functionStr}
                    onChange={(e) => setFunctionStr(e.target.value)}
                    placeholder={dimension === 1 ? 'x**2' : dimension === 2 ? 'x*y' : 'x**2 + y**2 + z**2'}
                    rows={2}
                    style={{ fontFamily: 'monospace' }}
                />
            </div>

            <div className="form-group">
                <label>Bounds</label>
                <input
                    type="text"
                    value={bounds}
                    onChange={(e) => setBounds(e.target.value)}
                    placeholder={dimension === 1 ? '0, 1' : '0, 1; 0, 1'}
                    style={{ fontFamily: 'monospace' }}
                />
                <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                    {dimension === 1 ? 'Format: a, b' : `Format: a₁, b₁; a₂, b₂${dimension > 2 ? '; …' : ''}`}
                </small>
            </div>

            {dimension === 1 ? (
                <div className="form-group">
                    <label>Method</label>
                    <select value={method1D} onChange={(e) => setMethod1D(e.target.value)}>
                        <option value="quad">Adaptive Quadrature (Recommended)</option>
                        <option value="trapezoid">Trapezoidal Rule</option>
                        <option value="simpson">Simpson's Rule</option>
                        <option value="romberg">Romberg Integration</option>
                    </select>
                </div>
            ) : (
                <>
                    <div className="form-group">
                        <label>Condition (optional)</label>
                        <input type="text" value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="x**2 + y**2 < 1" style={{ fontFamily: 'monospace' }} />
                        <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>For circles, spheres, etc.</small>
                    </div>
                    <div className="form-group">
                        <label>Monte Carlo Samples</label>
                        <input type="number" value={numSamples} onChange={(e) => setNumSamples(parseInt(e.target.value) || 100000)} min="1000" max="10000000" />
                    </div>
                </>
            )}

            <button onClick={handleIntegrate} disabled={loading}>
                {loading ? '⏳ Integrating…' : '▶ Integrate'}
            </button>

            {error && <div className="error-message">{error}</div>}

            {result && (
                <div className={`result-box ${result.diverged || result.warning ? 'warning' : 'success'}`} style={{ marginTop: '1.5rem' }}>
                    <h3>Result</h3>
                    {result.diverged ? (
                        <>
                            <p><strong>⚠️ Integral Diverges</strong></p>
                            <p>The integral does not converge.</p>
                            {result.warning && <p style={{ marginTop: '0.5rem' }}>{result.warning}</p>}
                        </>
                    ) : (
                        <>
                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '1rem 0', fontFamily: 'monospace' }}>
                                ∫ f = {result.result !== null ? result.result.toFixed(8) : 'N/A'}
                            </p>
                            {result.error_estimate != null && (
                                <p style={{ color: '#666' }}>Error estimate: ± {result.error_estimate.toExponential(3)}</p>
                            )}
                            {result.warning && (
                                <p style={{ color: '#e65100', marginTop: '0.5rem' }}>⚠️ {result.warning}</p>
                            )}
                            {result.method && (
                                <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '0.5rem' }}>Method: {result.method}</p>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* 1D plot: function + shaded area */}
            {plotData && !result.diverged && (
                <div style={{ marginTop: '1.5rem' }}>
                    <Plot
                        data={[
                            {
                                x: plotData.xFull,
                                y: plotData.yFull,
                                type: 'scatter' as const,
                                mode: 'lines' as const,
                                name: `f(x) = ${functionStr}`,
                                line: { color: '#1976d2', width: 2.5 },
                            },
                            {
                                x: plotData.xShade,
                                y: plotData.yShade,
                                type: 'scatter' as const,
                                fill: 'tozeroy' as const,
                                name: `Area = ${result.result?.toFixed(6)}`,
                                fillcolor: 'rgba(198, 40, 40, 0.2)',
                                line: { color: 'rgba(198, 40, 40, 0.6)', width: 1 },
                            },
                        ]}
                        layout={{
                            title: { text: `∫ ${functionStr} dx` },
                            xaxis: { title: { text: 'x' }, gridcolor: '#e0e0e0' },
                            yaxis: { title: { text: 'f(x)' }, gridcolor: '#e0e0e0' },
                            height: 400,
                            margin: { l: 60, r: 30, t: 55, b: 55 },
                            legend: { x: 0, y: 1.15, orientation: 'h' as const },
                            plot_bgcolor: '#fafafa',
                            paper_bgcolor: '#fff',
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

export default NumericalIntegrator;
