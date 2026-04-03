import { useState, useEffect } from 'react';
import * as api from '../services/api';
import { useAnalysis } from '../context/AnalysisContext';

function MatrixCalculator() {
    const [rowsA, setRowsA] = useState(2);
    const [colsA, setColsA] = useState(2);
    const [rowsB, setRowsB] = useState(2);
    const [colsB, setColsB] = useState(2);

    const [operation, setOperation] = useState('multiply');
    const [includeSteps, setIncludeSteps] = useState(false);

    const [matrixA, setMatrixA] = useState<number[][]>([[0, 0], [0, 0]]);
    const [matrixB, setMatrixB] = useState<number[][]>([[0, 0], [0, 0]]);
    const [vectorB, setVectorB] = useState<number[]>([0, 0]);

    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { setLastResult, setCurrentTool, addToHistory } = useAnalysis();

    useEffect(() => { setCurrentTool('Matrix + System of Equation Solver'); }, [setCurrentTool]);

    const resizeMatrix = (old: number[][], r: number, c: number) =>
        Array(r).fill(0).map((_, i) =>
            Array(c).fill(0).map((_, j) => (old[i]?.[j] ?? 0)),
        );

    useEffect(() => { setMatrixA(prev => resizeMatrix(prev, rowsA, colsA)); }, [rowsA, colsA]);
    useEffect(() => { setMatrixB(prev => resizeMatrix(prev, rowsB, colsB)); }, [rowsB, colsB]);
    useEffect(() => {
        setVectorB(prev => {
            const v = [...prev];
            return v.length < rowsA
                ? [...v, ...Array(rowsA - v.length).fill(0)]
                : v.slice(0, rowsA);
        });
    }, [rowsA]);

    const [editingCell, setEditingCell] = useState<{ which: string; r: number; c: number; raw: string } | null>(null);

    const updateCell = (which: 'A' | 'B' | 'vec', r: number, c: number, raw: string) => {
        setEditingCell({ which, r, c, raw });
        const v = parseFloat(raw);
        if (isNaN(v)) return;
        if (which === 'A') {
            const m = matrixA.map(row => [...row]);
            m[r][c] = v;
            setMatrixA(m);
        } else if (which === 'B') {
            const m = matrixB.map(row => [...row]);
            m[r][c] = v;
            setMatrixB(m);
        } else {
            const vec = [...vectorB];
            vec[r] = v;
            setVectorB(vec);
        }
    };

    const commitCell = (which: 'A' | 'B' | 'vec', r: number, c: number, raw: string) => {
        setEditingCell(null);
        const v = parseFloat(raw);
        const num = isNaN(v) ? 0 : v;
        if (which === 'A') {
            const m = matrixA.map(row => [...row]);
            m[r][c] = num;
            setMatrixA(m);
        } else if (which === 'B') {
            const m = matrixB.map(row => [...row]);
            m[r][c] = num;
            setMatrixB(m);
        } else {
            const vec = [...vectorB];
            vec[r] = num;
            setVectorB(vec);
        }
    };

    const getCellValue = (which: string, r: number, c: number, cell: number) => {
        if (editingCell && editingCell.which === which && editingCell.r === r && editingCell.c === c) {
            return editingCell.raw;
        }
        return String(cell);
    };

    const clearMatrix = (t: 'A' | 'B') => {
        if (t === 'A') setMatrixA(Array(rowsA).fill(0).map(() => Array(colsA).fill(0)));
        else setMatrixB(Array(rowsB).fill(0).map(() => Array(colsB).fill(0)));
    };

    const randomizeMatrix = (t: 'A' | 'B') => {
        const gen = (r: number, c: number) =>
            Array(r).fill(0).map(() => Array(c).fill(0).map(() => Math.floor(Math.random() * 10)));
        if (t === 'A') setMatrixA(gen(rowsA, colsA));
        else setMatrixB(gen(rowsB, colsB));
    };

    const setIdentity = (t: 'A' | 'B') => {
        const r = t === 'A' ? rowsA : rowsB;
        const c = t === 'A' ? colsA : colsB;
        if (r !== c) { setError(`Identity requires a square matrix (${r}×${c})`); return; }
        const I = Array(r).fill(0).map((_, i) => Array(c).fill(0).map((_, j) => i === j ? 1 : 0));
        if (t === 'A') setMatrixA(I); else setMatrixB(I);
        setError('');
    };

    const handleCalculate = async () => {
        setError(''); setResult(null); setLoading(true);
        try {
            if (['add', 'subtract'].includes(operation) && (rowsA !== rowsB || colsA !== colsB))
                throw new Error('Matrices must have the same dimensions');
            if (operation === 'multiply' && colsA !== rowsB)
                throw new Error(`A columns (${colsA}) must equal B rows (${rowsB})`);
            if (['determinant', 'inverse', 'lu', 'eigenvalues'].includes(operation) && rowsA !== colsA)
                throw new Error('Matrix must be square for this operation');

            let response;
            if (operation === 'solve_system') {
                response = await api.solveSystem({ matrix_a: matrixA, vector_b: vectorB, include_steps: includeSteps });
                setResult({ type: 'solution', data: response.solution, steps: response.steps });
            } else if (operation === 'determinant') {
                response = await api.calculateDeterminant({ matrix: matrixA });
                setResult({ type: 'determinant', data: response.determinant });
            } else if (operation === 'lu') {
                response = await api.luDecomposition({ matrix: matrixA, include_steps: includeSteps });
                setResult({ type: 'lu', data: response });
            } else if (operation === 'eigenvalues') {
                response = await api.findEigenvalues({ matrix: matrixA, include_steps: includeSteps });
                setResult({ type: 'eigenvalues', data: response });
            } else if (operation === 'svd') {
                response = await api.svdDecomposition({ matrix: matrixA, include_steps: includeSteps });
                setResult({ type: 'svd', data: response });
            } else {
                response = await api.matrixOperations({
                    operation,
                    matrix_a: matrixA,
                    matrix_b: !['transpose', 'inverse'].includes(operation) ? matrixB : undefined,
                });
                setResult({ type: 'matrix', data: response.result });
            }
            setLastResult(response);
            addToHistory(`Matrix ${operation}`);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Calculation failed');
        } finally { setLoading(false); }
    };

    const needsB = ['add', 'subtract', 'multiply'].includes(operation);
    const canShowSteps = ['solve_system', 'lu', 'eigenvalues', 'svd'].includes(operation);

    const renderMatrix = (
        matrix: number[][],
        which: 'A' | 'B',
        rows: number,
        cols: number,
        setRows: (n: number) => void,
        setCols: (n: number) => void,
    ) => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3>Matrix {which}</h3>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <select value={rows} onChange={e => setRows(+e.target.value)} style={{ padding: '0.3rem', fontSize: '0.85rem' }}>
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span style={{ fontWeight: 700 }}>×</span>
                    <select value={cols} onChange={e => setCols(+e.target.value)} style={{ padding: '0.3rem', fontSize: '0.85rem' }}>
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <button className="small-btn" onClick={() => clearMatrix(which)}>Clear</button>
                <button className="small-btn" onClick={() => randomizeMatrix(which)}>Random</button>
                <button className="small-btn" onClick={() => setIdentity(which)}>Identity</button>
            </div>

            <div className="matrix-wrapper">
                <div className="matrix-bracket left" />
                <div className="matrix-grid" style={{ gridTemplateColumns: `repeat(${cols}, 60px)` }}>
                    {matrix.map((row, i) =>
                        row.map((cell, j) => (
                            <input
                                key={`${which}-${i}-${j}`}
                                type="text"
                                inputMode="decimal"
                                value={getCellValue(which, i, j, cell)}
                                onChange={e => updateCell(which, i, j, e.target.value)}
                                onBlur={e => commitCell(which, i, j, e.target.value)}
                                onFocus={() => setEditingCell({ which, r: i, c: j, raw: String(cell) })}
                            />
                        )),
                    )}
                </div>
                <div className="matrix-bracket right" />
            </div>
        </div>
    );

    const renderVector = () => (
        <div>
            <h3>Vector b</h3>
            <div className="matrix-wrapper" style={{ marginTop: '0.5rem' }}>
                <div className="matrix-bracket left" />
                <div className="matrix-grid" style={{ gridTemplateColumns: '60px' }}>
                    {vectorB.map((cell, i) => (
                        <input
                            key={`vec-${i}`}
                            type="text"
                            inputMode="decimal"
                            value={getCellValue('vec', i, 0, cell)}
                            onChange={e => updateCell('vec', i, 0, e.target.value)}
                            onBlur={e => commitCell('vec', i, 0, e.target.value)}
                            onFocus={() => setEditingCell({ which: 'vec', r: i, c: 0, raw: String(cell) })}
                        />
                    ))}
                </div>
                <div className="matrix-bracket right" />
            </div>
        </div>
    );

    const renderResultMatrix = (data: number[][]) => (
        <div className="matrix-wrapper" style={{ margin: '1rem auto' }}>
            <div className="matrix-bracket left" style={{ borderColor: '#2e7d32' }} />
            <div className="matrix-grid" style={{ gridTemplateColumns: `repeat(${data[0].length}, 60px)` }}>
                {data.flat().map((cell, idx) => (
                    <div key={idx} className="result-matrix-cell">
                        {cell.toFixed(4)}
                    </div>
                ))}
            </div>
            <div className="matrix-bracket right" style={{ borderColor: '#2e7d32' }} />
        </div>
    );

    const renderSteps = (steps: any) => {
        if (!steps) return null;

        return (
            <div style={{ marginTop: '1rem', borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
                <h4>Step-by-step explanation</h4>

                {Array.isArray(steps.summary) && (
                    <ol>
                        {steps.summary.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ol>
                )}

                {steps.forward_elimination?.steps?.length > 0 && (
                    <div>
                        <strong>Gaussian elimination</strong>
                        <ul>
                            {steps.forward_elimination.steps.map((s: any, i: number) => <li key={i}>{s.step}</li>)}
                        </ul>
                    </div>
                )}

                {steps.backward_substitution?.length > 0 && (
                    <div>
                        <strong>Backward substitution</strong>
                        <ul>
                            {steps.backward_substitution.map((s: any, i: number) => (
                                <li key={i}>{s.variable}: {s.equation} = {s.value}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {Array.isArray(steps.description) && (
                    <div>
                        <strong>LU steps</strong>
                        <ol>
                            {steps.description.map((s: string, i: number) => <li key={i}>{s}</li>)}
                        </ol>
                    </div>
                )}

                {steps.invariants && (
                    <p>
                        Invariants &mdash; tr(A): <strong>{steps.invariants.trace_A}</strong>, det(A): <strong>{steps.invariants.determinant_A}</strong>.
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="card">
            <h2>Matrix + System of Equation Solver</h2>
            <p style={{ color: 'var(--text-secondary, #666)', fontSize: '0.95rem', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
                Perform matrix operations, solve Ax=b with optional Gaussian-elimination steps, compute LU/eigen decomposition, or run SVD.
            </p>

            <div className="form-group">
                <label>Operation</label>
                <select value={operation} onChange={e => setOperation(e.target.value)} style={{ padding: '0.5rem', fontSize: '1rem' }}>
                    <option value="add">Add (A + B)</option>
                    <option value="subtract">Subtract (A − B)</option>
                    <option value="multiply">Multiply (A × B)</option>
                    <option value="transpose">Transpose (Aᵀ)</option>
                    <option value="inverse">Inverse (A⁻¹)</option>
                    <option value="determinant">Determinant (det A)</option>
                    <option value="solve_system">Solve System (Ax = b)</option>
                    <option value="lu">LU Decomposition</option>
                    <option value="eigenvalues">Eigenvalues / Eigenvectors</option>
                    <option value="svd">SVD Decomposition (A = UΣVᵀ)</option>
                </select>
            </div>

            {canShowSteps && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input type="checkbox" checked={includeSteps} onChange={e => setIncludeSteps(e.target.checked)} />
                    Include step-by-step explanation
                </label>
            )}

            <div className="grid grid-2" style={{ gap: '2rem', alignItems: 'start' }}>
                {renderMatrix(matrixA, 'A', rowsA, colsA, setRowsA, setColsA)}

                {needsB && renderMatrix(matrixB, 'B', rowsB, colsB, setRowsB, setColsB)}
                {operation === 'solve_system' && renderVector()}
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <button onClick={handleCalculate} disabled={loading} className="primary-btn">
                    {loading ? 'Calculating…' : 'Calculate'}
                </button>
            </div>

            {error && <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>}

            {result && (
                <div className="result-box success" style={{ marginTop: '1.5rem' }}>
                    <h3>Result</h3>

                    {result.type === 'matrix' && renderResultMatrix(result.data)}

                    {result.type === 'determinant' && (
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center' }}>
                            det = {result.data.toFixed(6)}
                        </p>
                    )}

                    {result.type === 'solution' && (
                        <div style={{ textAlign: 'center' }}>
                            {result.data.map((val: number, i: number) => (
                                <div key={i}>x<sub>{i + 1}</sub> = <strong>{val.toFixed(4)}</strong></div>
                            ))}
                            {renderSteps(result.steps)}
                        </div>
                    )}

                    {result.type === 'eigenvalues' && (
                        <div>
                            <p><strong>Eigenvalues:</strong></p>
                            <p style={{ fontFamily: 'monospace' }}>
                                {result.data.eigenvalues.map((val: any, i: number) => `λ${i + 1} = ${val}`).join(', ')}
                            </p>
                            {renderSteps(result.data.steps)}
                        </div>
                    )}

                    {result.type === 'lu' && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                {['L', 'U', 'P'].map(name => (
                                    <div key={name}>
                                        <strong>{name}</strong>
                                        {result.data[name] && renderResultMatrix(result.data[name])}
                                    </div>
                                ))}
                            </div>
                            {renderSteps(result.data.steps)}
                        </div>
                    )}

                    {result.type === 'svd' && (
                        <div>
                            <p><strong>Singular values:</strong> {result.data.singular_values.map((v: number) => v.toFixed(4)).join(', ')}</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <strong>U</strong>
                                    {renderResultMatrix(result.data.U)}
                                </div>
                                <div>
                                    <strong>Vᵀ</strong>
                                    {renderResultMatrix(result.data.Vt)}
                                </div>
                            </div>
                            {renderSteps(result.data.steps)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default MatrixCalculator;
