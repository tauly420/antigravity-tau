import { useState } from 'react';
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
                // 1D integration
                const boundsArray = bounds.split(',').map(s => parseFloat(s.trim()));
                if (boundsArray.length !== 2 || boundsArray.some(isNaN)) {
                    throw new Error('For 1D: bounds should be "a, b"');
                }

                const response = await api.integrate1D({
                    function: functionStr,
                    bounds: [boundsArray[0], boundsArray[1]],
                    method: method1D
                });

                setResult({ dimension: 1, ...response });
            } else {
                // Multi-dimensional integration
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
                    num_samples: numSamples
                });

                setResult({ dimension, ...response });
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Integration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <h2>Numerical Integrator</h2>

            <div className="instructions">
                <p><strong>Instructions:</strong></p>
                <p><strong>1D Integration:</strong></p>
                <p>• Function: <code>x**2</code>, Bounds: <code>0, 1</code></p>
                <p>• Methods: quad (adaptive, recommended), trapezoid, simpson, romberg</p>
                <p>• Divergence warnings appear for improper integrals</p>
                <p><strong>2D+ Integration:</strong></p>
                <p>• Function uses variables: <code>x, y, z, w, v, u</code> (in order)</p>
                <p>• 2D example: <code>x*y</code>, Bounds: <code>0, 1; 0, 1</code> (semicolon-separated)</p>
                <p>• 3D example: <code>x**2 + y**2 + z**2</code>, Bounds: <code>0, 1; 0, 1; 0, 1</code></p>
                <p>• Optional condition: <code>x**2 + y**2 \u003c 1</code> (for disk/sphere regions)</p>
            </div>

            <div className="form-group">
                <label>Dimension</label>
                <select value={dimension} onChange={(e) => setDimension(parseInt(e.target.value))}>
                    <option value={1}>1D</option>
                    <option value={2}>2D</option>
                    <option value={3}>3D</option>
                    <option value={4}>4D</option>
                    <option value={5}>5D</option>
                    <option value={6}>6D</option>
                </select>
            </div>

            <div className="form-group">
                <label>Function</label>
                <textarea
                    value={functionStr}
                    onChange={(e) => setFunctionStr(e.target.value)}
                    placeholder={dimension === 1 ? "x**2" : dimension === 2 ? "x*y" : "x**2 + y**2 + z**2"}
                    rows={2}
                />
                <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                    Variables: {dimension === 1 ? 'x' : ['x', 'y', 'z', 'w', 'v', 'u'].slice(0, dimension).join(', ')}
                </small>
            </div>

            <div className="form-group">
                <label>Integration Bounds</label>
                <input
                    type="text"
                    value={bounds}
                    onChange={(e) => setBounds(e.target.value)}
                    placeholder={dimension === 1 ? "0, 1" : dimension === 2 ? "0, 1; 0, 1" : "0, 1; 0, 1; 0, 1"}
                />
                <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                    {dimension === 1 ? 'Format: a, b' : `Format: a₁, b₁; a₂, b₂${dimension > 2 ? '; ...' : ''} (semicolon-separated pairs)`}
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
                        <label>Condition (optional, for complex regions)</label>
                        <input
                            type="text"
                            value={condition}
                            onChange={(e) => setCondition(e.target.value)}
                            placeholder="x**2 + y**2 < 1"
                        />
                        <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                            Leave empty to integrate over entire bounding box. Use for circles, spheres, etc.
                        </small>
                    </div>

                    <div className="form-group">
                        <label>Monte Carlo Samples</label>
                        <input
                            type="number"
                            value={numSamples}
                            onChange={(e) => setNumSamples(parseInt(e.target.value) || 100000)}
                            min="1000"
                            max="10000000"
                        />
                        <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                            More samples = better accuracy (but slower). 100,000 is usually good.
                        </small>
                    </div>
                </>
            )}

            <button onClick={handleIntegrate} disabled={loading}>
                {loading ? 'Integrating...' : 'Integrate'}
            </button>

            {error && <div className="error-message">{error}</div>}

            {result && (
                <div className={`result-box ${result.diverged || result.warning ? 'warning' : 'success'}`} style={{ marginTop: '1.5rem' }}>
                    <h3>Result</h3>

                    {result.diverged ? (
                        <div className="result-box error">
                            <p><strong>⚠️ Integral Diverges</strong></p>
                            <p>The integral does not converge (infinite or undefined result)</p>
                            {result.warning && <p style={{ marginTop: '0.5rem' }}>{result.warning}</p>}
                        </div>
                    ) : (
                        <>
                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '1rem 0' }}>
                                ∫ f = {result.result !== null ? result.result.toFixed(8) : 'N/A'}
                            </p>

                            {result.error_estimate !== null && result.error_estimate !== undefined && (
                                <p style={{ fontSize: '1rem', color: '#666' }}>
                                    Error estimate: ± {result.error_estimate.toExponential(3)}
                                </p>
                            )}

                            {result.warning && (
                                <div className="result-box warning" style={{ marginTop: '1rem' }}>
                                    <p><strong>⚠️ Warning:</strong> {result.warning}</p>
                                </div>
                            )}

                            {result.volume !== undefined && (
                                <p style={{ marginTop: '0.5rem', color: '#666' }}>
                                    Integration volume: {result.volume.toFixed(6)}
                                </p>
                            )}

                            {result.method && (
                                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#888' }}>
                                    Method used: {result.method}
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default NumericalIntegrator;
