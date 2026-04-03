import { Link } from 'react-router-dom';
import { useAnalysis } from '../context/AnalysisContext';

const tools = [
    {
        title: 'Lab Workflow',
        desc: 'Complete lab analysis pipeline: upload data, fit curves, propagate uncertainty, and compare results.',
        path: '/workflow',
        icon: '/Workflow.png',
        emoji: '🔬',
        color: '#1565c0',
    },
    {
        title: 'Graph Fitting',
        desc: 'Upload data and fit curves with various models. Visualize results with residual plots.',
        path: '/fitting',
        icon: '/graph.png',
        emoji: '📈',
        color: '#1976d2',
    },
    {
        title: 'Formula Calculator',
        desc: 'Evaluate expressions with automatic variable detection and uncertainty propagation.',
        path: '/formula',
        icon: '/formula_panel.png',
        emoji: '🧮',
        color: '#388e3c',
    },
    {
        title: 'N-σ Calculator',
        desc: 'Compare two measurements and determine the N-sigma agreement level.',
        path: '/nsigma',
        icon: '/N-sigma.png',
        emoji: '📊',
        color: '#f57c00',
    },
    {
        title: 'Matrix + System of Equation Solver',
        desc: 'Perform matrix operations, solve systems, compute eigenvalues and determinants.',
        path: '/matrix',
        icon: '',
        emoji: '🔢',
        color: '#7b1fa2',
    },
    {
        title: 'ODE Solver',
        desc: 'Solve ordinary differential equations numerically with phase portraits.',
        path: '/ode',
        icon: '',
        emoji: '🌊',
        color: '#00796b',
    },
    {
        title: 'Numerical Integration',
        desc: 'Compute definite integrals and visualize the area under the curve.',
        path: '/integrator',
        icon: '',
        emoji: '∫',
        color: '#1976d2',
    },
    {
        title: 'Unit Converter',
        desc: 'Convert between SI, CGS, imperial, and more across 15+ categories.',
        path: '/units',
        icon: '/unit_conversion.png',
        emoji: '⚖️',
        color: '#1565c0',
    },
    {
        title: 'Fourier Analysis',
        desc: 'DFT amplitude spectrum, PSD, dominant frequency detection, and inverse DFT with filtering.',
        path: '/fourier',
        icon: '',
        emoji: '〰️',
        color: '#ef6c00',
    },
    {
        title: 'Statistics Calculator',
        desc: 'Enter repeated measurements to get mean, standard deviation, standard error, and histogram visualization.',
        path: '/statistics',
        icon: '',
        emoji: '📊',
        color: '#2e7d32',
    },
    {
        title: 'Constants Reference',
        desc: 'Quick reference for physical constants and common lab formulas with copy-to-clipboard.',
        path: '/constants',
        icon: '',
        emoji: '📚',
        color: '#5d4037',
    },
];

function Home() {
    const { setCurrentTool } = useAnalysis();

    return (
        <div className="home-container">
            {/* Section 1: Intro */}
            <section className="home-intro">
                <h2>Your Physics Lab, Automated</h2>
                <p>
                    Tau-LY gives physics and engineering students a complete toolkit
                    for lab work &mdash; from curve fitting and uncertainty propagation
                    to AI-driven analysis that turns raw data into publication-ready results.
                </p>
            </section>

            {/* Section 2: AutoLab Hero Card */}
            <Link
                to="/autolab"
                onClick={() => setCurrentTool('AutoLab')}
                className="home-hero-link"
            >
                <div className="home-hero-card">
                    <div className="home-hero-icon">🤖</div>
                    <div className="home-hero-content">
                        <h2>AutoLab</h2>
                        <p>
                            Upload your data, describe what you need in plain language,
                            and get a complete physics analysis &mdash; fit parameters,
                            uncertainties, plots, and comparison to theory.
                        </p>
                        <span className="home-hero-cta">
                            Start Analysis &rarr;
                        </span>
                    </div>
                </div>
            </Link>

            {/* Section 3: Tool Grid */}
            <h3 className="home-tools-heading">More Tools</h3>
            <div className="home-tools-grid">
                {tools.map(tool => (
                    <Link
                        key={tool.path}
                        to={tool.path}
                        onClick={() => setCurrentTool(tool.title)}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                        <div className="tool-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                {tool.icon ? (
                                    <img
                                        src={tool.icon}
                                        alt={tool.title}
                                        style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '6px' }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            const next = (e.target as HTMLImageElement).nextElementSibling;
                                            if (next) (next as HTMLElement).style.display = 'flex';
                                        }}
                                    />
                                ) : null}
                                <span className="tool-emoji" style={{
                                    display: tool.icon ? 'none' : 'flex',
                                    width: '40px', height: '40px',
                                    alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.6rem',
                                    background: `${tool.color}15`,
                                    borderRadius: '8px',
                                    flexShrink: 0,
                                }}>{tool.emoji}</span>
                                <h3 style={{ margin: 0, color: 'var(--text)' }}>{tool.title}</h3>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                                {tool.desc}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default Home;
