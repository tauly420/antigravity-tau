function Home() {
    return (
        <div className="card">
            <h2>Welcome to Tau-LY Lab Tools</h2>
            <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                A comprehensive suite of computational tools for laboratory work and scientific calculations.
            </p>

            <div className="grid grid-2" style={{ marginTop: '2rem' }}>
                <div>
                    <h3>📊 Available Tools</h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                            <strong>Formula Calculator</strong> - Evaluate expressions with uncertainty propagation
                        </li>
                        <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                            <strong>Matrix Calculator</strong> ✨ NEW - Operations, systems, eigenvalues (up to 5×5)
                        </li>
                        <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                            <strong>ODE Solver</strong> ✨ NEW - Solve first and higher-order ODEs
                        </li>
                        <li style={{ padding: '0.5rem 0' }}>
                            <strong>Numerical Integrator</strong> ✨ NEW - 1D, 2D, and multi-dimensional integration
                        </li>
                    </ul>
                </div>

                <div>
                    <h3>🚀 New Features</h3>
                    <div className="result-box">
                        <p><strong>Matrix Calculator</strong></p>
                        <p style={{ fontSize: '0.95rem', marginTop: '0.5rem' }}>
                            Perform matrix operations, solve systems of equations up to 5×5, calculate determinants,
                            LU decomposition, and find eigenvalues using efficient scipy algorithms.
                        </p>
                    </div>
                    <div className="result-box">
                        <p><strong>ODE Solver</strong></p>
                        <p style={{ fontSize: '0.95rem', marginTop: '0.5rem' }}>
                            Solve ordinary differential equations of any order using scipy's powerful integrators.
                            Support for stiff and non-stiff problems with multiple solution methods.
                        </p>
                    </div>
                    <div className="result-box">
                        <p><strong>Numerical Integrator</strong></p>
                        <p style={{ fontSize: '0.95rem', marginTop: '0.5rem' }}>
                            Compute integrals numerically in 1D (with divergence detection) and higher dimensions
                            using Monte Carlo methods for complex regions.
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
                <p style={{ margin: 0 }}>
                    <strong>Note:</strong> This application has been migrated from Streamlit to a modern Flask + React
                    architecture for better performance and extensibility.
                </p>
            </div>
        </div>
    );
}

export default Home;
