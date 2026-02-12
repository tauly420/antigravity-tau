import { useState } from 'react';
import * as api from '../services/api';

function FormulaCalculator() {
    const [expression, setExpression] = useState<string>('a*x**2 + b');
    const [isLatex, setIsLatex] = useState<boolean>(false);
    const [variables, setVariables] = useState<Record<string, string>>({ a: '1.5', x: '2', b: '3' });
    const [uncertainties, setUncertainties] = useState<Record<string, string>>({ a: '0.1', x: '0.05', b: '0.2' });
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const updateVariable = (name: string, value: string, type: 'value' | 'uncertainty') => {
        if (type === 'value') {
            setVariables({ ...variables, [name]: value });
        } else {
            setUncertainties({ ...uncertainties, [name]: value });
        }
    };

    const handleEvaluate = async () => {
        setError('');
        setResult(null);
        setLoading(true);

        try {
            // Convert variables to numbers
            const varObj: Record<string, number> = {};
            const uncObj: Record<string, number> = {};

            for (const [key, value] of Object.entries(variables)) {
                varObj[key] = parseFloat(value) || 0;
            }

            for (const [key, value] of Object.entries(uncertainties)) {
                uncObj[key] = parseFloat(value) || 0;
            }

            const response = await api.evaluateFormula({
                expression,
                is_latex: isLatex,
                variables: varObj,
                uncertainties: uncObj
            });

            setResult(response);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Evaluation failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <h2>Formula Calculator</h2>

            <div className="instructions">
                <p><strong>Instructions:</strong></p>
                <p>• Enter a mathematical expression using variables (e.g., <code>a*x**2 + b</code>)</p>
                <p>• Multiplication: <code>2*x</code>, Power: <code>x**2</code>, Division: <code>a/b</code></p>
                <p>• Functions: <code>sin(x), cos(x), exp(x), sqrt(x), log(x)</code></p>
                <p>• Constants: <code>pi, e</code></p>
                <p>• Enter values and uncertainties for each variable</p>
                <p>• Uncertainty propagation is automatic using partial derivatives</p>
            </div>

            <div className="form-group">
                <label>Expression</label>
                <input
                    type="text"
                    value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    placeholder="a*x**2 + b"
                />
            </div>

            <div className="form-group">
                <label>
                    <input
                        type="checkbox"
                        checked={isLatex}
                        onChange={(e) => setIsLatex(e.target.checked)}
                        style={{ width: 'auto', marginRight: '0.5rem' }}
                    />
                    Enable LaTeX input
                </label>
            </div>

            <h3>Variables</h3>
            <div className="grid grid-3">
                {Object.keys(variables).map(varName => (
                    <div key={varName} className="form-group">
                        <label>{varName}</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="number"
                                step="any"
                                value={variables[varName]}
                                onChange={(e) => updateVariable(varName, e.target.value, 'value')}
                                placeholder="Value"
                                style={{ flex: 1 }}
                            />
                            <input
                                type="number"
                                step="any"
                                value={uncertainties[varName] || ''}
                                onChange={(e) => updateVariable(varName, e.target.value, 'uncertainty')}
                                placeholder="±"
                                style={{ flex: 1 }}
                            />
                        </div>
                        <small style={{ color: '#666', fontSize: '0.85rem' }}>
                            Value ± Uncertainty
                        </small>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '1rem' }}>
                <small style={{ color: '#666' }}>
                    To add variables, simply use them in your expression (e.g., add <code>c</code> and it will appear here)
                </small>
            </div>

            <button onClick={handleEvaluate} disabled={loading} style={{ marginTop: '1.5rem' }}>
                {loading ? 'Evaluating...' : 'Evaluate'}
            </button>

            {error && <div className="error-message">{error}</div>}

            {result && !result.error && (
                <div className="result-box success" style={{ marginTop: '1.5rem' }}>
                    <h3>Result</h3>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '1rem 0' }}>
                        {result.formatted}
                    </p>
                    <p style={{ fontSize: '1rem', color: '#666' }}>
                        Value: {result.value.toExponential(6)}
                    </p>
                    <p style={{ fontSize: '1rem', color: '#666' }}>
                        Uncertainty: {result.uncertainty.toExponential(6)}
                    </p>
                </div>
            )}
        </div>
    );
}

export default FormulaCalculator;
