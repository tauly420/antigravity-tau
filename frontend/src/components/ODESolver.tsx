import { useState } from 'react';
import Plot from './PlotWrapper';
import * as api from '../services/api';

/* ─── Preset examples ─── */
const EXAMPLES = [
    {
        name: '🎯 Simple Pendulum (no small angle)',
        func: 'y[1], -9.81/1.0*sin(y[0])',
        ic: '0.5, 0',
        tSpan: '0, 10',
        description: 'θ″ = −(g/L)·sin(θ)\n→ Let y₀=θ, y₁=θ̇\n→ dy₀/dt = y₁\n→ dy₁/dt = −(g/L)·sin(y₀)\n\nHere g=9.81, L=1.0 m, θ₀=0.5 rad, θ̇₀=0',
    },
    {
        name: '🌊 Harmonic Oscillator (damped)',
        func: 'y[1], -2*0.1*2*y[1] - 4*y[0]',
        ic: '1, 0',
        tSpan: '0, 15',
        description: 'ẍ + 2ζωₙẋ + ωₙ²x = 0\n→ ωₙ=2, ζ=0.1\n→ dy₀/dt = y₁\n→ dy₁/dt = −2ζωₙ·y₁ − ωₙ²·y₀',
    },
    {
        name: '📉 Exponential Decay',
        func: '-0.5*y[0]',
        ic: '10',
        tSpan: '0, 10',
        description: 'dy/dt = −0.5·y\nSolution: y(t) = 10·e^(−0.5t)',
    },
    {
        name: '🌀 Lotka-Volterra (predator-prey)',
        func: '1.5*y[0] - 1.0*y[0]*y[1], -0.75*y[1] + 0.5*y[0]*y[1]',
        ic: '10, 5',
        tSpan: '0, 20',
        description: 'ẋ = αx − βxy\nẏ = −γy + δxy\nα=1.5, β=1.0, γ=0.75, δ=0.5',
    },
];

