import { useState, useRef, useCallback, useEffect } from 'react';
import Plot from './PlotWrapper';
import * as api from '../services/api';

/* ═══════════════════════════════════════════════════════════════
   PRESETS — creative & useful physics examples
   ═══════════════════════════════════════════════════════════════ */
const EXAMPLES = [
    {
        name: '🎯 Simple Pendulum',
        func: 'y[1], -9.81/1.0*sin(y[0])',
        ic: '0.5, 0',
        tSpan: '0, 10',
        coord: 'cartesian',
        description: 'θ″ = −(g/L)·sin(θ)  |  g=9.81, L=1.0, θ₀=0.5 rad',
    },
    {
        name: '🌊 Damped Oscillator',
        func: 'y[1], -2*0.1*2*y[1] - 4*y[0]',
        ic: '1, 0',
        tSpan: '0, 15',
        coord: 'cartesian',
        description: 'ẍ + 2ζωₙẋ + ωₙ²x = 0  |  ωₙ=2, ζ=0.1',
    },
    {
        name: '🌀 Lotka-Volterra',
        func: '1.5*y[0] - 1.0*y[0]*y[1], -0.75*y[1] + 0.5*y[0]*y[1]',
        ic: '10, 5',
        tSpan: '0, 20',
        coord: 'cartesian',
        description: 'Predator-prey: ẋ = αx − βxy, ẏ = −γy + δxy',
    },
    {
        name: '🪐 Orbit (Polar)',
        func: 'y[1], y[0]*y[3]**2 - 1.0/y[0]**2, y[3], -2*y[1]*y[3]/y[0]',
        ic: '1.0, 0, 0, 1.2',
        tSpan: '0, 15',
        coord: 'polar',
        description: 'Central force orbit  |  r, ṙ, θ, θ̇  |  F = −1/r²',
    },
    {
        name: '🌍 Projectile (drag)',
        func: 'y[2], y[3], -0.01*y[2]*sqrt(y[2]**2+y[3]**2), -9.81 - 0.01*y[3]*sqrt(y[2]**2+y[3]**2)',
        ic: '0, 0, 30, 40',
        tSpan: '0, 7',
        coord: 'cartesian',
        description: 'x, y, vx, vy with quadratic air drag  |  v₀=(30,40) m/s',
    },
    {
        name: '⚡ Van der Pol',
        func: 'y[1], 2.0*(1 - y[0]**2)*y[1] - y[0]',
        ic: '2, 0',
        tSpan: '0, 30',
        coord: 'cartesian',
        description: 'Nonlinear oscillator: ẍ − μ(1−x²)ẋ + x = 0',
    },
    {
        name: '🦋 Lorenz Attractor',
        func: '10*(y[1]-y[0]), y[0]*(28-y[2])-y[1], y[0]*y[1]-(8/3)*y[2]',
        ic: '1, 1, 1',
        tSpan: '0, 40',
        coord: 'cartesian',
        description: 'Chaotic system: σ=10, ρ=28, β=8/3',
    },
    {
        name: '🔄 Double Pendulum',
        func: [
            'y[2],',
            'y[3],',
            '(-9.81*(2*1)*sin(y[0]) - 1*9.81*sin(y[0]-2*y[1]) - 2*1*1*(y[3]**2 + y[2]**2*cos(y[0]-y[1]))*sin(y[0]-y[1])) / (1*(2*1 - 1*cos(y[0]-y[1])**2)),',
            '(2*sin(y[0]-y[1])*(1*1*y[2]**2 + 9.81*1*cos(y[0]) + 1*1*y[3]**2*cos(y[0]-y[1]))) / (1*(2*1 - 1*cos(y[0]-y[1])**2))',
        ].join(' '),
        ic: '2.0, 2.5, 0, 0',
        tSpan: '0, 20',
        coord: 'cartesian',
        description: 'Chaotic double pendulum  |  θ₁, θ₂, ω₁, ω₂  |  L₁=L₂=m₁=m₂=1',
    },
];

/* ═══════════════════════════════════════════════════════════════ */

