import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './styles/global.css';

// Feature Components
import Home from './components/Home';
import Workflow from './components/Workflow';
import FormulaCalculator from './components/FormulaCalculator';
import MatrixCalculator from './components/MatrixCalculator';
import ODESolver from './components/ODESolver';
import NumericalIntegrator from './components/NumericalIntegrator';
import GraphFitting from './components/GraphFitting';
import NSigmaCalculator from './components/NSigmaCalculator';
import UnitConverter from './components/UnitConverter';
import FourierAnalysis from './components/FourierAnalysis';
import { AnalysisProvider } from './context/AnalysisContext';
import Sidebar from './components/Sidebar';

function App() {
    return (
        <AnalysisProvider>
            <Router>
                <div className="app-container" style={{ display: 'flex' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                        <header className="header">
                            <Link to="/" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <img src="/tau-ly-icon.png" alt="Tau-LY" className="header-icon" />
                                <h1>Tau-LY Lab Tools</h1>
                            </Link>
                        </header>

                        <nav className="nav-bar">
                            <Link to="/" className="nav-link">Home</Link>
                            <Link to="/workflow" className="nav-link">Workflow</Link>
                            <Link to="/formula" className="nav-link">Formula</Link>
                            <Link to="/matrix" className="nav-link">Matrix</Link>
                            <Link to="/fitting" className="nav-link">Graph & Fitting</Link>
                            <Link to="/ode" className="nav-link">ODE Solver</Link>
                            <Link to="/integrator" className="nav-link">Integrator</Link>
                            <Link to="/nsigma" className="nav-link">N-Sigma</Link>
                            <Link to="/units" className="nav-link">Units</Link>
                            <Link to="/fourier" className="nav-link">Fourier</Link>
                        </nav>

                        <main className="main-content">
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/workflow" element={<Workflow />} />
                                <Route path="/formula" element={<FormulaCalculator />} />
                                <Route path="/matrix" element={<MatrixCalculator />} />
                                <Route path="/ode" element={<ODESolver />} />
                                <Route path="/integrator" element={<NumericalIntegrator />} />
                                <Route path="/fitting" element={<GraphFitting />} />
                                <Route path="/nsigma" element={<NSigmaCalculator />} />
                                <Route path="/units" element={<UnitConverter />} />
                                <Route path="/fourier" element={<FourierAnalysis />} />
                            </Routes>
                        </main>

                        <footer className="footer">
                            <p>© 2026 Tau-LY Lab Tools • All rights reserved to Uri Shulman</p>
                        </footer>
                    </div>
                    <Sidebar />
                </div>
            </Router>
        </AnalysisProvider>
    );
}

export default App;
