import { useState, useEffect } from 'react';
import * as api from '../services/api';

interface NSigmaCalculatorProps {
    /** Pre-filled measurement 1 from workflow */
    prefilled1?: { value: number; uncertainty: number };
}

function NSigmaCalculator({ prefilled1 }: NSigmaCalculatorProps) {
    const [val1, setVal1] = useState<string>('');
    const [unc1, setUnc1] = useState<string>('');
    const [val2, setVal2] = useState<string>('');
    const [unc2, setUnc2] = useState<string>('');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        if (prefilled1) {
            setVal1(String(prefilled1.value));
            setUnc1(String(prefilled1.uncertainty));
        }
    }, [prefilled1]);

    const handleCalculate = async () => {
        setError('');
        setResult(null);
        setLoading(true);

        try {
            const v1 = parseFloat(val1);
            const u1 = parseFloat(unc1);
            const v2 = parseFloat(val2);
            const u2 = parseFloat(unc2);

            if (isNaN(v1) || isNaN(u1) || isNaN(v2) || isNaN(u2)) {
                throw new Error('Please enter valid numbers for all fields');
            }

            if (u1 < 0 || u2 < 0) {
                throw new Error('Uncertainties must be non-negative');
            }

            const response = await api.calculateNSigma({
                value1: v1,
                uncertainty1: u1,
                value2: v2,
                uncertainty2: u2
            });

            setResult(response);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Calculation failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <h2>N-Sigma Calculator</h2>

            <div className="instructions">
                <p><strong>Instructions:</strong></p>
                <p>• Compare two measurements to check if they agree within experimental uncertainty.</p>
                <p>• Enter the value and uncertainty (error) for each measurement.</p>
                <p>• Result indicates the statistical significance of their difference (N-σ).</p>
            </div>

            <div className="grid grid-2">
                <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
                    <h3>Measurement 1 {prefilled1 ? '(from formula)' : ''}</h3>
                    <div className="form-group">
                        <label>Value</label>
                        <input
                            type="number"
                            step="any"
                            value={val1}
                            onChange={(e) => setVal1(e.target.value)}
                            placeholder="e.g. 9.81"
                        />
                    </div>
                    <div className="form-group">
                        <label>Uncertainty (±)</label>
                        <input
                            type="number"
                            step="any"
                            value={unc1}
                            onChange={(e) => setUnc1(e.target.value)}
                            placeholder="e.g. 0.05"
                        />
                    </div>
                </div>

                <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
                    <h3>Measurement 2</h3>
                    <div className="form-group">
                        <label>Value</label>
                        <input
                            type="number"
                            step="any"
                            value={val2}
                            onChange={(e) => setVal2(e.target.value)}
                            placeholder="e.g. 9.79"
                        />
                    </div>
                    <div className="form-group">
                        <label>Uncertainty (±)</label>
                        <input
                            type="number"
                            step="any"
                            value={unc2}
                            onChange={(e) => setUnc2(e.target.value)}
                            placeholder="e.g. 0.04"
                        />
                    </div>
                </div>
            </div>

            <button onClick={handleCalculate} disabled={loading} style={{ marginTop: '1.5rem', width: '100%' }}>
                {loading ? 'Calculating...' : 'Calculate N-σ'}
            </button>

            {error && <div className="error-message">{error}</div>}

            {result && (
                <div className={`result-box ${result.verdict === 'Agreement' ? 'success' : 'warning'}`} style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: result.verdict === 'Agreement' ? 'var(--success)' : 'var(--warning)' }}>
                        {result.n_sigma.toFixed(2)}σ
                    </h3>
                    <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Verdict: {result.verdict}</p>
                    <p style={{ marginTop: '0.5rem', color: '#666' }}>{result.message}</p>
                </div>
            )}
        </div>
    );
}

export default NSigmaCalculator;
