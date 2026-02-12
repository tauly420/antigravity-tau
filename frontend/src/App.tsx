import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './styles/global.css';
import MatrixCalculator from './components/MatrixCalculator';
import ODESolver from './components/ODESolver';
import NumericalIntegrator from './components/NumericalIntegrator';
import FormulaCalculator from './components/FormulaCalculator';
import Home from './components/Home';

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="header">
          <h1>Tau-LY Lab Tools</h1>
          <p>Tired of lab work? You came to the right place — clean fits, clear tables, and shareable results.</p>
        </header>

        <nav className="nav-bar">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/formula" className="nav-link">Formula Calculator</Link>
          <Link to="/matrix" className="nav-link">Matrix Calculator</Link>
          <Link to="/ode" className="nav-link">ODE Solver</Link>
          <Link to="/integrator" className="nav-link">Numerical Integrator</Link>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/formula" element={<FormulaCalculator />} />
            <Route path="/matrix" element={<MatrixCalculator />} />
            <Route path="/ode" element={<ODESolver />} />
            <Route path="/integrator" element={<NumericalIntegrator />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
