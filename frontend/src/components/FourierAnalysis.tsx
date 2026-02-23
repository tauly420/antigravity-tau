import { useState } from 'react';
import Plot from './PlotWrapper';
import * as api from '../services/api';
import { smartFormat } from '../utils/format';

/* ─── Example signals ─── */
const EXAMPLES = [
    {
        name: '🎵 Two Frequencies + Noise',
        generate: () => {
            const N = 512, dt = 0.002;
            const t: number[] = [], y: number[] = [];
            for (let i = 0; i < N; i++) {
                const ti = i * dt;
                t.push(ti);
                y.push(3 * Math.sin(2 * Math.PI * 50 * ti) + 1.5 * Math.sin(2 * Math.PI * 120 * ti) + (Math.random() - 0.5) * 0.5);
            }
            return { t, y, dt, desc: '3·sin(2π·50t) + 1.5·sin(2π·120t) + noise, dt=0.002s' };
        }
    },
    {
        name: '📡 Square Wave',
        generate: () => {
            const N = 256, dt = 0.01;
            const t: number[] = [], y: number[] = [];
            for (let i = 0; i < N; i++) {
                const ti = i * dt;
                t.push(ti);
                y.push(Math.sign(Math.sin(2 * Math.PI * 5 * ti)));
            }
            return { t, y, dt, desc: 'Square wave at 5 Hz, dt=0.01s' };
        }
    },
    {
        name: '🔔 Gaussian Pulse',
        generate: () => {
            const N = 256, dt = 0.01;
            const t: number[] = [], y: number[] = [];
            const center = N * dt / 2;
            for (let i = 0; i < N; i++) {
                const ti = i * dt;
                t.push(ti);
                y.push(Math.exp(-((ti - center) ** 2) / 0.05));
            }
            return { t, y, dt, desc: 'Gaussian pulse, dt=0.01s' };
        }
    },
];

interface DominantFreq {
    frequency: number;
    amplitude: number;
    period: number;
    index: number;
}

