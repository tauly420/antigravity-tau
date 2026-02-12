import { useState } from 'react';
import * as api from '../services/api';

function MatrixCalculator() {
    const [size, setSize] = useState<number>(2);
    const [operation, setOperation] = useState<string>('multiply');
    const [matrixA, setMatrixA] = useState<number[][]>([[1, 2], [3, 4]]);
    const [matrixB, setMatrixB] = useState<number[][]>([[5, 6], [7, 8]]);
    const [vectorB, setVectorB] = useState<number[]>([5, 6]);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const updateMatrixSize = (newSize: number) => {
        setSize(newSize);
        const newMatrixA = Array(newSize).fill(0).map((_, i) =>
            Array(newSize).fill(0).map((_, j) => (matrixA[i]?.[j] ?? 0))
        );
        const newMatrixB = Array(newSize).fill(0).map((_, i) =>
            Array(newSize).fill(0).map((_, j) => (matrixB[i]?.[j] ?? 0))
        );
        const newVectorB = Array(newSize).fill(0).map((_, i) => (vectorB[i] ?? 0));
        setMatrixA(newMatrixA);
        setMatrixB(newMatrixB);
        setVectorB(newVectorB);
    };

    const updateCell = (matrix: 'A' | 'B' | 'vector', row: number, col: number, value: string) => {
        const numValue = parseFloat(value) || 0;
        if (matrix === 'A') {
            const newMatrix = [...matrixA];
            newMatrix[row][col] = numValue;
            setMatrixA(newMatrix);
        } else if (matrix === 'B') {
            const newMatrix = [...matrixB];
            newMatrix[row][col] = numValue;
            setMatrixB(newMatrix);
        } else {
            const newVector = [...vectorB];
            newVector[row] = numValue;
            setVectorB(newVector);
        }
    };

    const handleCalculate = async () => {
        setError('');
        setResult(null);
        setLoading(true);

        try {
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
                // Basic operations
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

    return (
        <div className="card">
            <h2>Matrix Calculator</h2>

            <div className="instructions">
                <p><strong>Instructions:</strong></p>
                <p>• Choose matrix size (up to 5×5) and operation type</p>
                <p>• For basic operations (add, multiply, etc.), enter both matrices A and B</p>
                <p>• For systems of equations: Matrix A is coefficients, Vector b is constants (Ax = b)</p>
                <p>• For determinant, LU, eigenvalues: only Matrix A is needed</p>
            </div>

            <div className="grid grid-2">
                <div className="form-group">
                    <label>Matrix Size</label>
                    <select value={size} onChange={(e) => updateMatrixSize(parseInt(e.target.value))}>
                        <option value={2}>2×2</option>
                        <option value={3}>3×3</option>
                        <option value={4}>4×4</option>
                        <option value={5}>5×5</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Operation</label>
                    <select value={operation} onChange={(e) => setOperation(e.target.value)}>
                        <option value="add">Add (A + B)</option>
                        <option value="subtract">Subtract (A - B)</option>
                        <option value="multiply">Multiply (A × B)</option>
                        <option value="transpose">Transpose (A^T)</option>
                        <option value="inverse">Inverse (A^-1)</option>
                        <option value="determinant">Determinant (det A)</option>
                        <option value="solve_system">Solve System (Ax = b)</option>
                        <option value="lu">LU Decomposition</option>
                        <option value="eigenvalues">Eigenvalues/vectors</option>
                    </select>
                </div>
            </div>

            <h3>Matrix A</h3>
            <div className="matrix-input" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
                {matrixA.map((row, i) => (
                    <div key={i} className="matrix-row" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
                        {row.map((cell, j) => (
                            <input
                                key={j}
                                type="number"
                                className="matrix-cell"
                                value={cell}
                                onChange={(e) => updateCell('A', i, j, e.target.value)}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {!['transpose', 'inverse', 'determinant', 'lu', 'eigenvalues'].includes(operation) && operation !== 'solve_system' && (
                <>
                    <h3>Matrix B</h3>
                    <div className="matrix-input" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
                        {matrixB.map((row, i) => (
                            <div key={i} className="matrix-row" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
                                {row.map((cell, j) => (
                                    <input
                                        key={j}
                                        type="number"
                                        className="matrix-cell"
                                        value={cell}
                                        onChange={(e) => updateCell('B', i, j, e.target.value)}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {operation === 'solve_system' && (
                <>
                    <h3>Vector b (right-hand side)</h3>
                    <div className="matrix-input" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
                        <div className="matrix-row" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
                            {vectorB.map((cell, i) => (
                                <input
                                    key={i}
                                    type="number"
                                    className="matrix-cell"
                                    value={cell}
                                    onChange={(e) => updateCell('vector', i, 0, e.target.value)}
                                />
                            ))}
                        </div>
                    </div>
                </>
            )}

            <button onClick={handleCalculate} disabled={loading} style={{ marginTop: '1.5rem' }}>
                {loading ? 'Calculating...' : 'Calculate'}
            </button>

            {error && <div className="error-message">{error}</div>}

            {result && (
                <div className="result-box success" style={{ marginTop: '1.5rem' }}>
                    <h3>Result</h3>
                    {result.type === 'matrix' && (
                        <div className="matrix-input" style={{ gridTemplateColumns: `repeat(${result.data[0].length}, 1fr)`, marginTop: '1rem' }}>
                            {result.data.map((row: number[], i: number) => (
                                <div key={i} className="matrix-row" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
                                    {row.map((cell: number, j: number) => (
                                        <div key={j} className="matrix-cell" style={{ background: '#e8f5e9', fontWeight: 'bold' }}>
                                            {cell.toFixed(4)}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    {result.type === 'solution' && (
                        <div>
                            <p><strong>Solution vector x:</strong></p>
                            <p style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
                                {result.data.map((val: number, i: number) => `x${i + 1} = ${val.toFixed(4)}`).join(', ')}
                            </p>
                        </div>
                    )}

                    {result.type === 'determinant' && (
                        <p style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
                            Determinant = {result.data.toFixed(6)}
                        </p>
                    )}

                    {result.type === 'eigenvalues' && (
                        <div>
                            <p><strong>Eigenvalues:</strong></p>
                            <p style={{ fontFamily: 'monospace' }}>
                                {result.data.eigenvalues.map((val: number, i: number) => `λ${i + 1} = ${val.toFixed(4)}`).join(', ')}
                            </p>
                            <p style={{ marginTop: '1rem' }}><strong>Eigenvectors (columns):</strong></p>
                            <div className="matrix-input" style={{ gridTemplateColumns: `repeat(${result.data.eigenvectors[0].length}, 1fr)`, marginTop: '0.5rem' }}>
                                {result.data.eigenvectors.map((row: number[], i: number) => (
                                    <div key={i} className="matrix-row" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
                                        {row.map((cell: number, j: number) => (
                                            <div key={j} className="matrix-cell" style={{ background: '#e8f5e9', fontSize: '0.85rem' }}>
                                                {cell.toFixed(4)}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {result.type === 'lu' && (
                        <div>
                            <p><strong>P (Permutation):</strong></p>
                            <div className="matrix-input" style={{ gridTemplateColumns: `repeat(${result.data.P[0].length}, 1fr)` }}>
                                {result.data.P.map((row: number[], i: number) => (
                                    <div key={i} className="matrix-row" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
                                        {row.map((cell: number, j: number) => (
                                            <div key={j} className="matrix-cell" style={{ background: '#fff3e0', fontSize: '0.85rem' }}>
                                                {cell.toFixed(1)}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                            <p style={{ marginTop: '1rem' }}><strong>L (Lower):</strong></p>
                            <div className="matrix-input" style={{ gridTemplateColumns: `repeat(${result.data.L[0].length}, 1fr)` }}>
                                {result.data.L.map((row: number[], i: number) => (
                                    <div key={i} className="matrix-row" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
                                        {row.map((cell: number, j: number) => (
                                            <div key={j} className="matrix-cell" style={{ background: '#e1f5fe', fontSize: '0.85rem' }}>
                                                {cell.toFixed(4)}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                            <p style={{ marginTop: '1rem' }}><strong>U (Upper):</strong></p>
                            <div className="matrix-input" style={{ gridTemplateColumns: `repeat(${result.data.U[0].length}, 1fr)` }}>
                                {result.data.U.map((row: number[], i: number) => (
                                    <div key={i} className="matrix-row" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
                                        {row.map((cell: number, j: number) => (
                                            <div key={j} className="matrix-cell" style={{ background: '#f3e5f5', fontSize: '0.85rem' }}>
                                                {cell.toFixed(4)}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default MatrixCalculator;
