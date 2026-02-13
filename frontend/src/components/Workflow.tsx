import { useState } from 'react';
import Plot from 'react-plotly.js';
import * as api from '../services/api';
import { Link } from 'react-router-dom';

function Workflow() {
    const [step, setStep] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    // State: Data Upload
    const [rawData, setRawData] = useState<{ columns: string[], rows: any[] } | null>(null);

    // State: Selection
    const [xCol, setXCol] = useState<string>('');
    const [yCol, setYCol] = useState<string>('');
    const [yErrCol, setYErrCol] = useState<string>('');
    const [labels, setLabels] = useState({ x: '', y: '', title: '' });

    // State: Fitting
    const [model, setModel] = useState<string>('linear');
    const [fitResult, setFitResult] = useState<any>(null);

    // State: Formula
    const [formula, setFormula] = useState<string>('a * b');
    const [calcResult, setCalcResult] = useState<{ value: number, uncertainty: number } | null>(null);

    // State: N-Sigma
    const [theoreticalVal, setTheoreticalVal] = useState<string>('');
    const [theoreticalErr, setTheoreticalErr] = useState<string>('0');
    const [nSigmaResult, setNSigmaResult] = useState<any>(null);


    // Step 1: Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError('');
        try {
            const data = await api.parseFile(file);

            // Map parsed data to columns
            const rows = data.x_data.map((x: number, i: number) => ({
                col1: x,
                col2: data.y_data[i],
                col3: data.y_errors ? data.y_errors[i] : undefined
            }));

            setRawData({
                columns: ['col1', 'col2', 'col3'],
                rows
            });

            // Auto-select
            setXCol('col1');
            setYCol('col2');
            if (data.y_errors) setYErrCol('col3');

            setStep(2);
        } catch (err: any) {
            setError('Failed to parse file. Ensure it is a valid CSV/Excel with numeric data.');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Confirmation
    const confirmColumns = () => {
        setStep(3);
    };

    // Step 3: Fitting
    const runFit = async () => {
        if (!rawData) return;
        setLoading(true);
        try {
            const x = rawData.rows.map(r => r[xCol]);
            const y = rawData.rows.map(r => r[yCol]);
            const yErr = yErrCol ? rawData.rows.map(r => r[yErrCol]) : undefined;

            const res = await api.fitData({
                x_data: x,
                y_data: y,
                y_errors: yErr,
                model
            });
            setFitResult(res);
        } catch (err: any) {
            setError('Fit failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Step 4: Formula
    const calculateFormula = async () => {
        if (!fitResult) return;
        setLoading(true);
        try {
            // Map parameters to variables
            const variables: Record<string, number> = {};
            const uncertainties: Record<string, number> = {};

            fitResult.parameter_names.forEach((name: string, i: number) => {
                variables[name] = fitResult.parameters[i];
                uncertainties[name] = fitResult.uncertainties[i];
            });

            const res = await api.evaluateFormula({
                expression: formula,
                is_latex: false,
                variables,
                uncertainties
            });

            setCalcResult(res);
        } catch (err: any) {
            setError('Calculation failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Step 5: N-Sigma
    const runNSigma = async () => {
        if (!calcResult) return;
        setLoading(true);
        try {
            const res = await api.calculateNSigma({
                value1: calcResult.value,
                uncertainty1: calcResult.uncertainty,
                value2: parseFloat(theoreticalVal),
                uncertainty2: parseFloat(theoreticalErr) || 0
            });
            setNSigmaResult(res);
        } catch (err: any) {
            setError('N-Sigma failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>Guided Workflow</h2>
                <div style={{ background: '#e3f2fd', padding: '0.5rem 1rem', borderRadius: '20px', color: '#1565c0', fontWeight: 'bold' }}>
                    Step {step} of 5
                </div>
            </div>

            {/* Error Banner */}
            {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

            {/* STEP 1: UPLOAD */}
            {step === 1 && (
                <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed #ccc', borderRadius: '10px' }}>
                    <h3>📂 Upload Data</h3>
                    <p style={{ color: '#666', marginBottom: '1.5rem' }}>Start by uploading your experimental data (CSV or Excel)</p>
                    <input
                        type="file"
                        accept=".csv, .xlsx, .xls"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        id="workflow-upload"
                    />
                    <label htmlFor="workflow-upload" className="primary-btn" style={{ cursor: 'pointer', display: 'inline-block' }}>
                        {loading ? 'Parsing...' : 'Select File'}
                    </label>
                </div>
            )}

            {/* STEP 2: COLUMNS */}
            {step === 2 && rawData && (
                <div>
                    <h3>📊 Select Data Columns</h3>
                    <div className="grid grid-2">
                        <div className="form-group">
                            <label>X Axis Data</label>
                            <select value={xCol} onChange={e => setXCol(e.target.value)}>
                                {rawData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Y Axis Data</label>
                            <select value={yCol} onChange={e => setYCol(e.target.value)}>
                                {rawData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Y Uncertainty (Optional)</label>
                            <select value={yErrCol} onChange={e => setYErrCol(e.target.value)}>
                                <option value="">None</option>
                                {rawData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-2">
                        <div className="form-group">
                            <label>Plot Title</label>
                            <input value={labels.title} onChange={e => setLabels({ ...labels, title: e.target.value })} placeholder="Experiment Title" />
                        </div>
                        <div className="form-group">
                            <label>X Label</label>
                            <input value={labels.x} onChange={e => setLabels({ ...labels, x: e.target.value })} placeholder="Time (s)" />
                        </div>
                        <div className="form-group">
                            <label>Y Label</label>
                            <input value={labels.y} onChange={e => setLabels({ ...labels, y: e.target.value })} placeholder="Voltage (V)" />
                        </div>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={confirmColumns}>Next: Fit Data &rarr;</button>
                    </div>
                </div>
            )}

            {/* STEP 3: FITTING */}
            {step === 3 && (
                <div>
                    <h3>📈 Fit Curve</h3>
                    <div className="form-group">
                        <label>Choose Model</label>
                        <select value={model} onChange={e => setModel(e.target.value)}>
                            <option value="linear">Linear (ax + b)</option>
                            <option value="quadratic">Quadratic (ax² + bx + c)</option>
                            <option value="exponential">Exponential (ae^bx)</option>
                        </select>
                    </div>
                    <button onClick={runFit} disabled={loading}>{loading ? 'Fitting...' : 'Perform Fit'}</button>

                    {fitResult && (
                        <div style={{ marginTop: '1rem' }}>
                            <div className="result-box success">
                                <h4>Fit Parameters</h4>
                                {fitResult.parameter_names.map((p: string, i: number) => (
                                    <div key={p}>
                                        <strong>{p}</strong>: {fitResult.parameters[i].toFixed(4)} ± {fitResult.uncertainties[i].toFixed(4)}
                                    </div>
                                ))}
                                <div>R²: {fitResult.r_squared.toFixed(4)}</div>
                            </div>

                            <div style={{ marginTop: '1rem', border: '1px solid #ddd', padding: '1rem' }}>
                                <Plot
                                    data={[
                                        {
                                            x: rawData?.rows.map(r => r[xCol]),
                                            y: rawData?.rows.map(r => r[yCol]),
                                            mode: 'markers',
                                            type: 'scatter',
                                            name: 'Data',
                                            error_y: {
                                                type: 'data',
                                                array: yErrCol ? rawData?.rows.map(r => r[yErrCol]) : undefined,
                                                visible: true
                                            }
                                        },
                                        {
                                            x: fitResult.x_fit,
                                            y: fitResult.y_fit,
                                            mode: 'lines',
                                            name: 'Fit'
                                        }
                                    ]}
                                    layout={{
                                        width: undefined,
                                        height: 400,
                                        title: labels.title || 'Data Fit',
                                        xaxis: { title: labels.x },
                                        yaxis: { title: labels.y }
                                    }}
                                    useResizeHandler={true}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={() => setStep(4)}>Next: Calculate &rarr;</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* STEP 4: FORMULA */}
            {step === 4 && fitResult && (
                <div>
                    <h3>🧮 Use Fit Parameters</h3>
                    <p>Calculate a derived quantity using your fit parameters.</p>

                    <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                        <strong>Available Parameters:</strong><br />
                        {fitResult.parameter_names.map((p: string, i: number) => (
                            <span key={p} style={{ marginRight: '1rem', background: '#e3f2fd', padding: '2px 8px', borderRadius: '4px' }}>
                                {p} = {fitResult.parameters[i].toFixed(4)}
                            </span>
                        ))}
                    </div>

                    <div className="form-group">
                        <label>Formula (e.g., a * b / 2)</label>
                        <input value={formula} onChange={e => setFormula(e.target.value)} />
                    </div>

                    <button onClick={calculateFormula} disabled={loading}>{loading ? 'Calculating...' : 'Calculate'}</button>

                    {calcResult && (
                        <div style={{ marginTop: '1rem' }}>
                            <div className="result-box success">
                                <h3>Result: {calcResult.value.toFixed(4)} ± {calcResult.uncertainty.toFixed(4)}</h3>
                            </div>
                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={() => setStep(5)}>Next: N-Sigma &rarr;</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* STEP 5: N-SIGMA */}
            {step === 5 && calcResult && (
                <div>
                    <h3>📏 N-Sigma Consistency Check</h3>
                    <p>Compare your calculated value with a theoretical/accepted value.</p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div className="result-box">
                            <strong>Your Value</strong>
                            <div style={{ fontSize: '1.5rem' }}>{calcResult.value.toFixed(4)}</div>
                            <div>± {calcResult.uncertainty.toFixed(4)}</div>
                        </div>
                        <div className="form-group">
                            <label>Theoretical Value</label>
                            <input value={theoreticalVal} onChange={e => setTheoreticalVal(e.target.value)} placeholder="e.g. 9.81" />
                            <label style={{ marginTop: '0.5rem' }}>Theoretical Uncertainty</label>
                            <input value={theoreticalErr} onChange={e => setTheoreticalErr(e.target.value)} placeholder="0" />
                        </div>
                    </div>

                    <button onClick={runNSigma} disabled={loading}>Check Consistency</button>

                    {nSigmaResult && (
                        <div className="result-box" style={{
                            marginTop: '1.5rem',
                            background: nSigmaResult.nsigma < 1 ? '#e8f5e9' : nSigmaResult.nsigma < 3 ? '#fff3e0' : '#ffebee',
                            borderColor: nSigmaResult.nsigma < 1 ? '#4caf50' : nSigmaResult.nsigma < 3 ? '#ff9800' : '#f44336'
                        }}>
                            <h3>N-Sigma = {nSigmaResult.nsigma.toFixed(2)} σ</h3>
                            <p><strong>Verdict:</strong> {nSigmaResult.verdict}</p>
                            <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.5)', padding: '1rem', borderRadius: '8px' }}>
                                {nSigmaResult.interpretation}
                            </div>

                            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                                <Link to="/" className="primary-btn" style={{ textDecoration: 'none', background: '#333' }}>Finish Workflow</Link>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Workflow;
