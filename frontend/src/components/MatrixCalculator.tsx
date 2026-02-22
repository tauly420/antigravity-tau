import { useState, useEffect } from 'react';
import * as api from '../services/api';
import { useAnalysis } from '../context/AnalysisContext';

function MatrixCalculator() {
    const [rowsA, setRowsA] = useState(2);
    const [colsA, setColsA] = useState(2);
    const [rowsB, setRowsB] = useState(2);
    const [colsB, setColsB] = useState(2);

    const [operation, setOperation] = useState('multiply');

    const [matrixA, setMatrixA] = useState<number[][]>([[1, 2], [3, 4]]);
    const [matrixB, setMatrixB] = useState<number[][]>([[5, 6], [7, 8]]);
    const [vectorB, setVectorB] = useState<number[]>([5, 6]);

    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { setLastResult, setCurrentTool, addToHistory } = useAnalysis();

    useEffect(() => { setCurrentTool('Matrix Calculator'); }, []);

    // ── Resize helpers ──────────────────────────────
    const resizeMatrix = (old: number[][], r: number, c: number) =>
        Array(r).fill(0).map((_, i) =>
            Array(c).fill(0).map((_, j) => (old[i]?.[j] ?? 0))
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

    // ── Cell update ─────────────────────────────────
    const updateCell = (which: 'A' | 'B' | 'vec', r: number, c: number, raw: string) => {
        const v = parseFloat(raw) || 0;
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

    // ── Utility buttons ─────────────────────────────
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



    // ── Calculate ───────────────────────────────────
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
                response = await api.solveSystem({ matrix_a: matrixA, vector_b: vectorB });
                setResult({ type: 'solution', data: response.solution });
            } else if (operation === 'determinant') {
                response = await api.calculateDeterminant({ matrix: matrixA });
                setResult({ type: 'determinant', data: response.determinant });
            } else if (operation === 'lu') {
                response = await api.luDecomposition({ matrix: matrixA });
                setResult({ type: 'lu', data: response });
            } else if (operation === 'eigenvalues') {
                response = await api.findEigenvalues({ matrix: matrixA });
                setResult({ type: 'eigenvalues', data: response });
            } else {
                response = await api.matrixOperations({
                    operation,
                    matrix_a: matrixA,
                    matrix_b: !['transpose', 'inverse'].includes(operation) ? matrixB : undefined
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

    // ── Matrix grid renderer with brackets ──────────
    const renderMatrix = (
        matrix: number[][],
        which: 'A' | 'B',
        rows: number,
        cols: number,
        setRows: (n: number) => void,
        setCols: (n: number) => void
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

            {/* Bracketed matrix grid */}
            <div className="matrix-wrapper">
                <div className="matrix-bracket left" />
                <div className="matrix-grid" style={{ gridTemplateColumns: `repeat(${cols}, 60px)` }}>
                    {matrix.map((row, i) =>
                        row.map((cell, j) => (
                            <input
                                key={`${which}-${i}-${j}`}
                                type="number"
                                value={cell}
                                onChange={e => updateCell(which, i, j, e.target.value)}
                            />
                        ))
                    )}
                </div>
                <div className="matrix-bracket right" />
            </div>
        </div>
    );

    // ── Vector renderer with brackets ───────────────
    const renderVector = () => (
        <div>
            <h3>Vector b</h3>
            <div className="matrix-wrapper" style={{ marginTop: '0.5rem' }}>
                <div className="matrix-bracket left" />
                <div className="matrix-grid" style={{ gridTemplateColumns: '60px' }}>
                    {vectorB.map((cell, i) => (
                        <input
                            key={`vec-${i}`}
                            type="number"
                            value={cell}
                            onChange={e => updateCell('vec', i, 0, e.target.value)}
                        />
                    ))}
                </div>
                <div className="matrix-bracket right" />
            </div>
        </div>
    );

    // ── Result matrix renderer ──────────────────────
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

    return (
        <div className="card">
            <h2>Matrix Calculator</h2>

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
                </select>
            </div>

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
                        </div>
                    )}

                    {result.type === 'eigenvalues' && (
                        <div>
                            <p><strong>Eigenvalues:</strong></p>
                            <p style={{ fontFamily: 'monospace' }}>
                                {result.data.eigenvalues.map((val: number, i: number) => `λ${i + 1} = ${val.toFixed(4)}`).join(', ')}
                            </p>
                        </div>
                    )}

                    {result.type === 'lu' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                            {['L', 'U', 'P'].map(name => (
                                <div key={name}>
                                    <strong>{name}</strong>
                                    {result.data[name] && renderResultMatrix(result.data[name])}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default MatrixCalculator;
