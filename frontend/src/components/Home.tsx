import { Link } from 'react-router-dom';
import { useAnalysis } from '../context/AnalysisContext';

const tools = [
    {
        title: 'Lab Workflow',
        desc: 'Complete lab analysis pipeline: upload data, fit curves, propagate uncertainty, and compare results.',
        path: '/workflow',
        icon: '/Workflow.png',
        emoji: '🔬',
        color: '#d32f2f',
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
        title: 'Matrix Calculator',
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
        color: '#c62828',
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
        color: '#e65100',
    },
];

function Home() {
    const { setCurrentTool } = useAnalysis();

    return (
        <div className="home-container">
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                padding: '0 1rem',
            }}>
                {tools.map(tool => (
                    <Link
                        key={tool.path}
                        to={tool.path}
                        onClick={() => setCurrentTool(tool.title)}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                        <div className="tool-card" style={{
                            background: '#fff',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            cursor: 'pointer',
                            borderLeft: `4px solid ${tool.color}`,
                            height: '100%',
                        }}>
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
                                <h3 style={{ margin: 0, color: tool.color }}>{tool.title}</h3>
                            </div>
                            <p style={{ color: '#666', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
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
