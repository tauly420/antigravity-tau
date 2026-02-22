import { useState } from 'react';
import Plot from './PlotWrapper';
import * as api from '../services/api';

function ODESolver() {
    const [functionStr, setFunctionStr] = useState<string>('y[1], -y[0]');
    const [initialConditions, setInitialConditions] = useState<string>('1, 0');
    const [tSpan, setTSpan] = useState<string>('0, 10');
    const [numPoints, setNumPoints] = useState<number>(100);
    const [method, setMethod] = useState<string>('RK45');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const handleSolve = async () => {
        setError('');
        setResult(null);
        setLoading(true);

        try {
            // Parse inputs
            const ic = initialConditions.split(',').map(s => parseFloat(s.trim()));
            const ts = tSpan.split(',').map(s => parseFloat(s.trim()));

            if (ic.some(isNaN) || ts.some(isNaN) || ts.length !== 2) {
                throw new Error('Invalid input format');
            }

            const response = await api.solveODE({
                function: functionStr,
                initial_conditions: ic,
                t_span: [ts[0], ts[1]],
                num_points: numPoints,
                method
            });

            setResult(response);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Solving failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <h2>ODE Solver</h2>

            <div className="instructions">
                <p><strong>Instructions:</strong></p>
                <p>• For <strong>first-order</strong> ODE (dy/dt = f(t,y)): enter function like <code>-0.5*y[0]</code></p>
                <p>• For <strong>second-order</strong> ODE (y'' = f(t,y,y')): convert to system of first-order ODEs</p>
                <p>   Example: y'' = -y becomes: <code>y[1], -y[0]</code> with initial conditions <code>1, 0</code> for [y(0), y'(0)]</p>
                <p>• Use <code>y[0], y[1], y[2]...</code> for state variables, <code>t</code> for time</p>
                <p>• Available functions: <code>sin, cos, tan, exp, log, sqrt</code></p>
            </div>

            <div className="form-group">
                <label>ODE Function (comma-separated for systems)</label>
                <textarea
                    value={functionStr}
                    onChange={(e) => setFunctionStr(e.target.value)}
                    placeholder="y[1], -y[0]"
                    rows={3}
                />
                <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                    Format: dy₁/dt, dy₂/dt, ... (each comma-separated expression)
                </small>
            </div>

            <div className="grid grid-2">
                <div className="form-group">
                    <label>Initial Conditions</label>
                    <input
                        type="text"
                        value={initialConditions}
                        onChange={(e) => setInitialConditions(e.target.value)}
                        placeholder="1, 0"
                    />
                    <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                        Comma-separated: y₁(0), y₂(0), ...
                    </small>
                </div>

                <div className="form-group">
                    <label>Time Span [t_start, t_end]</label>
                    <input
                        type="text"
                        value={tSpan}
                        onChange={(e) => setTSpan(e.target.value)}
                        placeholder="0, 10"
                    />
                </div>
            </div>

            <div className="grid grid-2">
                <div className="form-group">
                    <label>Number of Points</label>
                    <input
                        type="number"
                        value={numPoints}
                        onChange={(e) => setNumPoints(parseInt(e.target.value) || 100)}
                        min="10"
                        max="1000"
                    />
                </div>

                <div className="form-group">
                    <label>Solver Method</label>
                    <select value={method} onChange={(e) => setMethod(e.target.value)}>
                        <option value="RK45">RK45 (Recommended)</option>
                        <option value="RK23">RK23</option>
                        <option value="DOP853">DOP853 (High precision)</option>
                        <option value="Radau">Radau (Stiff problems)</option>
                        <option value="BDF">BDF (Stiff problems)</option>
                        <option value="LSODA">LSODA (Auto stiffness)</option>
                    </select>
                </div>
            </div>

            <button onClick={handleSolve} disabled={loading}>
                {loading ? 'Solving...' : 'Solve ODE'}
            </button>

            {error && <div className="error-message">{error}</div>}

            {result && (
                <div className="result-box success" style={{ marginTop: '1.5rem' }}>
                    <h3>Solution</h3>
                    <p style={{ marginBottom: '1rem' }}><strong>Status:</strong> {result.message}</p>

                    <Plot
                        data={result.y.map((component: number[], idx: number) => ({
                            x: result.t,
                            y: component,
                            type: 'scatter',
                            mode: 'lines',
                            name: `y${idx}(t)`,
                            line: { width: 2.5 }
                        }))}
                        layout={{
                            title: { text: 'ODE Solution' },
                            xaxis: { title: { text: 'Time (t)' } },
                            yaxis: { title: { text: 'Solution y(t)' } },
                            autosize: true,
                            margin: { l: 60, r: 30, t: 60, b: 60 },
                            legend: { x: 1.05, y: 1 }
                        }}
                        config={{ responsive: true }}
                        style={{ width: '100%', height: '500px' }}
                    />

                    <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
                        <p>Solution computed with {result.t.length} points using {method} method</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ODESolver;
