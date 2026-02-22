import { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import * as api from '../services/api';
import { useAnalysis } from '../context/AnalysisContext';

function GraphFitting() {
    const [xData, setXData] = useState<string>('1, 2, 3, 4, 5');
    const [yData, setYData] = useState<string>('2.1, 3.9, 6.2, 7.8, 10.1');
    const [yErrors, setYErrors] = useState<string>('');
    const [xErrors, setXErrors] = useState<string>(''); // New X-Error state
    const [model, setModel] = useState<string>('linear');
    const [customExpr, setCustomExpr] = useState<string>('a*x + b');
    const [initialGuess, setInitialGuess] = useState<string>('');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    // AI Context
    const { setLastResult, setCurrentTool, setCurrentData, addToHistory } = useAnalysis();

    useEffect(() => {
        setCurrentTool('Curve Fitting');
    }, []);

    const handleFit = async () => {
        setError('');
        setResult(null);
        setLoading(true);

        try {
            // Parse data
            const x = xData.split(/[,\s]+/).map(parseFloat).filter(n => !isNaN(n));
            const y = yData.split(/[,\s]+/).map(parseFloat).filter(n => !isNaN(n));
            const yErr = yErrors ? yErrors.split(/[,\s]+/).map(parseFloat).filter(n => !isNaN(n)) : undefined;
            const xErr = xErrors ? xErrors.split(/[,\s]+/).map(parseFloat).filter(n => !isNaN(n)) : undefined;
            const guess = initialGuess ? initialGuess.split(/[,\s]+/).map(parseFloat).filter(n => !isNaN(n)) : undefined;

            if (x.length !== y.length) {
                throw new Error(`Data mismatch: X has ${x.length} points, Y has ${y.length} points.`);
            }

            if (x.length < 2) {
                throw new Error('Need at least 2 data points');
            }

            if (xErr && xErr.length !== x.length) {
                throw new Error(`X-Errors length (${xErr.length}) must match data length (${x.length})`);
            }

            setCurrentData({ x, y, yErr, xErr });

            const response = await api.fitData({
                x_data: x,
                y_data: y,
                y_errors: yErr && yErr.length === y.length ? yErr : undefined,
                model,
                custom_expr: model === 'custom' ? customExpr : undefined,
                initial_guess: guess
            });

            // Augment response
            const resultWithXErr = { ...response, x_errors: xErr };
            setResult(resultWithXErr);
            setLastResult(resultWithXErr);
            addToHistory(`Fitted ${model} model`);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Fitting failed');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError('');
        setLoading(true);
        try {
            const data = await api.parseFile(file);
            setXData(data.x_data.join(', '));
            setYData(data.y_data.join(', '));
            if (data.y_errors) {
                setYErrors(data.y_errors.join(', '));
            } else {
                setYErrors('');
            }
            // Reset X Errors on new load
            setXErrors('');
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to parse file');
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    return (
        <div className="card">
            <h2>Graph & Curve Fitting</h2>

            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px', border: '1px dashed #ccc' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Import Data from Excel/CSV</label>
                <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    disabled={loading}
                />
                <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                    Format: 1st column = X, 2nd column = Y, 3rd column = Y Errors (optional)
                </p>
            </div>

            <div className="grid grid-2">
                <div className="form-group">
                    <label>X Data (comma separated)</label>
                    <textarea
                        value={xData}
                        onChange={(e) => setXData(e.target.value)}
                        rows={3}
                        placeholder="1, 2, 3, 4, 5"
                    />
                </div>
                <div className="form-group">
                    <label>Y Data (comma separated)</label>
                    <textarea
                        value={yData}
                        onChange={(e) => setYData(e.target.value)}
                        rows={3}
                        placeholder="2.1, 4.0, 6.2, 8.1, 10.1"
                    />
                </div>
            </div>

            <div className="grid grid-2">
                <div className="form-group">
                    <label>X Errors (optional)</label>
                    <textarea
                        value={xErrors}
                        onChange={(e) => setXErrors(e.target.value)}
                        rows={2}
                        placeholder="e.g. 0.1, 0.1, 0.2..."
                    />
                </div>
                <div className="form-group">
                    <label>Y Errors (optional)</label>
                    <textarea
                        value={yErrors}
                        onChange={(e) => setYErrors(e.target.value)}
                        rows={2}
                        placeholder="e.g. 0.1, 0.2, 0.1..."
                    />
                </div>
            </div>

            <div className="grid grid-2">
                <div className="form-group">
                    <label>Model</label>
                    <select value={model} onChange={(e) => setModel(e.target.value)}>
                        <option value="linear">Linear (y = mx + c)</option>
                        <option value="quadratic">Quadratic (y = ax^2 + bx + c)</option>
                        <option value="cubic">Cubic (y = ax^3 + ...)</option>
                        <option value="power">Power Law (y = a*x^b)</option>
                        <option value="exponential">Exponential (y = a*e^(bx))</option>
                        <option value="custom">Custom Expression</option>
                    </select>
                </div>

                {model === 'custom' && (
                    <div className="form-group">
                        <label>Custom Expression (use 'x' as variable)</label>
                        <input
                            type="text"
                            value={customExpr}
                            onChange={(e) => setCustomExpr(e.target.value)}
                            placeholder="a * sin(b * x) + c"
                        />
                    </div>
                )}
            </div>

            {model === 'custom' && (
                <div className="form-group">
                    <label>Initial Guess (comma separated params)</label>
                    <input
                        type="text"
                        value={initialGuess}
                        onChange={(e) => setInitialGuess(e.target.value)}
                        placeholder="1.0, 1.0, 0.0"
                    />
                </div>
            )}

            <button onClick={handleFit} disabled={loading}>
                {loading ? 'Fitting...' : 'Fit Data'}
            </button>

            {error && <div className="error-message">{error}</div>}

            {result && (
                <div className="result-section" style={{ marginTop: '2rem' }}>
                    <div className="result-box success">
                        <h3>Fit Results</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1rem', marginTop: '1rem' }}>
                            <div style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
                                <strong>Model:</strong> {result.model_name}
                            </div>
                            {result.parameter_names && result.parameters.map((val: number, idx: number) => (
                                <div key={idx}>
                                    <strong>{result.parameter_names[idx]}:</strong> {val.toFixed(4)} ± {result.uncertainties[idx]?.toFixed(4)}
                                </div>
                            ))}
                            <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem', borderTop: '1px solid #ddd', paddingTop: '0.5rem' }}>
                                <strong>Reduced Chi-Square:</strong> {result.chi_squared.toFixed(4)}
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <strong>R-Squared:</strong> {result.r_squared.toFixed(4)}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '1.5rem', border: '1px solid #eee', padding: '1rem', borderRadius: '8px' }}>
                        <Plot
                            data={[
                                {
                                    x: result.data ? result.data.x : xData.split(/[,\s]+/).map(parseFloat),
                                    y: result.data ? result.data.y : yData.split(/[,\s]+/).map(parseFloat),
                                    error_y: {
                                        type: 'data',
                                        array: result.data ? result.data.y_err : undefined,
                                        visible: true
                                    },
                                    error_x: {
                                        type: 'data',
                                        array: result.x_errors,
                                        visible: true
                                    },
                                    mode: 'markers',
                                    type: 'scatter',
                                    name: 'Data'
                                },
                                {
                                    x: result.x_fit,
                                    y: result.y_fit,
                                    mode: 'lines',
                                    type: 'scatter',
                                    name: 'Best Fit',
                                    line: { color: 'red' }
                                }
                            ]}
                            layout={{
                                title: { text: 'Curve Fitting Result' },
                                xaxis: { title: { text: 'X Data' } },
                                yaxis: { title: { text: 'Y Data' } },
                                autosize: true,
                                margin: { l: 50, r: 20, t: 50, b: 50 },
                                legend: { x: 0, y: 1 }
                            }}
                            useResizeHandler={true}
                            style={{ width: '100%', height: '500px' }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default GraphFitting;
