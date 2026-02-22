# Tau-LY Lab Tools

A comprehensive web-based laboratory tools suite for physics and engineering students.

## Features

- **Lab Workflow** — Full pipeline: upload Excel data → select columns → curve fit → formula calculation → N-σ comparison
- **Graph Fitting** — Upload data, fit with linear/polynomial/exponential/sinusoidal/custom models, visualize with residuals
- **Formula Calculator** — Auto-detect variables, evaluate expressions with uncertainty propagation via partial derivatives
- **N-σ Calculator** — Compare measurements and determine statistical agreement
- **Matrix Calculator** — Operations, determinants, eigenvalues, LU decomposition, system solving
- **ODE Solver** — Numerical ODE solutions with visualization
- **Numerical Integration** — 1D and multi-dimensional integration
- **Unit Converter** — Convert between measurement units
- **AI Assistant** — OpenAI-powered lab assistant sidebar

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Plotly.js
- **Backend**: Python Flask + NumPy + SciPy + SymPy
- **Deployment**: Railway (via nixpacks)

## Local Development

```bash
./start.sh
```

Or manually:
```bash
# Backend
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r ../requirements.txt && python app.py

# Frontend
cd frontend && npm install --legacy-peer-deps && npm run dev
```

## Environment Variables

- `OPENAI_API_KEY` — Required for AI Assistant functionality
- `PORT` — Server port (default: 5000)

## License

© 2026 Tau-LY Lab Tools • All rights reserved to Uri Shulman
