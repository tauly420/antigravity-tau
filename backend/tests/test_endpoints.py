"""
Endpoint integration tests for ODE and Integration APIs.

Tests that the Flask endpoints correctly use safe_eval functions and reject
malicious input while producing correct results for valid math expressions.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


# ============================================================
# ODE endpoint tests (SEC-01)
# ============================================================

class TestODEEndpoint:
    """Tests for POST /api/ode/solve"""

    def test_ode_simple_pendulum(self, client):
        """Simple pendulum: y'' = -g/L * sin(y), as system y[0]'=y[1], y[1]'=-9.81*sin(y[0])"""
        resp = client.post('/api/ode/solve', json={
            "function": "y[1], -9.81/1.0*sin(y[0])",
            "initial_conditions": [0.5, 0],
            "t_span": [0, 10],
            "num_points": 50,
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["error"] is None
        assert "t" in data
        assert "y" in data
        assert len(data["t"]) == 50
        assert len(data["y"]) == 2  # 2 components

    def test_ode_lorenz(self, client):
        """Lorenz system: 3 components"""
        resp = client.post('/api/ode/solve', json={
            "function": "10*(y[1]-y[0]), y[0]*(28-y[2])-y[1], y[0]*y[1]-(8/3)*y[2]",
            "initial_conditions": [1, 1, 1],
            "t_span": [0, 10],
            "num_points": 100,
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["error"] is None
        assert len(data["y"]) == 3  # 3 components

    def test_ode_harmonic_oscillator(self, client):
        """Simple harmonic oscillator: y'' = -y"""
        resp = client.post('/api/ode/solve', json={
            "function": "y[1], -y[0]",
            "initial_conditions": [1, 0],
            "t_span": [0, 6.283],
            "num_points": 100,
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["error"] is None
        # After one full period, y[0] should be close to initial value 1
        assert abs(data["y"][0][-1] - 1.0) < 0.05

    def test_ode_rejects_malicious_import(self, client):
        """Reject __import__('os').system('ls')"""
        resp = client.post('/api/ode/solve', json={
            "function": "__import__('os').system('ls')",
            "initial_conditions": [0],
            "t_span": [0, 1],
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_ode_rejects_import(self, client):
        """Reject 'import os'"""
        resp = client.post('/api/ode/solve', json={
            "function": "import os",
            "initial_conditions": [0],
            "t_span": [0, 1],
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_ode_rejects_exec(self, client):
        """Reject exec() calls"""
        resp = client.post('/api/ode/solve', json={
            "function": "exec('import os')",
            "initial_conditions": [0],
            "t_span": [0, 1],
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_ode_energy_safe(self, client):
        """Energy expression also uses safe parsing"""
        resp = client.post('/api/ode/solve', json={
            "function": "y[1], -y[0]",
            "initial_conditions": [1, 0],
            "t_span": [0, 6.283],
            "num_points": 50,
            "compute_energy": True,
            "energy_expr": "0.5*y[1]**2 + 0.5*y[0]**2",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert "energy" in data
        # Total energy should be conserved (close to 0.5 everywhere)
        energies = data["energy"]
        assert all(abs(e - 0.5) < 0.01 for e in energies)

    def test_ode_energy_rejects_malicious(self, client):
        """Malicious energy expression is rejected"""
        resp = client.post('/api/ode/solve', json={
            "function": "y[1], -y[0]",
            "initial_conditions": [1, 0],
            "t_span": [0, 1],
            "num_points": 10,
            "compute_energy": True,
            "energy_expr": "__import__('os').system('ls')",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        # Energy computation should fail gracefully with energy_error
        assert "energy_error" in data


# ============================================================
# Integration endpoint tests (SEC-02)
# ============================================================

class TestIntegration1DEndpoint:
    """Tests for POST /api/integrate/1d"""

    def test_integrate_1d_polynomial(self, client):
        """Integral of x^2 from 0 to 1 = 1/3"""
        resp = client.post('/api/integrate/1d', json={
            "function": "x**2",
            "bounds": [0, 1],
            "method": "quad",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert abs(data["result"] - 0.333333) < 0.001

    def test_integrate_1d_trig(self, client):
        """Integral of sin(x) from 0 to pi = 2"""
        resp = client.post('/api/integrate/1d', json={
            "function": "sin(x)",
            "bounds": [0, 3.14159265],
            "method": "quad",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert abs(data["result"] - 2.0) < 0.001

    def test_integrate_1d_exponential(self, client):
        """Integral of exp(-x) from 0 to inf approaches 1 -- using finite bound"""
        resp = client.post('/api/integrate/1d', json={
            "function": "exp(-x**2)",
            "bounds": [0, 10],
            "method": "quad",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        # sqrt(pi)/2 ~ 0.8862
        assert abs(data["result"] - 0.8862) < 0.01

    def test_integrate_1d_rejects_malicious(self, client):
        """Reject __import__('os').system('ls')"""
        resp = client.post('/api/integrate/1d', json={
            "function": "__import__('os').system('ls')",
            "bounds": [0, 1],
            "method": "quad",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_integrate_1d_rejects_exec(self, client):
        """Reject exec() calls"""
        resp = client.post('/api/integrate/1d', json={
            "function": "exec('import os')",
            "bounds": [0, 1],
            "method": "quad",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data


class TestIntegrationMultiEndpoint:
    """Tests for POST /api/integrate/multi"""

    def test_integrate_multi_2d(self, client):
        """Integral of x^2 + y^2 over [0,1]x[0,1] = 2/3"""
        resp = client.post('/api/integrate/multi', json={
            "function": "x**2 + y**2",
            "bounds": [[0, 1], [0, 1]],
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert abs(data["result"] - 0.6667) < 0.01

    def test_integrate_multi_rejects_malicious(self, client):
        """Reject exec('import os')"""
        resp = client.post('/api/integrate/multi', json={
            "function": "exec('import os')",
            "bounds": [[0, 1], [0, 1]],
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_integrate_multi_rejects_import(self, client):
        """Reject __import__ in multi-dim"""
        resp = client.post('/api/integrate/multi', json={
            "function": "__import__('os').listdir('.')",
            "bounds": [[0, 1], [0, 1]],
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data
