# Tau-LY Lab Tools

A comprehensive suite of computational tools for laboratory work and scientific calculations, rebuilt with a modern Flask + React architecture.

## Features

### Existing Features
- **Formula Calculator** - Evaluate mathematical expressions with automatic uncertainty propagation
- **N-Sigma Calculator** - Statistical significance testing between measurements
- **Unit Converter** - Convert between various units (length, mass, time, temperature)
- **Curve Fitting** - Fit data to various models with uncertainty estimation
- **AI Assistant** - Get help with calculations using OpenAI integration

### ✨ New Features
- **Matrix Calculator** - Perform matrix operations up to 5×5:
  - Basic operations: add, subtract, multiply, transpose, inverse
  - Solve systems of linear equations (Ax = b)
  - Calculate determinants
  - LU decomposition
  - Find eigenvalues and eigenvectors
  
- **ODE Solver** - Solve ordinary differential equations:
  - First-order and higher-order ODEs
  - Multiple solver methods (RK45, RK23, DOP853, Radau, BDF, LSODA)
  - Interactive solution plots
  
- **Numerical Integrator** - Compute integrals numerically:
  - 1D integration with multiple methods (quad, trapezoid, Simpson, Romberg)
  - Divergence detection and warnings for improper integrals
  - Multi-dimensional integration using Monte Carlo methods
  - Support for complex integration regions with conditions

## Running Locally

### Prerequisites
- Python 3.8+
- Node.js 16+ and npm
- (Optional) OpenAI API key for AI assistant

### Backend Setup

1. **Create and activate a virtual environment:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up OpenAI API key (optional, for AI assistant):**
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   ```

4. **Run the Flask backend:**
   ```bash
   cd backend
   python app.py
   ```
   
   The backend will start on `http://localhost:5000`

### Frontend Setup

1. **Install Node.js dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```
   
   The frontend will start on `http://localhost:5173`

3. **Open your browser:**
   Navigate to `http://localhost:5173` to use the application

## Production Build

### Build Frontend
```bash
cd frontend
npm run build
```

This creates optimized static files in `frontend/dist/`

### Run Production Server
The Flask backend can serve the built frontend in production:
```bash
cd backend
python app.py
```

The application will be available at `http://localhost:5000`

## Deploying to Railway

1. **Update your Railway project:**
   - Push your code to GitHub
   - Railway will auto-detect the Python app

2. **Set environment variables in Railway:**
   - `OPENAI_API_KEY` (if using AI assistant)
   - `PORT` (Railway sets this automatically)

3. **Build command:**
   ```bash
   cd frontend && npm install --legacy-peer-deps && npm run build && cd ../backend && pip install -r ../requirements.txt
   ```

4. **Start command:**
   ```bash
   cd backend && python app.py
   ```

## Project Structure

```
.
├── backend/
│   ├── api/
│   │   ├── formula.py      # Formula calculator API
│   │   ├── nsigma.py       # N-sigma calculator API
│   │   ├── units.py        # Unit conversion API
│   │   ├── fitting.py      # Curve fitting API
│   │   ├── matrix.py       # Matrix calculator API (NEW)
│   │   ├── ode.py          # ODE solver API (NEW)
│   │   ├── integrate.py    # Numerical integration API (NEW)
│   │   └── assistant.py    # AI assistant API
│   ├── utils/
│   │   └── calculations.py # Shared calculation utilities
│   └── app.py              # Main Flask application
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API service layer
│   │   ├── styles/         # Global CSS
│   │   ├── App.tsx         # Main app component
│   │   └── main.tsx        # Entry point
│   ├── package.json
│   └── vite.config.ts
├── app/                    # Original Streamlit app (preserved for reference)
├── requirements.txt        # Python dependencies
└── README.md
```

## Technology Stack

**Backend:**
- Flask 3.0+ (web framework)
- NumPy & SciPy (numerical computations)
- SymPy (symbolic mathematics)
- OpenAI API (AI assistant)

**Frontend:**
- React 19 with TypeScript
- Vite (build tool)
- React Router (navigation)
- Plotly.js (interactive plotting)
- Axios (API calls)

## API Documentation

All API endpoints are prefixed with `/api/`:

- `POST /api/formula/evaluate` - Evaluate mathematical expressions
- `POST /api/nsigma/calculate` - Calculate n-sigma values
- `POST /api/units/convert` - Convert between units
- `GET /api/units/categories` - Get available unit categories
- `POST /api/fitting/fit` - Perform curve fitting
- `POST /api/matrix/operations` - Matrix operations (NEW)
- `POST /api/matrix/solve_system` - Solve linear systems (NEW)
- `POST /api/matrix/determinant` - Calculate determinant (NEW)
- `POST /api/matrix/lu_decomposition` - LU decomposition (NEW)
- `POST /api/matrix/eigenvalues` - Find eigenvalues (NEW)
- `POST /api/ode/solve` - Solve ODEs (NEW)
- `GET /api/ode/methods` - Get available ODE methods (NEW)
- `POST /api/integrate/1d` - 1D numerical integration (NEW)
- `POST /api/integrate/multi` - Multi-dimensional integration (NEW)
- `GET /api/integrate/methods` - Get integration methods (NEW)
- `POST /api/assistant/chat` - Chat with AI assistant
- `GET /api/assistant/status` - Check assistant availability

## Contributing

This is a private lab tools project. For questions or issues, contact the development team.

## License

Internal use only.
