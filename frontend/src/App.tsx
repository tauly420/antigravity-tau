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
