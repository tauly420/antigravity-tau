import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../services/api';
import { useAnalysis } from '../context/AnalysisContext';

// Known math functions/constants that should NOT be treated as variables
// Case-sensitive! E = Euler's number, but e = regular variable
const RESERVED = new Set([
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
    'Sin', 'Cos', 'Tan',
    'exp', 'log', 'ln', 'sqrt', 'abs', 'Abs', 'ceil', 'floor',
    'pi', 'E', 'inf', 'Inf',
    'sinh', 'cosh', 'tanh',
    'max', 'min', 'pow',
]);

// Also reserve lowercase versions of functions (case-insensitive function matching)
const RESERVED_LOWER = new Set(Array.from(RESERVED).map(s => s.toLowerCase()));

function extractVariables(expr: string): string[] {
    if (!expr.trim()) return [];
    const tokens = expr.match(/[A-Za-z_]\w*/g) || [];
    const vars = new Set<string>();
    for (const t of tokens) {
        // Case-sensitive check for E (Euler's number) — 'e' is allowed as variable
        if (t === 'E') continue;
        // Case-insensitive check for functions like sin, cos, exp, etc.
        if (RESERVED_LOWER.has(t.toLowerCase())) continue;
        vars.add(t);
    }
    return Array.from(vars).sort();
}

interface FormulaCalculatorProps {
    prefilled?: Record<string, { value: number; uncertainty: number }>;
    onResult?: (value: number, uncertainty: number) => void;
    embedded?: boolean;
}

