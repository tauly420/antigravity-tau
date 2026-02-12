"""
Matrix Calculator API
NEW FEATURE: Matrix operations, system solving, decompositions, eigenvalues
"""

from flask import Blueprint, request, jsonify
import numpy as np
from scipy import linalg

matrix_bp = Blueprint('matrix', __name__)


@matrix_bp.route('/operations', methods=['POST'])
def operations():
    """
    Perform basic matrix operations.
    
    Request JSON:
    {
        "operation": "multiply",  // add, subtract, multiply, transpose, inverse
        "matrix_a": [[1, 2], [3, 4]],
        "matrix_b": [[5, 6], [7, 8]]  // optional, not needed for transpose/inverse
    }
    
    Response JSON:
    {
        "result": [[19, 22], [43, 50]],
        "error": null
    }
    """
    try:
        data = request.get_json()
        operation = data.get('operation', '').lower()
        matrix_a = data.get('matrix_a')
        matrix_b = data.get('matrix_b')
        
        if not matrix_a:
            return jsonify({"error": "matrix_a is required"}), 400
        
        # Convert to numpy arrays
        A = np.array(matrix_a, dtype=float)
        
        if operation in ['add', 'subtract', 'multiply']:
            if not matrix_b:
                return jsonify({"error": f"matrix_b is required for {operation}"}), 400
            B = np.array(matrix_b, dtype=float)
        
        # Perform operation
        if operation == 'add':
            result = A + B
        elif operation == 'subtract':
            result = A - B
        elif operation == 'multiply':
            result = A @ B  # Matrix multiplication
        elif operation == 'transpose':
            result = A.T
        elif operation == 'inverse':
            if A.shape[0] != A.shape[1]:
                return jsonify({"error": "Matrix must be square for inverse"}), 400
            result = linalg.inv(A)
        else:
            return jsonify({"error": f"Unknown operation: {operation}"}), 400
        
        return jsonify({
            "result": result.tolist(),
            "error": None
        })
    
    except np.linalg.LinAlgError as e:
        return jsonify({"error": f"Linear algebra error: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@matrix_bp.route('/solve_system', methods=['POST'])
def solve_system():
    """
    Solve system of linear equations Ax = b.
    
    Request JSON:
    {
        "matrix_a": [[2, 1], [1, 3]],
        "vector_b": [5, 6]
    }
    
    Response JSON:
    {
        "solution": [1.4, 2.2],
        "error": null
    }
    """
    try:
        data = request.get_json()
        matrix_a = data.get('matrix_a')
        vector_b = data.get('vector_b')
        
        if not matrix_a or not vector_b:
            return jsonify({"error": "matrix_a and vector_b are required"}), 400
        
        A = np.array(matrix_a, dtype=float)
        b = np.array(vector_b, dtype=float)
        
        # Solve the system
        solution = linalg.solve(A, b)
        
        return jsonify({
            "solution": solution.tolist(),
            "error": None
        })
    
    except np.linalg.LinAlgError as e:
        return jsonify({"error": f"System has no unique solution: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@matrix_bp.route('/determinant', methods=['POST'])
def determinant():
    """
    Calculate determinant of a matrix.
    
    Request JSON:
    {
        "matrix": [[1, 2], [3, 4]]
    }
    
    Response JSON:
    {
        "determinant": -2.0,
        "error": null
    }
    """
    try:
        data = request.get_json()
        matrix = data.get('matrix')
        
        if not matrix:
            return jsonify({"error": "matrix is required"}), 400
        
        A = np.array(matrix, dtype=float)
        
        if A.shape[0] != A.shape[1]:
            return jsonify({"error": "Matrix must be square"}), 400
        
        det = np.linalg.det(A)
        
        return jsonify({
            "determinant": float(det),
            "error": None
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@matrix_bp.route('/lu_decomposition', methods=['POST'])
def lu_decomposition():
    """
    Perform LU decomposition of a matrix.
    
    Request JSON:
    {
        "matrix": [[4, 3], [6, 3]]
    }
    
    Response JSON:
    {
        "P": [[0, 1], [1, 0]],
        "L": [[1, 0], [0.667, 1]],
        "U": [[6, 3], [0, 1]],
        "error": null
    }
    """
    try:
        data = request.get_json()
        matrix = data.get('matrix')
        
        if not matrix:
            return jsonify({"error": "matrix is required"}), 400
        
        A = np.array(matrix, dtype=float)
        
        if A.shape[0] != A.shape[1]:
            return jsonify({"error": "Matrix must be square"}), 400
        
        # Perform LU decomposition with partial pivoting
        P, L, U = linalg.lu(A)
        
        return jsonify({
            "P": P.tolist(),
            "L": L.tolist(),
            "U": U.tolist(),
            "error": None
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@matrix_bp.route('/eigenvalues', methods=['POST'])
def eigenvalues():
    """
    Find eigenvalues and eigenvectors of a matrix.
    
    Request JSON:
    {
        "matrix": [[2, 1], [1, 2]]
    }
    
    Response JSON:
    {
        "eigenvalues": [3.0, 1.0],
        "eigenvectors": [[0.707, -0.707], [0.707, 0.707]],
        "error": null
    }
    """
    try:
        data = request.get_json()
        matrix = data.get('matrix')
        
        if not matrix:
            return jsonify({"error": "matrix is required"}), 400
        
        A = np.array(matrix, dtype=float)
        
        if A.shape[0] != A.shape[1]:
            return jsonify({"error": "Matrix must be square"}), 400
        
        # Calculate eigenvalues and eigenvectors
        eigenvals, eigenvecs = linalg.eig(A)
        
        # Convert complex numbers to real if imaginary parts are negligible
        eigenvals_list = []
        for val in eigenvals:
            if np.abs(val.imag) < 1e-10:
                eigenvals_list.append(float(val.real))
            else:
                eigenvals_list.append(complex(val))
        
        return jsonify({
            "eigenvalues": eigenvals_list,
            "eigenvectors": eigenvecs.real.tolist(),  # Return real parts
            "error": None
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
