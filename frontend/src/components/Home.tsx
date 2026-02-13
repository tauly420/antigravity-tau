import { Link } from 'react-router-dom';

function Home() {
    const tools = [
        {
            title: 'Guided Workflow',
            path: '/workflow',
            icon: '🚀',
            description: 'Step-by-step analysis: Upload -> Fit -> Formula -> N-Sigma',
            color: '#2979ff'
        },
        {
            title: 'Formula Calculator',
            path: '/formula',
            icon: '🧮',
            description: 'Evaluate expressions with automatic uncertainty propagation',
            color: '#e53935'
        },
        {
            title: 'Matrix Calculator',
            path: '/matrix',
            icon: '🔢',
            description: 'Operations, systems, determinants, and eigenvalues (up to 5×5)',
            color: '#1e88e5'
        },
        {
            title: 'ODE Solver',
            path: '/ode',
            icon: '📈',
            description: 'Solve first and higher-order ordinary differential equations',
            color: '#43a047'
        },
        {
            title: 'Numerical Integrator',
            path: '/integrator',
            icon: '∫',
            description: '1D and multi-dimensional integration with Monte Carlo support',
            color: '#fb8c00'
        },
        {
            title: 'Graph & Fitting',
            path: '/fitting',
            icon: '📊',
            description: 'Plot data and fit curves with uncertainty analysis',
            color: '#8e24aa'
        },
        {
            title: 'N-Sigma Calculator',
            path: '/nsigma',
            icon: '📏',
            description: 'Calculate statistical significance between measurements',
            color: '#00acc1'
        },
        {
            title: 'Unit Converter',
            path: '/units',
            icon: '⚖️',
            description: 'Convert between length, mass, time, and temperature units',
            color: '#546e7a'
        },
        {
            title: 'AI Assistant',
            path: '/assistant',
            icon: '🤖',
            description: 'Get help with calculations and lab data analysis',
            color: '#3949ab'
        }
    ];

    return (
        <div className="home-container">
            <div className="hero-section" style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>
                    Tau-LY Lab Tools
                </h1>
                <p style={{ fontSize: '1.2rem', color: '#666', maxWidth: '800px', margin: '0 auto' }}>
                    Comprehensive computational suite for laboratory work: from basic calculations to advanced simulations.
                </p>
            </div>

            <div className="tools-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                padding: '0 1rem'
            }}>
                {tools.map((tool) => (
                    <Link
                        to={tool.path}
                        key={tool.path}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                        <div className="tool-card" style={{
                            background: 'white',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            height: '100%',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                            border: '1px solid #eee',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            cursor: 'pointer'
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            }}
                        >
                            <div style={{
                                fontSize: '3rem',
                                marginBottom: '1rem',
                                background: `${tool.color}15`,
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {tool.icon}
                            </div>
                            <h3 style={{ marginBottom: '0.5rem', color: tool.color }}>{tool.title}</h3>
                            <p style={{ fontSize: '0.9rem', color: '#666', lineHeight: '1.5' }}>
                                {tool.description}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default Home;