function ODESolver() {
    const [functionStr, setFunctionStr] = useState(EXAMPLES[0].func);
    const [initialConditions, setInitialConditions] = useState(EXAMPLES[0].ic);
    const [tSpan, setTSpan] = useState(EXAMPLES[0].tSpan);
    const [numPoints, setNumPoints] = useState(500);
    const [method, setMethod] = useState('RK45');
    const [coordSystem, setCoordSystem] = useState('cartesian');

    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    /* ── Animation state ── */
    const [animating, setAnimating] = useState(false);
    const [animFrame, setAnimFrame] = useState(0);
    const [animSpeed, setAnimSpeed] = useState(1);
    const animRef = useRef<number | null>(null);
    const lastFrameTime = useRef(0);

    /* ── Plot mode toggle ── */
    const [showPhase, setShowPhase] = useState(true);
    const [showEnergy, setShowEnergy] = useState(false);
    const [showXY, setShowXY] = useState(false);

    const loadExample = (ex: typeof EXAMPLES[0]) => {
        setFunctionStr(ex.func);
        setInitialConditions(ex.ic);
        setTSpan(ex.tSpan);
        setCoordSystem(ex.coord || 'cartesian');
        setResult(null);
        setError('');
        stopAnimation();
    };

    const handleSolve = async () => {
        setError('');
        setResult(null);
        setLoading(true);
        stopAnimation();
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
                coordinate_system: coordSystem,
                compute_energy: true,
            });
            setResult(response);
            setAnimFrame(0);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Solving failed');
        } finally {
            setLoading(false);
        }
    };

    /* ── Animation engine ── */
    const stopAnimation = useCallback(() => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        animRef.current = null;
        setAnimating(false);
    }, []);

    const tick = useCallback((timestamp: number) => {
        if (!result) return;
        const dt = timestamp - lastFrameTime.current;
        if (dt < 16) { // ~60fps cap
            animRef.current = requestAnimationFrame(tick);
            return;
        }
        lastFrameTime.current = timestamp;
        setAnimFrame(prev => {
            const next = prev + animSpeed;
            if (next >= result.t.length) {
                stopAnimation();
                return result.t.length;
            }
            return next;
        });
        animRef.current = requestAnimationFrame(tick);
    }, [result, animSpeed, stopAnimation]);

    const startAnimation = useCallback(() => {
        if (!result) return;
        setAnimating(true);
        setAnimFrame(0);
        lastFrameTime.current = performance.now();
        animRef.current = requestAnimationFrame(tick);
    }, [result, tick]);

    const toggleAnimation = useCallback(() => {
        if (animating) {
            stopAnimation();
        } else {
            startAnimation();
        }
    }, [animating, startAnimation, stopAnimation]);

    // Cleanup on unmount
    useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

    /* ── Slice data for animation ── */
    const frameEnd = animating || animFrame > 0 ? Math.min(Math.round(animFrame), (result?.t?.length || 1) - 1) : null;

    const sliceArr = (arr: number[]) => frameEnd !== null ? arr.slice(0, frameEnd + 1) : arr;

    /* ── Plot config shared ── */
    const plotConfig = {
        responsive: true, displaylogo: false,
        toImageButtonOptions: { format: 'png' as any, filename: 'ode_plot', height: 800, width: 1200, scale: 2 },
    };
    const plotBg = { plot_bgcolor: '#fafafa', paper_bgcolor: '#fff' };

    /* ── Determine if this is an x-y system (4 components: x, y, vx, vy) ── */
    const isXY = result && result.y.length >= 4 && coordSystem === 'cartesian';
    const isPolar = result && coordSystem === 'polar' && result.x_cartesian;

    return (
        <div className="card">
            <h2>ODE Solver</h2>

            <div className="instructions">
                <p><strong>How to use:</strong> Enter a system of first-order ODEs.</p>
                <p>State variables: <code>y[0], y[1], …</code>, time: <code>t</code></p>
                <p>Functions: <code>sin, cos, tan, exp, log, sqrt, abs, atan2, heaviside, sign</code></p>
                <p>Constants: <code>pi</code>, <code>e</code></p>

                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)' }}>
                    <p><strong>Converting a 2nd-order ODE to a system:</strong></p>
                    <p style={{ marginTop: '0.5rem' }}>
                        Given: <strong>θ″ = f(t, θ, θ′)</strong> → Let y[0]=θ, y[1]=θ′
                    </p>
                    <p style={{ paddingLeft: '1.5rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                        dy[0]/dt = y[1]<br />
                        dy[1]/dt = f(t, y[0], y[1])
                    </p>
                </div>
            </div>

            {/* ── Examples ── */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                {EXAMPLES.map(ex => (
                    <button key={ex.name} className="btn-accent" onClick={() => loadExample(ex)}
                        style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}>
                        {ex.name}
                    </button>
                ))}
            </div>

            {/* ── Coordinate system selector ── */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '1rem' }}>
                {[
                    { val: 'cartesian', label: '📐 Cartesian' },
                    { val: 'polar', label: '🔵 Polar (r, θ)' },
                ].map(opt => (
                    <button key={opt.val} onClick={() => setCoordSystem(opt.val)}
                        style={{
                            padding: '0.5rem 1.2rem', cursor: 'pointer', fontSize: '0.9rem',
                            border: '2px solid #1565c0',
                            borderLeft: opt.val === 'polar' ? 'none' : undefined,
                            borderRadius: opt.val === 'cartesian' ? '8px 0 0 8px' : '0 8px 8px 0',
                            background: coordSystem === opt.val ? '#1565c0' : 'white',
                            color: coordSystem === opt.val ? 'white' : '#1565c0',
                            fontWeight: coordSystem === opt.val ? 700 : 400,
                        }}>
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* ── ODE input ── */}
            <div className="form-group">
                <label>ODE System (comma-separated: dy₀/dt, dy₁/dt, …)</label>
                <textarea
                    value={functionStr}
                    onChange={e => setFunctionStr(e.target.value)}
                    placeholder="y[1], -9.81/1.0*sin(y[0])"
                    rows={3}
                    style={{ fontFamily: 'monospace' }}
                />
            </div>

            <div className="grid grid-2">
                <div className="form-group">
                    <label>Initial Conditions (y₀(0), y₁(0), …)</label>
                    <input type="text" value={initialConditions}
                        onChange={e => setInitialConditions(e.target.value)}
                        placeholder="0.5, 0" style={{ fontFamily: 'monospace' }} />
                </div>
                <div className="form-group">
                    <label>Time Span [t_start, t_end]</label>
                    <input type="text" value={tSpan}
                        onChange={e => setTSpan(e.target.value)}
                        placeholder="0, 10" style={{ fontFamily: 'monospace' }} />
                </div>
            </div>

            <div className="grid grid-2">
                <div className="form-group">
                    <label>Points</label>
                    <input type="number" value={numPoints}
                        onChange={e => setNumPoints(parseInt(e.target.value) || 300)}
                        min="10" max="5000" />
                </div>
                <div className="form-group">
                    <label>Solver</label>
                    <select value={method} onChange={e => setMethod(e.target.value)}>
                        <option value="RK45">RK45 — general purpose</option>
                        <option value="RK23">RK23 — fast</option>
                        <option value="DOP853">DOP853 — high precision</option>
                        <option value="Radau">Radau — stiff problems</option>
                        <option value="BDF">BDF — stiff problems</option>
                        <option value="LSODA">LSODA — auto stiffness</option>
                    </select>
                </div>
            </div>

            <button onClick={handleSolve} disabled={loading} className="btn-primary"
                style={{ fontSize: '1.05rem', padding: '0.7rem 2rem' }}>
                {loading ? '⏳ Solving…' : '▶ Solve ODE'}
            </button>

            {error && <div className="error-message">{error}</div>}

            {/* ═══════════════════════════════════════════════════════
                RESULTS
                ═══════════════════════════════════════════════════════ */}
            {result && (
                <div style={{ marginTop: '1.5rem' }}>
                    <div className="result-box success">
                        <h3>✅ Solution Found</h3>
                        <p><strong>Status:</strong> {result.message}</p>
                        <p style={{ fontSize: '0.9rem', color: '#666' }}>
                            {result.t.length} points · method: {method} · coordinate system: {coordSystem}
                        </p>
                    </div>

                    {/* ── Animation controls ── */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '0.8rem 1rem', marginTop: '1rem',
                        background: 'linear-gradient(135deg, #e3f2fd, #f3e5f5)',
                        borderRadius: '10px', flexWrap: 'wrap',
                    }}>
                        <button onClick={toggleAnimation} className="btn-primary"
                            style={{ padding: '0.5rem 1.2rem', fontSize: '0.95rem' }}>
                            {animating ? '⏸ Pause' : '▶ Play Simulation'}
                        </button>
                        <button onClick={() => { stopAnimation(); setAnimFrame(0); }} className="btn-accent"
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                            ⏮ Reset
                        </button>
                        <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            Speed:
                            <input type="range" min={1} max={10} value={animSpeed}
                                onChange={e => setAnimSpeed(parseInt(e.target.value))}
                                style={{ width: '100px' }} />
                            <span>{animSpeed}x</span>
                        </label>
                        {frameEnd !== null && (
                            <span style={{ fontSize: '0.8rem', color: '#555' }}>
                                t = {result.t[Math.min(frameEnd, result.t.length - 1)]?.toFixed(3)}
                                &nbsp;({Math.min(frameEnd + 1, result.t.length)}/{result.t.length})
                            </span>
                        )}

                        {/* Toggle buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                            {result.y.length >= 2 && (
                                <button onClick={() => setShowPhase(p => !p)}
                                    style={{
                                        padding: '0.35rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer',
                                        borderRadius: '6px', border: '1.5px solid #7b1fa2',
                                        background: showPhase ? '#7b1fa2' : 'white',
                                        color: showPhase ? 'white' : '#7b1fa2',
                                    }}>
                                    Phase
                                </button>
                            )}
                            {(result.total_energy || result.energy) && (
                                <button onClick={() => setShowEnergy(p => !p)}
                                    style={{
                                        padding: '0.35rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer',
                                        borderRadius: '6px', border: '1.5px solid #00796b',
                                        background: showEnergy ? '#00796b' : 'white',
                                        color: showEnergy ? 'white' : '#00796b',
                                    }}>
                                    Energy
                                </button>
                            )}
                            {(isXY || isPolar) && (
                                <button onClick={() => setShowXY(p => !p)}
                                    style={{
                                        padding: '0.35rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer',
                                        borderRadius: '6px', border: '1.5px solid #e65100',
                                        background: showXY ? '#e65100' : 'white',
                                        color: showXY ? 'white' : '#e65100',
                                    }}>
                                    X-Y Trajectory
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Time series plot ── */}
                    <Plot
                        data={result.y.map((component: number[], idx: number) => ({
                            x: sliceArr(result.t),
                            y: sliceArr(component),
                            type: 'scatter' as const,
                            mode: 'lines' as const,
                            name: result.y.length === 1 ? 'y(t)' : `y${idx}(t)`,
                            line: { width: 2.5 },
                        }))}
                        layout={{
                            title: { text: 'Solution vs Time' },
                            xaxis: { title: { text: 'Time (t)' }, gridcolor: '#e0e0e0' },
                            yaxis: { title: { text: 'y(t)' }, gridcolor: '#e0e0e0' },
                            height: 420,
                            margin: { l: 60, r: 30, t: 50, b: 50 },
                            legend: { x: 0, y: 1.15, orientation: 'h' as const },
                            ...plotBg,
                        }}
                        useResizeHandler style={{ width: '100%' }}
                        config={plotConfig}
                    />

                    {/* ── Phase portrait ── */}
                    {showPhase && result.y.length >= 2 && (
                        <Plot
                            data={[
                                {
                                    x: sliceArr(result.y[0]),
                                    y: sliceArr(result.y[1]),
                                    type: 'scatter' as const,
                                    mode: 'lines' as const,
                                    name: 'Trajectory',
                                    line: { width: 2, color: '#7b1fa2' },
                                },
                                // Animated current point
                                ...(frameEnd !== null && frameEnd < result.y[0].length ? [{
                                    x: [result.y[0][frameEnd]],
                                    y: [result.y[1][frameEnd]],
                                    type: 'scatter' as const,
                                    mode: 'markers' as const,
                                    name: 'Current',
                                    marker: { size: 12, color: '#d32f2f', symbol: 'circle' },
                                    showlegend: false,
                                }] : []),
                            ]}
                            layout={{
                                title: { text: 'Phase Portrait' },
                                xaxis: { title: { text: 'y₀' }, gridcolor: '#e0e0e0' },
                                yaxis: { title: { text: 'y₁' }, gridcolor: '#e0e0e0', scaleanchor: 'x' as any },
                                height: 420,
                                margin: { l: 60, r: 30, t: 50, b: 50 },
                                ...plotBg,
                            }}
                            useResizeHandler style={{ width: '100%' }}
                            config={plotConfig}
                        />
                    )}

                    {/* ── X-Y Trajectory (Cartesian 4-component or Polar) ── */}
                    {showXY && (isXY || isPolar) && (
                        <Plot
                            data={[
                                {
                                    x: sliceArr(isPolar ? result.x_cartesian : result.y[0]),
                                    y: sliceArr(isPolar ? result.y_cartesian : result.y[1]),
                                    type: 'scatter' as const,
                                    mode: 'lines' as const,
                                    name: 'Trajectory',
                                    line: { width: 2.5, color: '#e65100' },
                                },
                                ...(frameEnd !== null ? [{
                                    x: [isPolar ? result.x_cartesian[Math.min(frameEnd, result.x_cartesian.length - 1)]
                                        : result.y[0][Math.min(frameEnd, result.y[0].length - 1)]],
                                    y: [isPolar ? result.y_cartesian[Math.min(frameEnd, result.y_cartesian.length - 1)]
                                        : result.y[1][Math.min(frameEnd, result.y[1].length - 1)]],
                                    type: 'scatter' as const,
                                    mode: 'markers' as const,
                                    name: 'Current',
                                    marker: { size: 14, color: '#d32f2f', symbol: 'star' },
                                    showlegend: false,
                                }] : []),
                            ]}
                            layout={{
                                title: { text: isPolar ? 'Orbit (X-Y from Polar)' : 'Spatial Trajectory (X vs Y)' },
                                xaxis: { title: { text: 'X' }, gridcolor: '#e0e0e0' },
                                yaxis: { title: { text: 'Y' }, gridcolor: '#e0e0e0', scaleanchor: 'x' as any },
                                height: 450,
                                margin: { l: 60, r: 30, t: 50, b: 50 },
                                ...plotBg,
                            }}
                            useResizeHandler style={{ width: '100%' }}
                            config={plotConfig}
                        />
                    )}

                    {/* ── Energy plot ── */}
                    {showEnergy && result.total_energy && (
                        <Plot
                            data={[
                                {
                                    x: sliceArr(result.t), y: sliceArr(result.kinetic_energy),
                                    type: 'scatter' as const, mode: 'lines' as const,
                                    name: 'Kinetic Energy', line: { width: 2, color: '#d32f2f' },
                                },
                                {
                                    x: sliceArr(result.t), y: sliceArr(result.potential_energy),
                                    type: 'scatter' as const, mode: 'lines' as const,
                                    name: 'Potential Energy', line: { width: 2, color: '#1565c0' },
                                },
                                {
                                    x: sliceArr(result.t), y: sliceArr(result.total_energy),
                                    type: 'scatter' as const, mode: 'lines' as const,
                                    name: 'Total Energy', line: { width: 3, color: '#2e7d32', dash: 'dash' },
                                },
                            ]}
                            layout={{
                                title: { text: 'Energy Conservation' },
                                xaxis: { title: { text: 'Time (t)' }, gridcolor: '#e0e0e0' },
                                yaxis: { title: { text: 'Energy' }, gridcolor: '#e0e0e0' },
                                height: 380,
                                margin: { l: 60, r: 30, t: 50, b: 50 },
                                legend: { x: 0, y: 1.15, orientation: 'h' as const },
                                ...plotBg,
                            }}
                            useResizeHandler style={{ width: '100%' }}
                            config={plotConfig}
                        />
                    )}

                    {/* ── 3D plot for 3-component systems (Lorenz etc) ── */}
                    {result.y.length >= 3 && (
                        <Plot
                            data={[{
                                x: sliceArr(result.y[0]),
                                y: sliceArr(result.y[1]),
                                z: sliceArr(result.y[2]),
                                type: 'scatter3d' as const,
                                mode: 'lines' as const,
                                name: '3D Trajectory',
                                line: { width: 2.5, color: sliceArr(result.t), colorscale: 'Viridis' } as any,
                            }]}
                            layout={{
                                title: { text: '3D Phase Space' },
                                scene: {
                                    xaxis: { title: 'y₀' },
                                    yaxis: { title: 'y₁' },
                                    zaxis: { title: 'y₂' },
                                },
                                height: 500,
                                margin: { l: 0, r: 0, t: 50, b: 0 },
                                ...plotBg,
                            } as any}
                            useResizeHandler style={{ width: '100%' }}
                            config={plotConfig}
                        />
                    )}

                    <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                        📷 Use the camera icon on each plot to download as PNG.
                    </p>
                </div>
            )}
        </div>
    );
}

export default ODESolver;
