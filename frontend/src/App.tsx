import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './styles/global.css';

// Feature Components
import Home from './components/Home';
import FormulaCalculator from './components/FormulaCalculator';
import MatrixCalculator from './components/MatrixCalculator';
import ODESolver from './components/ODESolver';
import NumericalIntegrator from './components/NumericalIntegrator';
import GraphFitting from './components/GraphFitting';
import NSigmaCalculator from './components/NSigmaCalculator';
import UnitConverter from './components/UnitConverter';
import AIAssistant from './components/AIAssistant';

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="header">
          <Link to="/" style={{ textDecoration: 'none', color: 'white' }}>
            <h1>Tau-LY Lab Tools</h1>
          </Link>
          <p>Computational suite for laboratory data analysis, simulations, and utilities.</p>
        </header>

        <nav className="nav-bar">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/formula" className="nav-link">Formula</Link>
          <Link to="/matrix" className="nav-link">Matrix</Link>
          <Link to="/ode" className="nav-link">ODE</Link>
          <Link to="/integrator" className="nav-link">Integrator</Link>
          <Link to="/fitting" className="nav-link">Graph & Fit</Link>
          <Link to="/nsigma" className="nav-link">N-Sigma</Link>
          <Link to="/units" className="nav-link">Units</Link>
          <Link to="/assistant" className="nav-link">AI Assistant</Link>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/formula" element={<FormulaCalculator />} />
            <Route path="/matrix" element={<MatrixCalculator />} />
            <Route path="/ode" element={<ODESolver />} />
            <Route path="/integrator" element={<NumericalIntegrator />} />
            <Route path="/fitting" element={<GraphFitting />} />
            <Route path="/nsigma" element={<NSigmaCalculator />} />
            <Route path="/units" element={<UnitConverter />} />
            <Route path="/assistant" element={<AIAssistant />} />
          </Routes>
        </main>

        <footer style={{ textAlign: 'center', padding: '2rem', color: '#666', borderTop: '1px solid #ddd', marginTop: 'auto' }}>
          <p>© 2026 Tau-LY Lab Tools • Built with Flask + React</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
