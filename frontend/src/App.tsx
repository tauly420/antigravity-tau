import { useState } from 'react';
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
import ReportBeta from './components/ReportBeta';
import { AnalysisProvider } from './context/AnalysisContext';
import Sidebar from './components/Sidebar';

const NAV_ITEMS = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/autolab', label: 'AutoLab', icon: '🤖', highlight: true },
    { path: '/workflow', label: 'Workflow', icon: '⚙️' },
    { path: '/formula', label: 'Formula', icon: '📐' },
    { path: '/matrix', label: 'Matrix', icon: '🔢' },
    { path: '/fitting', label: 'Graph & Fitting', icon: '📈' },
    { path: '/ode', label: 'ODE Solver', icon: '∿' },
    { path: '/integrator', label: 'Integrator', icon: '∫' },
    { path: '/nsigma', label: 'N-Sigma', icon: 'σ' },
    { path: '/units', label: 'Units', icon: '📏' },
    { path: '/fourier', label: 'Fourier', icon: '〜' },
    { path: '/statistics', label: 'Statistics', icon: '📊' },
    { path: '/constants', label: 'Constants', icon: '🔬' },
    { path: '/report', label: 'Report', icon: '📄', highlight: true },
];

function NavSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
    const location = useLocation();

    return (
        <nav className={`nav-sidebar ${collapsed ? 'nav-sidebar--collapsed' : ''}`}>
            <button className="nav-sidebar__toggle" onClick={onToggle} title={collapsed ? 'Expand menu' : 'Collapse menu'}>
                {collapsed ? '▶' : '◀'}
            </button>
            <div className="nav-sidebar__links">
                {NAV_ITEMS.map(item => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-sidebar__link ${isActive ? 'nav-sidebar__link--active' : ''} ${item.highlight ? 'nav-sidebar__link--highlight' : ''}`}
                            title={collapsed ? item.label : undefined}
                        >
                            <span className="nav-sidebar__icon">{item.icon}</span>
                            {!collapsed && (
                                <span className="nav-sidebar__label">
                                    {item.label}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

function AppContent() {
    const [navCollapsed, setNavCollapsed] = useState(false);

    return (
        <div className="app-container" style={{ display: 'flex' }}>
            <NavSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(c => !c)} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0 }}>
                <header className="header">
                    <Link to="/" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img src="/tau-ly-icon.png" alt="Tau-LY" className="header-icon" />
                        <h1>Tau-LY Lab Tools</h1>
                    </Link>
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
                        <Route path="/report" element={<ReportBeta />} />
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