function FormulaCalculator({ prefilled, onResult, embedded }: FormulaCalculatorProps) {
    const [expression, setExpression] = useState('');
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [uncertainties, setUncertainties] = useState<Record<string, string>>({});
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Keep a ref to prefilled so the callback can always see it
    const prefilledRef = useRef(prefilled);
    prefilledRef.current = prefilled;

    const { setLastResult, setCurrentTool, addToHistory } = useAnalysis();

    useEffect(() => {
        if (!embedded) setCurrentTool('Formula Calculator');
    }, []);

    // When expression changes, detect variables but KEEP prefilled values
    const onExpressionChange = useCallback((expr: string) => {
        setExpression(expr);
        const detected = extractVariables(expr);
        const pf = prefilledRef.current || {};

        setVariables(prev => {
            const next: Record<string, string> = {};
            for (const v of detected) {
                // Priority: existing user input > prefilled > empty
                if (prev[v] !== undefined && prev[v] !== '') {
                    next[v] = prev[v];
                } else if (pf[v]) {
                    next[v] = String(pf[v].value);
                } else {
                    next[v] = '';
                }
            }
            return next;
        });

        setUncertainties(prev => {
            const next: Record<string, string> = {};
            for (const v of detected) {
                if (prev[v] !== undefined && prev[v] !== '') {
                    next[v] = prev[v];
                } else if (pf[v]) {
                    next[v] = String(pf[v].uncertainty);
                } else {
                    next[v] = '';
                }
            }
            return next;
        });
    }, []);

    // Initialize prefilled values on mount/update
    useEffect(() => {
        if (prefilled) {
            setVariables(prev => {
                const next = { ...prev };
                for (const [name, data] of Object.entries(prefilled)) {
                    next[name] = String(data.value);
                }
                return next;
            });
            setUncertainties(prev => {
                const next = { ...prev };
                for (const [name, data] of Object.entries(prefilled)) {
                    next[name] = String(data.uncertainty);
                }
                return next;
            });
        }
    }, [prefilled]);

    const handleEvaluate = async () => {
        setError('');
        setResult(null);
        setLoading(true);
        try {
            const varObj: Record<string, number> = {};
            const uncObj: Record<string, number> = {};
            for (const [key, value] of Object.entries(variables)) {
                const v = parseFloat(value);
                if (isNaN(v)) throw new Error(`Variable "${key}" has no value`);
                varObj[key] = v;
            }
            for (const [key, value] of Object.entries(uncertainties)) {
                uncObj[key] = parseFloat(value) || 0;
            }

            const response = await api.evaluateFormula({
                expression,
                is_latex: false,
                variables: varObj,
                uncertainties: uncObj
            });

            setResult(response);
            setLastResult(response);
            addToHistory(`Formula: ${expression}`);

            if (onResult && response.value !== undefined) {
                onResult(response.value, response.uncertainty);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Evaluation failed');
        } finally {
            setLoading(false);
        }
    };

    const varNames = Object.keys(variables);
    const prefilledNames = prefilled ? Object.keys(prefilled) : [];

    return (
        <div className={embedded ? '' : 'card'}>
            {!embedded && <h2>Formula Calculator</h2>}

            <div className="instructions">
                <p><strong>Enter any expression</strong> — variables are detected automatically.</p>
                <p>• Operators: <code>+</code> <code>-</code> <code>*</code> <code>/</code> <code>**</code> (power)</p>
                <p>• Functions: <code>sin(x)</code> <code>cos(x)</code> <code>exp(x)</code> <code>sqrt(x)</code> <code>log(x)</code></p>
                <p>• Constants: <code>pi</code> = π ≈ 3.14159,  <code>E</code> = e ≈ 2.71828 (Euler's number, <strong>capital E</strong>)</p>
                <p>• Note: lowercase <code>e</code> is treated as a <strong>regular variable</strong>, not Euler's number</p>
                <p>• Uncertainty propagation: s_f = √( Σ (∂f/∂xᵢ)² · σᵢ² )</p>
                {prefilledNames.length > 0 && (
                    <p>• <strong style={{ color: 'var(--success)' }}>Available from fit:</strong> {prefilledNames.map(n => <code key={n}>{n}</code>).reduce((a: any, b: any) => [a, ', ', b] as any)}</p>
                )}
            </div>

            <div className="form-group">
                <label>Expression</label>
                <input
                    type="text"
                    value={expression}
                    onChange={(e) => onExpressionChange(e.target.value)}
                    placeholder={prefilledNames.length > 0
                        ? `e.g. ${prefilledNames.join('*')} or ${prefilledNames[0]}**2`
                        : 'e.g.  a*x**2 + b   or   sqrt(X**2 + Y**2)'}
                    style={{ fontFamily: 'monospace', fontSize: '1.05rem' }}
                />
            </div>

            {varNames.length > 0 && (
                <>
                    <h3>Variables ({varNames.length} detected)</h3>
                    <div className="grid grid-3">
                        {varNames.map(name => {
                            const isPrefilled = prefilledNames.includes(name);
                            return (
                                <div key={name} className="form-group" style={{
                                    background: isPrefilled ? '#e8f5e9' : '#fafafa',
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    border: isPrefilled ? '1.5px solid #a5d6a7' : '1px solid #eee',
                                }}>
                                    <label style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: isPrefilled ? 'var(--success)' : 'var(--primary)' }}>
                                        {name} {isPrefilled && <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>(from fit)</span>}
                                    </label>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                        <input
                                            type="number"
                                            step="any"
                                            value={variables[name] || ''}
                                            onChange={(e) => setVariables(v => ({ ...v, [name]: e.target.value }))}
                                            placeholder="Value"
                                            style={{ flex: 1 }}
                                        />
                                        <input
                                            type="number"
                                            step="any"
                                            value={uncertainties[name] || ''}
                                            onChange={(e) => setUncertainties(u => ({ ...u, [name]: e.target.value }))}
                                            placeholder="± Unc."
                                            style={{ flex: 1 }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {varNames.length === 0 && expression.trim() && (
                <p style={{ color: '#999', fontStyle: 'italic', margin: '1rem 0' }}>
                    No variables detected. Type a variable name (e.g., <code>x</code>, <code>myVar</code>) in your expression.
                </p>
            )}

            <button onClick={handleEvaluate} disabled={loading || !expression.trim()} style={{ marginTop: '1.5rem' }}>
                {loading ? 'Evaluating...' : 'Evaluate'}
            </button>

            {error && <div className="error-message">{error}</div>}

            {result && !result.error && (
                <div className="result-box success" style={{ marginTop: '1.5rem' }}>
                    <h3>Result</h3>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '1rem 0', fontFamily: 'monospace' }}>
                        {result.formatted}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#666' }}>
                        Value: {result.value?.toExponential(6)}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#666' }}>
                        Uncertainty: {result.uncertainty?.toExponential(6)}
                    </p>
                </div>
            )}
        </div>
    );
}

export default FormulaCalculator;
