import { useEffect } from 'react';
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
import AutoLab from './components/AutoLab';
import StatisticsCalculator from './components/StatisticsCalculator';
import ConstantsReference from './components/ConstantsReference';
import { AnalysisProvider } from './context/AnalysisContext';
import Sidebar from './components/Sidebar';

function App() {
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
    }, []);

    return (
        <AnalysisProvider>
            <Router>
                <div className="app-container" data-theme="dark" style={{ display: 'flex' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                        <header className="header">
                            <Link to="/" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <img src="/tau-ly-icon.png" alt="Tau-LY" className="header-icon" />
                                <h1>Tau-LY Lab Tools</h1>
                            </Link>
                        </header>

                        <nav className="nav-bar">
                            <Link to="/" className="nav-link">Home</Link>
                            <Link to="/autolab" className="nav-link" style={{ background: 'linear-gradient(135deg, #1565c0, #7b1fa2)', color: 'white', borderRadius: '6px', padding: '0.35rem 0.8rem', fontWeight: 700 }}>🤖 AutoLab</Link>
                            <Link to="/workflow" className="nav-link">Workflow</Link>
                            <Link to="/formula" className="nav-link">Formula</Link>
                            <Link to="/matrix" className="nav-link">Matrix</Link>
                            <Link to="/fitting" className="nav-link">Graph & Fitting</Link>
                            <Link to="/ode" className="nav-link">ODE Solver</Link>
                            <Link to="/integrator" className="nav-link">Integrator</Link>
                            <Link to="/nsigma" className="nav-link">N-Sigma</Link>
                            <Link to="/units" className="nav-link">Units</Link>
                            <Link to="/fourier" className="nav-link">Fourier</Link>
                            <Link to="/statistics" className="nav-link">Statistics</Link>
                            <Link to="/constants" className="nav-link">Constants</Link>
                        </nav>

                        <main className="main-content">
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/autolab" element={<AutoLab />} />
                                <Route path="/workflow" element={<Workflow />} />
                                <Route path="/formula" element={<FormulaCalculator />} />
                                <Route path="/matrix" element={<MatrixCalculator />} />
                                <Route path="/ode" element={<ODESolver />} />
                                <Route path="/integrator" element={<NumericalIntegrator />} />
                                <Route path="/fitting" element={<GraphFitting />} />
                                <Route path="/nsigma" element={<NSigmaCalculator />} />
                                <Route path="/units" element={<UnitConverter />} />
                                <Route path="/fourier" element={<FourierAnalysis />} />
                                <Route path="/statistics" element={<StatisticsCalculator />} />
                                <Route path="/constants" element={<ConstantsReference />} />
                            </Routes>
                        </main>

                        <footer className="footer">
                            <p>© 2026 Tau-LY Lab Tools • All rights reserved to <a href="https://www.linkedin.com/in/uri-shulman-5690b2337" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Uri Shulman</a></p>
                            <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                                AI-generated results may contain errors — always verify important calculations independently.
                            </p>
                        </footer>
                    </div>
                    <Sidebar />
                </div>
            </Router>
        </AnalysisProvider>
    );
}

export default App;
