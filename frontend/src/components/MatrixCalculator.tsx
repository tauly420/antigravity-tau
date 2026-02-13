import { useState, useEffect } from 'react';
import * as api from '../services/api';

function MatrixCalculator() {
    const [rowsA, setRowsA] = useState<number>(2);
    const [colsA, setColsA] = useState<number>(2);
    const [rowsB, setRowsB] = useState<number>(2);
    const [colsB, setColsB] = useState<number>(2);

    const [operation, setOperation] = useState<string>('multiply');

    // Flattened or 2D arrays? 2D is easier to map.
    const [matrixA, setMatrixA] = useState<number[][]>([[1, 2], [3, 4]]);
    const [matrixB, setMatrixB] = useState<number[][]>([[5, 6], [7, 8]]);
    const [vectorB, setVectorB] = useState<number[]>([5, 6]);

    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    // Resize handlers
    useEffect(() => {
        setMatrixA(prev => resizeMatrix(prev, rowsA, colsA));
    }, [rowsA, colsA]);

    useEffect(() => {
        setMatrixB(prev => resizeMatrix(prev, rowsB, colsB));
    }, [rowsB, colsB]);

    useEffect(() => {
        setVectorB(prev => {
            const newVec = [...prev];
            if (newVec.length < rowsA) {
                return [...newVec, ...Array(rowsA - newVec.length).fill(0)];
            }
            return newVec.slice(0, rowsA);
        });
    }, [rowsA]);

    const resizeMatrix = (oldMatrix: number[][], r: number, c: number) => {
        const newMatrix = Array(r).fill(0).map((_, i) =>
            Array(c).fill(0).map((_, j) => (oldMatrix[i]?.[j] ?? 0))
        );
        return newMatrix;
    };

    const updateCell = (matrix: 'A' | 'B' | 'vector', row: number, col: number, value: string) => {
        const numValue = parseFloat(value) || 0;
        if (matrix === 'A') {
            const newMatrix = [...matrixA];
            newMatrix[row] = [...newMatrix[row]];
            newMatrix[row][col] = numValue;
            setMatrixA(newMatrix);
        } else if (matrix === 'B') {
            const newMatrix = [...matrixB];
            newMatrix[row] = [...newMatrix[row]];
            newMatrix[row][col] = numValue;
            setMatrixB(newMatrix);
        } else {
            const newVector = [...vectorB];
            newVector[row] = numValue;
            setVectorB(newVector);
        }
    };

    // Helper Buttons
    const clearMatrix = (target: 'A' | 'B') => {
        if (target === 'A') setMatrixA(Array(rowsA).fill(0).map(() => Array(colsA).fill(0)));
        else setMatrixB(Array(rowsB).fill(0).map(() => Array(colsB).fill(0)));
    };

    const randomizeMatrix = (target: 'A' | 'B') => {
        const randomizer = (r: number, c: number) =>
            Array(r).fill(0).map(() => Array(c).fill(0).map(() => Math.floor(Math.random() * 10)));

        if (target === 'A') setMatrixA(randomizer(rowsA, colsA));
        else setMatrixB(randomizer(rowsB, colsB));
    };

    const setIdentity = (target: 'A' | 'B') => {
        const r = target === 'A' ? rowsA : rowsB;
        const c = target === 'A' ? colsA : colsB;
        if (r !== c) {
            setError(`Identity matrix must be square (currently ${r}x${c})`);
            return;
        }
        const identity = Array(r).fill(0).map((_, i) =>
            Array(c).fill(0).map((_, j) => (i === j ? 1 : 0))
        );
        if (target === 'A') setMatrixA(identity);
        else setMatrixB(identity);
        setError('');
    };

    const handleCalculate = async () => {
        setError('');
        setResult(null);
        setLoading(true);

        try {
            // Validation
            if (operation === 'add' || operation === 'subtract') {
                if (rowsA !== rowsB || colsA !== colsB) throw new Error("Matrices must have same dimensions for addition/subtraction");
            }
            if (operation === 'multiply') {
                if (colsA !== rowsB) throw new Error(`Matrix A columns (${colsA}) must match Matrix B rows (${rowsB}) for multiplication`);
            }
            if (['determinant', 'inverse', 'lu', 'eigenvalues'].includes(operation)) {
                if (rowsA !== colsA) throw new Error("Matrix must be square for this operation");
            }

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
                    matrix_b: operation !== 'transpose' && operation !== 'inverse' ? matrixB : undefined
                });
                setResult({ type: 'matrix', data: response.result });
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Calculation failed');
        } finally {
            setLoading(false);
        }
    };

    // Needs Matrix B?
    const needsSecondMatrix = ['add', 'subtract', 'multiply'].includes(operation);
    const isSquareOp = ['determinant', 'inverse', 'lu', 'eigenvalues'].includes(operation);

    return (
        <div className="card">
            <h2>Matrix Calculator</h2>

            <div className="form-group">
                <label>Operation</label>
                <select value={operation} onChange={(e) => setOperation(e.target.value)} style={{ padding: '0.5rem', fontSize: '1rem' }}>
                    <option value="add">Add (A + B)</option>
                    <option value="subtract">Subtract (A - B)</option>
                    <option value="multiply">Multiply (A × B)</option>
                    <option value="transpose">Transpose (A^T)</option>
                    <option value="inverse">Inverse (A^-1)</option>
                    <option value="determinant">Determinant (det A)</option>
                    <option value="solve_system">Solve System (Ax = b)</option>
                    <option value="lu">LU Decomposition</option>
                    <option value="eigenvalues">Eigenvalues/Vectors</option>
                </select>
            </div>

            <div className="grid grid-2" style={{ gap: '2rem' }}>
                {/* Matrix A Control */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h3>Matrix A</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select value={rowsA} onChange={(e) => setRowsA(parseInt(e.target.value))}>
                                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} rows</option>)}
                            </select>
                            <span>×</span>
                            <select value={colsA} onChange={(e) => setColsA(parseInt(e.target.value))}>
                                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} cols</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="matrix-actions" style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <button className="small-btn" onClick={() => clearMatrix('A')}>Clear</button>
                        <button className="small-btn" onClick={() => randomizeMatrix('A')}>Random</button>
                        <button className="small-btn" onClick={() => setIdentity('A')}>Identity</button>
                    </div>

                    <div className="matrix-input" style={{ gridTemplateColumns: `repeat(${colsA}, 1fr)` }}>
                        {matrixA.map((row, i) => (
                            <div key={i} className="matrix-row" style={{ display: 'contents' }}>
                                {row.map((cell, j) => (
                                    <input
                                        key={`${i}-${j}`}
                                        type="number"
                                        className="matrix-cell"
                                        value={cell}
                                        onChange={(e) => updateCell('A', i, j, e.target.value)}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Matrix B or Vector Control */}
                {needsSecondMatrix && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h3>Matrix B</h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <select value={rowsB} onChange={(e) => setRowsB(parseInt(e.target.value))}>
                                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} rows</option>)}
                                </select>
                                <span>×</span>
                                <select value={colsB} onChange={(e) => setColsB(parseInt(e.target.value))}>
                                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} cols</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="matrix-actions" style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                            <button className="small-btn" onClick={() => clearMatrix('B')}>Clear</button>
                            <button className="small-btn" onClick={() => randomizeMatrix('B')}>Random</button>
                            <button className="small-btn" onClick={() => setIdentity('B')}>Identity</button>
                        </div>

                        <div className="matrix-input" style={{ gridTemplateColumns: `repeat(${colsB}, 1fr)` }}>
                            {matrixB.map((row, i) => (
                                <div key={i} className="matrix-row" style={{ display: 'contents' }}>
                                    {row.map((cell, j) => (
                                        <input
                                            key={`${i}-${j}`}
                                            type="number"
                                            className="matrix-cell"
                                            value={cell}
                                            onChange={(e) => updateCell('B', i, j, e.target.value)}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {operation === 'solve_system' && (
                    <div>
                        <h3>Vector b</h3>
                        <div className="matrix-input" style={{ gridTemplateColumns: '1fr' }}>
                            {vectorB.map((cell, i) => (
                                <input
                                    key={i}
                                    type="number"
                                    className="matrix-cell"
                                    value={cell}
                                    onChange={(e) => updateCell('vector', i, 0, e.target.value)}
                                    style={{ marginBottom: '0.5rem' }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <button onClick={handleCalculate} disabled={loading} className="primary-btn">
                    {loading ? 'Calculating...' : 'Calculate Result'}
                </button>
            </div>

            {error && <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>}

            {result && (
                <div className="result-box success" style={{ marginTop: '1.5rem' }}>
                    <h3>Result</h3>
                    {result.type === 'matrix' && (
                        <div className="matrix-input" style={{ gridTemplateColumns: `repeat(${result.data[0].length}, 1fr)`, marginTop: '1rem', maxWidth: '400px', margin: '1rem auto' }}>
                            {result.data.map((row: number[], i: number) => (
                                row.map((cell: number, j: number) => (
                                    <div key={`${i}-${j}`} className="matrix-cell" style={{ background: '#e8f5e9', fontWeight: 'bold' }}>
                                        {cell.toFixed(4)}
                                    </div>
                                ))
                            ))}
                        </div>
                    )}

                    {/* Other result types (determinant, solution, etc) reused from previous implementation */}
                    {result.type === 'determinant' && (
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center' }}>
                            Det = {result.data.toFixed(6)}
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
                            <div>
                                <strong>L</strong>
                                <pre style={{ fontSize: '0.7rem' }}>{JSON.stringify(result.data.L, null, 1)}</pre>
                            </div>
                            <div>
                                <strong>U</strong>
                                <pre style={{ fontSize: '0.7rem' }}>{JSON.stringify(result.data.U, null, 1)}</pre>
                            </div>
                            <div>
                                <strong>P</strong>
                                <pre style={{ fontSize: '0.7rem' }}>{JSON.stringify(result.data.P, null, 1)}</pre>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                .small-btn { padding: 0.25rem 0.5rem; font-size: 0.8rem; background: #eee; color: #333; border: 1px solid #ccc; }
                .small-btn:hover { background: #ddd; }
            `}</style>
        </div>
    );
}

export default MatrixCalculator;