function FourierAnalysis() {
    // Data input
    const [tData, setTData] = useState<number[]>([]);
    const [yData, setYData] = useState<number[]>([]);
    const [dt, setDt] = useState(0.01);
    const [dataDesc, setDataDesc] = useState('');
    const [manualInput, setManualInput] = useState('');

    // Analysis options
    const [computeDft, setComputeDft] = useState(true);
    const [computePsd, setComputePsd] = useState(true);

    // Results
    const [result, setResult] = useState<any>(null);
    const [reconstructed, setReconstructed] = useState<number[] | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Filtering
    const [filterType, setFilterType] = useState('none');
    const [cutoffLow, setCutoffLow] = useState(0);
    const [cutoffHigh, setCutoffHigh] = useState(100);
    const [filterLoading, setFilterLoading] = useState(false);

    const loadExample = (ex: typeof EXAMPLES[0]) => {
        const { t, y, dt: sdt, desc } = ex.generate();
        setTData(t);
        setYData(y);
        setDt(sdt);
        setDataDesc(desc);
        setResult(null);
        setReconstructed(null);
        setError('');
    };

    const parseManualData = () => {
        try {
            const lines = manualInput.trim().split('\n').filter(l => l.trim());
            const t: number[] = [], y: number[] = [];
            for (const line of lines) {
                const parts = line.trim().split(/[\s,\t]+/).map(Number);
                if (parts.length >= 2 && !parts.some(isNaN)) {
                    t.push(parts[0]);
                    y.push(parts[1]);
                } else if (parts.length === 1 && !isNaN(parts[0])) {
                    y.push(parts[0]);
                }
            }
            if (y.length < 4) throw new Error('Need at least 4 data points');
            if (t.length === 0) {
                for (let i = 0; i < y.length; i++) t.push(i * dt);
            } else if (t.length >= 2) {
                setDt(t[1] - t[0]);
            }
            setTData(t);
            setYData(y);
            setDataDesc(`${y.length} points from manual input`);
            setResult(null);
            setReconstructed(null);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleAnalyze = async () => {
        if (yData.length < 4) { setError('Load or enter data first (min 4 points)'); return; }
        setError('');
        setResult(null);
        setReconstructed(null);
        setLoading(true);
        try {
            const data = await api.analyzeFourier({
                y_data: yData,
                dt,
                compute_dft: computeDft,
                compute_psd: computePsd,
                n_dominant: 5,
            });
            setResult(data);
            // Auto-set filter cutoff to Nyquist / 2
            setCutoffHigh(data.nyquist_freq || 100);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Analysis failed');
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = async () => {
        if (!result) return;
        setFilterLoading(true);
        try {
            const data = await api.inverseFourier({
                dft_real: result.dft_real,
                dft_imag: result.dft_imag,
                n_points: result.n_points,
                filter_type: filterType,
                cutoff_low: cutoffLow,
                cutoff_high: cutoffHigh,
                frequencies: result.frequencies,
            });
            setReconstructed(data.reconstructed);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Reconstruction failed');
        } finally {
            setFilterLoading(false);
        }
    };

    const handleReconstructFull = async () => {
        if (!result) return;
        setFilterLoading(true);
        try {
            const data = await api.inverseFourier({
                dft_real: result.dft_real,
                dft_imag: result.dft_imag,
                n_points: result.n_points,
                filter_type: 'none',
                frequencies: result.frequencies,
            });
            setReconstructed(data.reconstructed);
            setFilterType('none');
        } catch (err: any) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setFilterLoading(false);
        }
    };

    return (
        <div className="card">
            <h2>Fourier Analysis & PSD</h2>

            <div className="instructions">
                <p>Compute the <strong>Discrete Fourier Transform</strong> and <strong>Power Spectral Density</strong> of your data.</p>
                <p>The 5 most dominant frequencies (with sufficient separation) are highlighted.</p>
                <p>You can reconstruct the signal via inverse DFT, and filter specific frequency ranges.</p>
            </div>

            {/* ─── Example buttons ─── */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {EXAMPLES.map(ex => (
                    <button key={ex.name} className="btn-accent" onClick={() => loadExample(ex)} style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                        {ex.name}
                    </button>
                ))}
            </div>

            {/* ─── Manual data input ─── */}
            <div className="form-group">
                <label>Or paste data (t y per line, or just y values)</label>
                <textarea
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    placeholder={"0.00  1.23\n0.01  2.45\n0.02  3.67\n..."}
                    rows={4}
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem' }}>
                    <button onClick={parseManualData} className="btn-primary" style={{ fontSize: '0.85rem' }}>Parse Data</button>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.8rem', margin: 0 }}>Δt (sampling interval)</label>
                        <input type="number" step="any" value={dt} onChange={e => setDt(parseFloat(e.target.value) || 0.01)} style={{ width: '100px', fontSize: '0.85rem' }} />
                    </div>
                </div>
            </div>

            {/* ─── Data status ─── */}
            {yData.length > 0 && (
                <div className="result-box success" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
                    <p style={{ margin: 0 }}><strong>{yData.length}</strong> data points loaded | Δt = {dt}s | Nyquist = {smartFormat(0.5 / dt)} Hz | {dataDesc}</p>
                </div>
            )}

            {/* ─── Options + Analyze ─── */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input type="checkbox" checked={computeDft} onChange={e => setComputeDft(e.target.checked)} /> DFT (Amplitude)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input type="checkbox" checked={computePsd} onChange={e => setComputePsd(e.target.checked)} /> PSD (Power)
                </label>
                <button onClick={handleAnalyze} disabled={loading || yData.length < 4} className="btn-primary">
                    {loading ? '⏳ Analyzing…' : '▶ Analyze'}
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {/* ─── Original signal plot ─── */}
            {yData.length > 0 && (
                <Plot
                    data={[
                        {
                            x: tData.length ? tData : yData.map((_, i) => i * dt),
                            y: yData,
                            type: 'scatter' as const,
                            mode: 'lines' as const,
                            name: 'Signal',
                            line: { color: '#1976d2', width: 1.5 },
                        },
                        ...(reconstructed ? [{
                            x: tData.length ? tData : yData.map((_, i) => i * dt),
                            y: reconstructed,
                            type: 'scatter' as const,
                            mode: 'lines' as const,
                            name: `Reconstructed (${filterType})`,
                            line: { color: '#d32f2f', width: 2, dash: 'dot' as const },
                        }] : []),
                    ]}
                    layout={{
                        title: { text: 'Time-Domain Signal' },
                        xaxis: { title: { text: 'Time (s)' }, gridcolor: '#e0e0e0' },
                        yaxis: { title: { text: 'Amplitude' }, gridcolor: '#e0e0e0' },
                        height: 350,
                        margin: { l: 60, r: 30, t: 45, b: 50 },
                        legend: { x: 0, y: 1.12, orientation: 'h' as const },
                        plot_bgcolor: '#fafafa',
                        paper_bgcolor: '#fff',
                    }}
                    useResizeHandler style={{ width: '100%' }}
                    config={{ responsive: true, displaylogo: false }}
                />
            )}

            {/* ─── DFT Plot ─── */}
            {result?.dft_magnitudes && (
                <Plot
                    data={[{
                        x: result.frequencies,
                        y: result.dft_magnitudes,
                        type: 'scatter' as const,
                        mode: 'lines' as const,
                        name: '|DFT|',
                        line: { color: '#388e3c', width: 1.5 },
                        fill: 'tozeroy' as const,
                        fillcolor: 'rgba(56, 142, 60, 0.1)',
                    }]}
                    layout={{
                        title: { text: 'DFT — Amplitude Spectrum' },
                        xaxis: { title: { text: 'Frequency (Hz)' }, gridcolor: '#e0e0e0' },
                        yaxis: { title: { text: 'Amplitude' }, gridcolor: '#e0e0e0' },
                        height: 350,
                        margin: { l: 60, r: 30, t: 45, b: 50 },
                        plot_bgcolor: '#fafafa',
                        paper_bgcolor: '#fff',
                        annotations: result.dominant_frequencies?.slice(0, 5).map((d: DominantFreq, i: number) => ({
                            x: d.frequency,
                            y: d.amplitude,
                            text: `${smartFormat(d.frequency, 4)} Hz`,
                            showarrow: true,
                            arrowhead: 2,
                            ax: 0,
                            ay: -25 - i * 15,
                            font: { size: 11, color: '#d32f2f' },
                        })),
                    }}
                    useResizeHandler style={{ width: '100%' }}
                    config={{ responsive: true, displaylogo: false }}
                />
            )}

            {/* ─── PSD Plot ─── */}
            {result?.psd && (
                <Plot
                    data={[{
                        x: result.frequencies,
                        y: result.psd,
                        type: 'scatter' as const,
                        mode: 'lines' as const,
                        name: 'PSD',
                        line: { color: '#7b1fa2', width: 1.5 },
                        fill: 'tozeroy' as const,
                        fillcolor: 'rgba(123, 31, 162, 0.1)',
                    }]}
                    layout={{
                        title: { text: 'Power Spectral Density' },
                        xaxis: { title: { text: 'Frequency (Hz)' }, gridcolor: '#e0e0e0' },
                        yaxis: { title: { text: 'Power' }, type: 'log', gridcolor: '#e0e0e0' },
                        height: 350,
                        margin: { l: 60, r: 30, t: 45, b: 50 },
                        plot_bgcolor: '#fafafa',
                        paper_bgcolor: '#fff',
                    }}
                    useResizeHandler style={{ width: '100%' }}
                    config={{ responsive: true, displaylogo: false }}
                />
            )}

            {/* ─── Dominant Frequencies Table ─── */}
            {result?.dominant_frequencies?.length > 0 && (
                <div className="params-table-wrap" style={{ marginTop: '1rem' }}>
                    <h4>Top {result.dominant_frequencies.length} Dominant Frequencies</h4>
                    <table className="params-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Frequency (Hz)</th>
                                <th>Period (s)</th>
                                <th>Amplitude</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.dominant_frequencies.map((d: DominantFreq, i: number) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: 700 }}>{i + 1}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{smartFormat(d.frequency, 5)}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{smartFormat(d.period, 4)}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{smartFormat(d.amplitude, 4)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                        Frequency resolution: {smartFormat(result.freq_resolution, 3)} Hz | Nyquist: {smartFormat(result.nyquist_freq, 4)} Hz
                    </p>
                </div>
            )}

            {/* ─── Inverse DFT / Filtering ─── */}
            {result && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f9f9f9', borderRadius: '10px', border: '1px solid #e0e0e0' }}>
                    <h4 style={{ margin: '0 0 1rem 0' }}>🔄 Inverse DFT & Frequency Filtering</h4>
                    <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                        Reconstruct the signal from the DFT. Optionally apply a frequency filter to remove noise or isolate specific components.
                    </p>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'end', marginBottom: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label>Filter type</label>
                            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                                <option value="none">No filter (full reconstruction)</option>
                                <option value="lowpass">Low-pass (keep below cutoff)</option>
                                <option value="highpass">High-pass (keep above cutoff)</option>
                                <option value="bandpass">Band-pass (keep between cutoffs)</option>
                            </select>
                        </div>

                        {(filterType === 'highpass' || filterType === 'bandpass') && (
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Low cutoff (Hz)</label>
                                <input type="number" step="any" value={cutoffLow} onChange={e => setCutoffLow(parseFloat(e.target.value) || 0)} style={{ width: '110px' }} />
                            </div>
                        )}

                        {(filterType === 'lowpass' || filterType === 'bandpass') && (
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>High cutoff (Hz)</label>
                                <input type="number" step="any" value={cutoffHigh} onChange={e => setCutoffHigh(parseFloat(e.target.value) || 100)} style={{ width: '110px' }} />
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={filterType === 'none' ? handleReconstructFull : handleFilter} disabled={filterLoading} className="btn-primary">
                            {filterLoading ? '⏳ Computing…' : filterType === 'none' ? '🔄 Reconstruct Signal' : `🔧 Apply ${filterType} Filter`}
                        </button>
                    </div>

                    {reconstructed && (
                        <p style={{ marginTop: '0.75rem', color: '#388e3c', fontWeight: 600 }}>
                            ✅ Reconstructed! See the red dashed curve overlaid on the signal plot above.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

export default FourierAnalysis;
