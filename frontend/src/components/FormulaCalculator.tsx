import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import { useAnalysis } from '../context/AnalysisContext';

// Known math functions/constants that should NOT be treated as variables
const RESERVED = new Set([
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
    'exp', 'log', 'ln', 'sqrt', 'abs', 'ceil', 'floor',
    'pi', 'e', 'inf',
    'sinh', 'cosh', 'tanh',
    'max', 'min', 'pow',
]);

/**
 * Extract variable names from a math expression.
 * Matches word tokens that aren't reserved functions/constants or pure numbers.
 */
function extractVariables(expr: string): string[] {
    if (!expr.trim()) return [];
    // Match word characters (identifiers like a, x, myVar, etc.)
    const tokens = expr.match(/[A-Za-z_]\w*/g) || [];
    const vars = new Set<string>();
    for (const t of tokens) {
        if (!RESERVED.has(t.toLowerCase())) {
            vars.add(t);
        }
    }
    return Array.from(vars).sort();
}

interface FormulaCalculatorProps {
    /** Pre-filled variables from workflow (e.g., fit parameters) */
    prefilled?: Record<string, { value: number; uncertainty: number }>;
    /** Callback when result is computed (for workflow linking) */
    onResult?: (value: number, uncertainty: number) => void;
    /** If true, render in compact mode for embedding in workflow */
    embedded?: boolean;
}

function FormulaCalculator({ prefilled, onResult, embedded }: FormulaCalculatorProps) {
    const [expression, setExpression] = useState('');
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [uncertainties, setUncertainties] = useState<Record<string, string>>({});
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { setLastResult, setCurrentTool, addToHistory } = useAnalysis();

    useEffect(() => {
        if (!embedded) setCurrentTool('Formula Calculator');
    }, []);

    // Pre-fill from workflow context
    useEffect(() => {
        if (prefilled) {
            const newVars: Record<string, string> = {};
            const newUnc: Record<string, string> = {};
            for (const [name, data] of Object.entries(prefilled)) {
                newVars[name] = String(data.value);
                newUnc[name] = String(data.uncertainty);
            }
            setVariables(prev => ({ ...prev, ...newVars }));
            setUncertainties(prev => ({ ...prev, ...newUnc }));
        }
    }, [prefilled]);

    // Auto-detect variables when expression changes
    const updateVariablesFromExpression = useCallback((expr: string) => {
        const detected = extractVariables(expr);
        setVariables(prev => {
            const next: Record<string, string> = {};
            for (const v of detected) {
                next[v] = prev[v] ?? '';
            }
            return next;
        });
        setUncertainties(prev => {
            const next: Record<string, string> = {};
            for (const v of detected) {
                next[v] = prev[v] ?? '';
            }
            return next;
        });
    }, []);

    useEffect(() => {
        updateVariablesFromExpression(expression);
    }, [expression, updateVariablesFromExpression]);

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

    return (
        <div className={embedded ? '' : 'card'}>
            {!embedded && <h2>Formula Calculator</h2>}

            <div className="instructions">
                <p><strong>Enter any expression</strong> — variables are detected automatically.</p>
                <p>• Operators: <code>+</code> <code>-</code> <code>*</code> <code>/</code> <code>**</code> (power)</p>
                <p>• Functions: <code>sin(x)</code> <code>cos(x)</code> <code>exp(x)</code> <code>sqrt(x)</code> <code>log(x)</code></p>
                <p>• Constants: <code>pi</code>, <code>e</code> — these are NOT treated as variables</p>
                <p>• Uncertainty propagation via partial derivatives is automatic.</p>
            </div>

            <div className="form-group">
                <label>Expression</label>
                <input
                    type="text"
                    value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    placeholder="e.g.  a*x**2 + b   or   sqrt(X**2 + Y**2)"
                    style={{ fontFamily: 'monospace', fontSize: '1.05rem' }}
                />
            </div>

            {varNames.length > 0 && (
                <>
                    <h3>Variables ({varNames.length} detected)</h3>
                    <div className="grid grid-3">
                        {varNames.map(name => (
                            <div key={name} className="form-group" style={{ background: '#fafafa', padding: '0.75rem', borderRadius: '8px', border: '1px solid #eee' }}>
                                <label style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: 'var(--primary)' }}>{name}</label>
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
                        ))}
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
