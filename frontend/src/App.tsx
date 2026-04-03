import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
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

const NAV_ITEMS = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/autolab', label: 'AutoLab', icon: '🤖', highlight: true },
    { path: '/workflow', label: 'Workflow', icon: '⚙️' },
    { path: '/formula', label: 'Formula', icon: '📐' },
    { path: '/matrix', label: 'Matrix + System Solver', icon: '🔢' },
    { path: '/fitting', label: 'Graph & Fitting', icon: '📈' },
    { path: '/ode', label: 'ODE Solver', icon: '∿' },
    { path: '/integrator', label: 'Integrator', icon: '∫' },
    { path: '/nsigma', label: 'N-Sigma', icon: 'σ' },
    { path: '/units', label: 'Units', icon: '📏' },
    { path: '/fourier', label: 'Fourier', icon: '〜' },
    { path: '/statistics', label: 'Statistics', icon: '📊' },
    { path: '/constants', label: 'Constants', icon: '🔬' },
];

function AppContent() {
    const location = useLocation();
    const isHome = location.pathname === '/';
    const currentItem = NAV_ITEMS.find(item => item.path === location.pathname);

    return (
        <div className="app-container">
            <header className="header">
                {isHome ? (
                    <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img src="/tau-ly-icon.png" alt="Tau-LY" className="header-icon" />
                        <h1>Tau-LY Lab Tools</h1>
                    </Link>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                        <Link to="/" className="header-back-btn">
                            &#8592; Home
                        </Link>
                        <span className="header-separator">|</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <img src="/tau-ly-icon.png" alt="Tau-LY" className="header-icon" />
                            <h1>Tau-LY &mdash; {currentItem?.label ?? 'Tool'}</h1>
                        </div>
                    </div>
                )}
            </header>

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
                <p>&copy; 2026 Tau-LY Lab Tools &bull; All rights reserved to <a href="https://www.linkedin.com/in/uri-shulman-5690b2337" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Uri Shulman</a></p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    AI-generated results may contain errors — always verify important calculations independently.
                </p>
            </footer>
            <Sidebar />
        </div>
    );
}

function App() {
    return (
        <AnalysisProvider>
            <Router>
                <AppContent />
            </Router>
        </AnalysisProvider>
    );
}

export default App;
