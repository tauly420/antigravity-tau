"""
Matrix + System of Equation Solver API.
Supports matrix operations, system solving, decompositions, eigen-analysis, and SVD.
"""

from flask import Blueprint, request, jsonify
import numpy as np
from scipy import linalg

matrix_bp = Blueprint('matrix', __name__)


EPSILON = 1e-12


def _round(value: float, digits: int = 6) -> float:
    """Round to keep steps readable and JSON payloads compact."""
    return float(np.round(value, digits))


def _matrix_to_list(matrix: np.ndarray) -> list[list[float]]:
    return [[_round(v) for v in row] for row in matrix.tolist()]


def _vector_to_list(vector: np.ndarray) -> list[float]:
    return [_round(v) for v in vector.tolist()]


def _safe_scalar(v):
    if np.abs(np.imag(v)) < 1e-10:
        return float(np.real(v))
    sign = '+' if np.imag(v) >= 0 else '-'
    return f"{np.real(v):.6g} {sign} {abs(np.imag(v)):.6g}i"


def _gaussian_elimination_steps(A: np.ndarray, b: np.ndarray):
    """Perform Gaussian elimination with partial pivoting and return step metadata."""
    n = A.shape[0]
    aug = np.hstack([A.astype(float), b.reshape(-1, 1).astype(float)])

    elimination_steps = []
    permutations = []

    for k in range(n - 1):
        pivot_row = k + int(np.argmax(np.abs(aug[k:, k])))
        pivot_value = aug[pivot_row, k]

        if abs(pivot_value) < EPSILON:
            raise np.linalg.LinAlgError("Matrix is singular or near-singular")

        if pivot_row != k:
            aug[[k, pivot_row]] = aug[[pivot_row, k]]
            permutations.append({
                "step": f"Swap rows R{k + 1} and R{pivot_row + 1}",
                "matrix": _matrix_to_list(aug[:, :-1]),
                "rhs": _vector_to_list(aug[:, -1]),
            })

        current_pivot = aug[k, k]

        for i in range(k + 1, n):
            factor = aug[i, k] / current_pivot
            if abs(factor) < EPSILON:
                continue
            aug[i, k:] = aug[i, k:] - factor * aug[k, k:]

            elimination_steps.append({
                "step": f"R{i + 1} ← R{i + 1} - ({_round(factor)})·R{k + 1}",
                "pivot": {"row": k + 1, "value": _round(current_pivot)},
                "matrix": _matrix_to_list(aug[:, :-1]),
                "rhs": _vector_to_list(aug[:, -1]),
            })

    if abs(aug[-1, -2]) < EPSILON and abs(aug[-1, -1]) > EPSILON:
        raise np.linalg.LinAlgError("Inconsistent system (no solution)")

    U = aug[:, :-1]
    c = aug[:, -1]
    return U, c, {"permutations": permutations, "elimination": elimination_steps}


def _back_substitution_steps(U: np.ndarray, c: np.ndarray):
    n = U.shape[0]
    x = np.zeros(n)
    steps = []

    for i in range(n - 1, -1, -1):
        if abs(U[i, i]) < EPSILON:
            raise np.linalg.LinAlgError("Zero diagonal encountered in back substitution")

        known_sum = np.dot(U[i, i + 1:], x[i + 1:])
        numerator = c[i] - known_sum
        x[i] = numerator / U[i, i]

        steps.append({
            "variable": f"x{i + 1}",
            "equation": f"x{i + 1} = ({_round(c[i])} - {_round(known_sum)}) / {_round(U[i, i])}",
            "value": _round(x[i]),
        })

    return x, list(reversed(steps))