function ODESolver() {
    const [functionStr, setFunctionStr] = useState('y[1], -9.81/1.0*sin(y[0])');
    const [initialConditions, setInitialConditions] = useState('0.5, 0');
    const [tSpan, setTSpan] = useState('0, 10');
    const [numPoints, setNumPoints] = useState(300);
    const [method, setMethod] = useState('RK45');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const loadExample = (ex: typeof EXAMPLES[0]) => {
        setFunctionStr(ex.func);
        setInitialConditions(ex.ic);
        setTSpan(ex.tSpan);
        setResult(null);
        setError('');
    };

    const handleSolve = async () => {
        setError('');
        setResult(null);
        setLoading(true);
        try {
            const ic = initialConditions.split(',').map(s => parseFloat(s.trim()));
            const ts = tSpan.split(',').map(s => parseFloat(s.trim()));
            if (ic.some(isNaN) || ts.some(isNaN) || ts.length !== 2) throw new Error('Invalid input format');

            const response = await api.solveODE({
                function: functionStr,
                initial_conditions: ic,
                t_span: [ts[0], ts[1]],
                num_points: numPoints,
                method,
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
                <p><strong>How to use:</strong> Enter a system of first-order ODEs.</p>
                <p>State variables are <code>y[0], y[1], y[2], …</code>, time variable is <code>t</code>.</p>
                <p>Functions: <code>sin, cos, tan, exp, log, sqrt, abs</code></p>

                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)' }}>
                    <p><strong>Converting a 2nd-order ODE to a system of 1st-order ODEs:</strong></p>
                    <p style={{ marginTop: '0.5rem' }}>
                        Given a 2nd-order ODE: &nbsp;<strong>θ″ = f(t, θ, θ′)</strong>
                    </p>
                    <p style={{ marginTop: '0.3rem' }}>1. Define new state variables:</p>
                    <p style={{ paddingLeft: '1.5rem', fontFamily: 'monospace' }}>
                        y[0] = θ &nbsp;&nbsp;(the original variable)<br />
                        y[1] = θ′ &nbsp;(its first derivative)
                    </p>
                    <p style={{ marginTop: '0.3rem' }}>2. Write the system:</p>
                    <p style={{ paddingLeft: '1.5rem', fontFamily: 'monospace' }}>
                        dy[0]/dt = y[1] &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(by definition)<br />
                        dy[1]/dt = f(t, y[0], y[1]) &nbsp;(the original equation)
                    </p>
                    <p style={{ marginTop: '0.5rem' }}><strong>Example — Simple pendulum</strong> (θ″ = −(g/L)·sin(θ), no small angle):</p>
                    <p style={{ paddingLeft: '1.5rem', fontFamily: 'monospace' }}>
                        Function: <code>y[1], -9.81/1.0*sin(y[0])</code><br />
                        Initial conditions: <code>θ₀, θ̇₀</code> → e.g. <code>0.5, 0</code>
                    </p>
                </div>
            </div>

            {/* Example buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                {EXAMPLES.map(ex => (
                    <button key={ex.name} className="btn-accent" onClick={() => loadExample(ex)} style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                        {ex.name}
                    </button>
                ))}
            </div>

            <div className="form-group">
                <label>ODE System (comma-separated: dy₀/dt, dy₁/dt, …)</label>
                <textarea
                    value={functionStr}
                    onChange={e => setFunctionStr(e.target.value)}
                    placeholder="y[1], -9.81/1.0*sin(y[0])"
                    rows={2}
                    style={{ fontFamily: 'monospace' }}
                />
            </div>

            <div className="grid grid-2">
                <div className="form-group">
                    <label>Initial Conditions (y₀(0), y₁(0), …)</label>
                    <input
                        type="text"
                        value={initialConditions}
                        onChange={e => setInitialConditions(e.target.value)}
                        placeholder="0.5, 0"
                        style={{ fontFamily: 'monospace' }}
                    />
                </div>
                <div className="form-group">
                    <label>Time Span [t_start, t_end]</label>
                    <input
                        type="text"
                        value={tSpan}
                        onChange={e => setTSpan(e.target.value)}
                        placeholder="0, 10"
                        style={{ fontFamily: 'monospace' }}
                    />
                </div>
            </div>

            <div className="grid grid-2">
                <div className="form-group">
                    <label>Number of Points</label>
                    <input type="number" value={numPoints} onChange={e => setNumPoints(parseInt(e.target.value) || 300)} min="10" max="2000" />
                </div>
                <div className="form-group">
                    <label>Solver Method</label>
                    <select value={method} onChange={e => setMethod(e.target.value)}>
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
                {loading ? '⏳ Solving…' : '▶ Solve ODE'}
            </button>

            {error && <div className="error-message">{error}</div>}

            {result && (
                <div style={{ marginTop: '1.5rem' }}>
                    <div className="result-box success">
                        <h3>Solution</h3>
                        <p><strong>Status:</strong> {result.message}</p>
                        <p style={{ fontSize: '0.9rem', color: '#666' }}>
                            {result.t.length} points, method: {method}
                        </p>
                    </div>

                    <Plot
                        data={result.y.map((component: number[], idx: number) => ({
                            x: result.t,
                            y: component,
                            type: 'scatter' as const,
                            mode: 'lines' as const,
                            name: result.y.length === 1 ? 'y(t)' : `y${idx}(t)`,
                            line: { width: 2.5 },
                        }))}
                        layout={{
                            title: { text: 'ODE Solution' },
                            xaxis: { title: { text: 'Time (t)' }, gridcolor: '#e0e0e0' },
                            yaxis: { title: { text: 'y(t)' }, gridcolor: '#e0e0e0' },
                            height: 450,
                            margin: { l: 60, r: 30, t: 55, b: 55 },
                            legend: { x: 0, y: 1.15, orientation: 'h' as const },
                            plot_bgcolor: '#fafafa',
                            paper_bgcolor: '#fff',
                        }}
                        useResizeHandler
                        style={{ width: '100%' }}
                        config={{ responsive: true, displaylogo: false, toImageButtonOptions: { format: 'png' as any, filename: 'ode_solution', height: 800, width: 1200, scale: 2 } }}
                    />

                    {/* Phase portrait for 2-component systems */}
                    {result.y.length >= 2 && (
                        <Plot
                            data={[{
                                x: result.y[0],
                                y: result.y[1],
                                type: 'scatter' as const,
                                mode: 'lines' as const,
                                name: 'Phase portrait',
                                line: { width: 2, color: '#d32f2f' },
                            }]}
                            layout={{
                                title: { text: 'Phase Portrait' },
                                xaxis: { title: { text: 'y₀' }, gridcolor: '#e0e0e0' },
                                yaxis: { title: { text: 'y₁' }, gridcolor: '#e0e0e0' },
                                height: 400,
                                margin: { l: 60, r: 30, t: 55, b: 55 },
                                plot_bgcolor: '#fafafa',
                                paper_bgcolor: '#fff',
                            }}
                            useResizeHandler
                            style={{ width: '100%' }}
                            config={{ responsive: true, displaylogo: false }}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

export default ODESolver;