@matrix_bp.route('/operations', methods=['POST'])
def operations():
    try:
        data = request.get_json()
        operation = data.get('operation', '').lower()
        matrix_a = data.get('matrix_a')
        matrix_b = data.get('matrix_b')

        if not matrix_a:
            return jsonify({"error": "matrix_a is required"}), 400

        A = np.array(matrix_a, dtype=float)

        if operation in ['add', 'subtract', 'multiply']:
            if not matrix_b:
                return jsonify({"error": f"matrix_b is required for {operation}"}), 400
            B = np.array(matrix_b, dtype=float)

        if operation == 'add':
            result = A + B
        elif operation == 'subtract':
            result = A - B
        elif operation == 'multiply':
            result = A @ B
        elif operation == 'transpose':
            result = A.T
        elif operation == 'inverse':
            if A.shape[0] != A.shape[1]:
                return jsonify({"error": "Matrix must be square for inverse"}), 400
            result = linalg.inv(A)
        else:
            return jsonify({"error": f"Unknown operation: {operation}"}), 400

        return jsonify({"result": result.tolist(), "error": None})

    except np.linalg.LinAlgError as e:
        return jsonify({"error": f"Linear algebra error: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@matrix_bp.route('/solve_system', methods=['POST'])
def solve_system():
    """Solve Ax=b and optionally include Gaussian elimination + back substitution steps."""
    try:
        data = request.get_json()
        matrix_a = data.get('matrix_a')
        vector_b = data.get('vector_b')
        include_steps = bool(data.get('include_steps', False))

        if not matrix_a or not vector_b:
            return jsonify({"error": "matrix_a and vector_b are required"}), 400

        A = np.array(matrix_a, dtype=float)
        b = np.array(vector_b, dtype=float)

        if A.shape[0] != A.shape[1]:
            return jsonify({"error": "matrix_a must be square for a unique system solution"}), 400
        if b.shape[0] != A.shape[0]:
            return jsonify({"error": "vector_b length must match matrix_a rows"}), 400

        solution = linalg.solve(A, b)
        payload = {"solution": solution.tolist(), "error": None}

        if include_steps:
            U, c, gauss_steps = _gaussian_elimination_steps(A, b)
            x_steps, backward_steps = _back_substitution_steps(U, c)
            payload["steps"] = {
                "method": "Gaussian elimination with partial pivoting",
                "forward_elimination": {
                    "row_swaps": gauss_steps["permutations"],
                    "steps": gauss_steps["elimination"],
                    "upper_triangular": _matrix_to_list(U),
                    "transformed_rhs": _vector_to_list(c),
                },
                "backward_substitution": backward_steps,
                "verification": {
                    "solution_from_steps": _vector_to_list(x_steps),
                    "solution_from_solver": _vector_to_list(solution),
                },
            }

        return jsonify(payload)

    except np.linalg.LinAlgError as e:
        return jsonify({"error": f"System has no unique solution: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@matrix_bp.route('/determinant', methods=['POST'])
def determinant():
    try:
        data = request.get_json()
        matrix = data.get('matrix')

        if not matrix:
            return jsonify({"error": "matrix is required"}), 400

        A = np.array(matrix, dtype=float)

        if A.shape[0] != A.shape[1]:
            return jsonify({"error": "Matrix must be square"}), 400

        det = np.linalg.det(A)

        return jsonify({"determinant": float(det), "error": None})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@matrix_bp.route('/lu_decomposition', methods=['POST'])
def lu_decomposition():
    """Perform LU decomposition with optional explanation steps."""
    try:
        data = request.get_json()
        matrix = data.get('matrix')
        include_steps = bool(data.get('include_steps', False))

        if not matrix:
            return jsonify({"error": "matrix is required"}), 400

        A = np.array(matrix, dtype=float)

        if A.shape[0] != A.shape[1]:
            return jsonify({"error": "Matrix must be square"}), 400

        P, L, U = linalg.lu(A)

        payload = {"P": P.tolist(), "L": L.tolist(), "U": U.tolist(), "error": None}

        if include_steps:
            payload["steps"] = {
                "method": "PA = LU (partial pivoting)",
                "description": [
                    "Compute permutation matrix P so the largest pivot is used at each stage.",
                    "Store elimination multipliers below diagonal in L.",
                    "Store transformed upper-triangular coefficients in U.",
                    "Validate by checking P·A = L·U.",
                ],
                "intermediate": {
                    "P_times_A": _matrix_to_list(P @ A),
                    "L_times_U": _matrix_to_list(L @ U),
                },
            }

        return jsonify(payload)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@matrix_bp.route('/eigenvalues', methods=['POST'])
def eigenvalues():
    """Find eigenvalues/eigenvectors with optional explanatory metadata."""
    try:
        data = request.get_json()
        matrix = data.get('matrix')
        include_steps = bool(data.get('include_steps', False))

        if not matrix:
            return jsonify({"error": "matrix is required"}), 400

        A = np.array(matrix, dtype=float)

        if A.shape[0] != A.shape[1]:
            return jsonify({"error": "Matrix must be square"}), 400

        eigenvals, eigenvecs = linalg.eig(A)
        eigenvals_list = [_safe_scalar(v) for v in eigenvals]

        has_complex = np.any(np.abs(eigenvecs.imag) > 1e-10)
        if has_complex:
            evecs = []
            for col in range(eigenvecs.shape[1]):
                vec = []
                for row in range(eigenvecs.shape[0]):
                    vec.append(_safe_scalar(eigenvecs[row, col]))
                evecs.append(vec)
        else:
            evecs = eigenvecs.real.tolist()

        payload = {"eigenvalues": eigenvals_list, "eigenvectors": evecs, "error": None}

        if include_steps:
            trace = float(np.trace(A))
            determinant = float(np.linalg.det(A))
            payload["steps"] = {
                "method": "Solve det(A - λI)=0 then solve (A - λI)v=0",
                "summary": [
                    "Form characteristic polynomial p(λ)=det(A-λI).",
                    "Compute roots λᵢ (eigenvalues).",
                    "For each λᵢ, solve null space of (A-λᵢI) for eigenvector vᵢ.",
                ],
                "invariants": {
                    "trace_A": _round(trace),
                    "determinant_A": _round(determinant),
                    "sum_of_eigenvalues": _round(np.real(np.sum(eigenvals))),
                    "product_of_eigenvalues": _round(np.real(np.prod(eigenvals))),
                },
            }

        return jsonify(payload)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@matrix_bp.route('/svd', methods=['POST'])
def svd_decomposition():
    """Compute singular value decomposition A = UΣVᵀ with optional explanatory metadata."""
    try:
        data = request.get_json()
        matrix = data.get('matrix')
        include_steps = bool(data.get('include_steps', False))

        if not matrix:
            return jsonify({"error": "matrix is required"}), 400

        A = np.array(matrix, dtype=float)

        U, singular_values, Vt = linalg.svd(A, full_matrices=True)

        payload = {
            "U": U.tolist(),
            "singular_values": singular_values.tolist(),
            "Vt": Vt.tolist(),
            "error": None,
        }

        if include_steps:
            sigma = np.zeros((U.shape[0], Vt.shape[0]))
            np.fill_diagonal(sigma, singular_values)
            reconstruction = U @ sigma @ Vt
            payload["steps"] = {
                "method": "SVD via eigen-analysis of AᵀA and AAᵀ",
                "summary": [
                    "Compute eigenvalues of AᵀA; singular values are σᵢ = sqrt(λᵢ).",
                    "Right singular vectors are eigenvectors of AᵀA (rows of Vᵀ).",
                    "Left singular vectors are eigenvectors of AAᵀ (columns of U).",
                    "Reconstruct A by UΣVᵀ.",
                ],
                "sigma": _matrix_to_list(sigma),
                "reconstruction": _matrix_to_list(reconstruction),
            }

        return jsonify(payload)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
