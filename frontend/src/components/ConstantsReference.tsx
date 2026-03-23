import { useState, useEffect } from 'react';
import { useAnalysis } from '../context/AnalysisContext';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface PhysicalConstant {
    name: string;
    symbol: string;
    value: string;
    uncertainty: string;
    units: string;
}

interface Formula {
    name: string;
    equation: string;
    variables: string;
}

interface FormulaCategory {
    category: string;
    formulas: Formula[];
}

function renderKatex(latex: string): string {
    return katex.renderToString(latex, { throwOnError: false });
}

const PHYSICAL_CONSTANTS: PhysicalConstant[] = [
    { name: 'Speed of light in vacuum', symbol: 'c', value: '2.99792458 \u00d7 10\u2078', uncertainty: 'exact', units: 'm/s' },
    { name: 'Planck constant', symbol: 'h', value: '6.62607015 \u00d7 10\u207b\u00b3\u2074', uncertainty: 'exact', units: 'J\u00b7s' },
    { name: 'Reduced Planck constant', symbol: '\u210f', value: '1.054571817 \u00d7 10\u207b\u00b3\u2074', uncertainty: 'exact', units: 'J\u00b7s' },
    { name: 'Boltzmann constant', symbol: 'k_B', value: '1.380649 \u00d7 10\u207b\u00b2\u00b3', uncertainty: 'exact', units: 'J/K' },
    { name: 'Gravitational constant', symbol: 'G', value: '6.67430 \u00d7 10\u207b\u00b9\u00b9', uncertainty: '\u00b1 0.00015 \u00d7 10\u207b\u00b9\u00b9', units: 'm\u00b3 kg\u207b\u00b9 s\u207b\u00b2' },
    { name: 'Standard gravitational acceleration', symbol: 'g', value: '9.80665', uncertainty: 'exact (defined)', units: 'm/s\u00b2' },
    { name: 'Elementary charge', symbol: 'e', value: '1.602176634 \u00d7 10\u207b\u00b9\u2079', uncertainty: 'exact', units: 'C' },
    { name: 'Electron mass', symbol: 'm_e', value: '9.1093837015 \u00d7 10\u207b\u00b3\u00b9', uncertainty: '\u00b1 0.0000000028 \u00d7 10\u207b\u00b3\u00b9', units: 'kg' },
    { name: 'Proton mass', symbol: 'm_p', value: '1.67262192369 \u00d7 10\u207b\u00b2\u2077', uncertainty: '\u00b1 0.00000000051 \u00d7 10\u207b\u00b2\u2077', units: 'kg' },
    { name: 'Neutron mass', symbol: 'm_n', value: '1.67492749804 \u00d7 10\u207b\u00b2\u2077', uncertainty: '\u00b1 0.00000000095 \u00d7 10\u207b\u00b2\u2077', units: 'kg' },
    { name: 'Avogadro constant', symbol: 'N_A', value: '6.02214076 \u00d7 10\u00b2\u00b3', uncertainty: 'exact', units: 'mol\u207b\u00b9' },
    { name: 'Molar gas constant', symbol: 'R', value: '8.314462618', uncertainty: 'exact', units: 'J mol\u207b\u00b9 K\u207b\u00b9' },
    { name: 'Vacuum permittivity', symbol: '\u03b5\u2080', value: '8.8541878128 \u00d7 10\u207b\u00b9\u00b2', uncertainty: '\u00b1 0.0000000013 \u00d7 10\u207b\u00b9\u00b2', units: 'F/m' },
    { name: 'Vacuum permeability', symbol: '\u03bc\u2080', value: '1.25663706212 \u00d7 10\u207b\u2076', uncertainty: '\u00b1 0.00000000019 \u00d7 10\u207b\u2076', units: 'N/A\u00b2' },
    { name: 'Stefan\u2013Boltzmann constant', symbol: '\u03c3', value: '5.670374419 \u00d7 10\u207b\u2078', uncertainty: 'exact', units: 'W m\u207b\u00b2 K\u207b\u2074' },
    { name: 'Rydberg constant', symbol: 'R_\u221e', value: '1.0973731568160 \u00d7 10\u2077', uncertainty: '\u00b1 0.0000000000021 \u00d7 10\u2077', units: 'm\u207b\u00b9' },
    { name: 'Coulomb constant', symbol: 'k_e', value: '8.9875517923 \u00d7 10\u2079', uncertainty: '\u00b1 0.0000000014 \u00d7 10\u2079', units: 'N m\u00b2 C\u207b\u00b2' },
    { name: 'Fine-structure constant', symbol: '\u03b1', value: '7.2973525693 \u00d7 10\u207b\u00b3', uncertainty: '\u00b1 0.0000000011 \u00d7 10\u207b\u00b3', units: 'dimensionless' },
    { name: 'Bohr radius', symbol: 'a\u2080', value: '5.29177210903 \u00d7 10\u207b\u00b9\u00b9', uncertainty: '\u00b1 0.00000000080 \u00d7 10\u207b\u00b9\u00b9', units: 'm' },
    { name: 'Atomic mass unit', symbol: 'u', value: '1.66053906660 \u00d7 10\u207b\u00b2\u2077', uncertainty: '\u00b1 0.00000000050 \u00d7 10\u207b\u00b2\u2077', units: 'kg' },
];

const FORMULA_CATEGORIES: FormulaCategory[] = [
    {
        category: 'Mechanics',
        formulas: [
            { name: "Newton's Second Law", equation: 'F = ma', variables: '$F$: force (N), $m$: mass (kg), $a$: acceleration (m/s\u00b2)' },
            { name: 'Kinetic Energy', equation: 'KE = \\frac{1}{2}mv^2', variables: '$KE$: kinetic energy (J), $m$: mass (kg), $v$: velocity (m/s)' },
            { name: 'Gravitational Potential Energy', equation: 'U = mgh', variables: '$U$: potential energy (J), $m$: mass (kg), $g$: gravitational accel. (m/s\u00b2), $h$: height (m)' },
            { name: 'Work', equation: 'W = \\vec{F} \\cdot \\vec{d} \\cos\\theta', variables: '$W$: work (J), $F$: force (N), $d$: displacement (m), $\\theta$: angle between F and d' },
            { name: 'Momentum', equation: 'p = mv', variables: '$p$: momentum (kg\u00b7m/s), $m$: mass (kg), $v$: velocity (m/s)' },
            { name: 'Centripetal Acceleration', equation: 'a_c = \\frac{v^2}{r}', variables: '$a_c$: centripetal accel. (m/s\u00b2), $v$: speed (m/s), $r$: radius (m)' },
            { name: 'Period of Simple Pendulum', equation: 'T = 2\\pi\\sqrt{\\frac{L}{g}}', variables: '$T$: period (s), $L$: length (m), $g$: gravitational accel. (m/s\u00b2)' },
            { name: 'Hooke\'s Law', equation: 'F = -kx', variables: '$F$: restoring force (N), $k$: spring constant (N/m), $x$: displacement (m)' },
        ],
    },
    {
        category: 'Electricity & Magnetism',
        formulas: [
            { name: "Ohm's Law", equation: 'V = IR', variables: '$V$: voltage (V), $I$: current (A), $R$: resistance (\u03a9)' },
            { name: 'Electrical Power', equation: 'P = IV', variables: '$P$: power (W), $I$: current (A), $V$: voltage (V)' },
            { name: "Coulomb's Law", equation: 'F = k_e \\frac{q_1 q_2}{r^2}', variables: '$F$: force (N), $k_e$: Coulomb constant, $q$: charges (C), $r$: separation (m)' },
            { name: 'Capacitance', equation: 'C = \\frac{Q}{V}', variables: '$C$: capacitance (F), $Q$: charge (C), $V$: voltage (V)' },
            { name: 'Energy in Capacitor', equation: 'U = \\frac{1}{2}CV^2', variables: '$U$: energy (J), $C$: capacitance (F), $V$: voltage (V)' },
            { name: 'Resistors in Series', equation: 'R_{\\text{total}} = R_1 + R_2 + \\cdots', variables: '$R$: resistance (\u03a9)' },
            { name: 'Resistors in Parallel', equation: '\\frac{1}{R_{\\text{total}}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\cdots', variables: '$R$: resistance (\u03a9)' },
        ],
    },
    {
        category: 'Optics',
        formulas: [
            { name: "Snell's Law", equation: 'n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2', variables: '$n$: refractive index, $\\theta$: angle of incidence/refraction' },
            { name: 'Thin Lens Equation', equation: '\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i}', variables: '$f$: focal length, $d_o$: object distance, $d_i$: image distance' },
            { name: 'Magnification', equation: 'M = -\\frac{d_i}{d_o} = \\frac{h_i}{h_o}', variables: '$M$: magnification, $d$: distances, $h$: heights' },
            { name: 'Diffraction Grating', equation: 'd \\sin\\theta = m\\lambda', variables: '$d$: slit spacing, $\\theta$: angle, $m$: order (integer), $\\lambda$: wavelength' },
            { name: 'Photon Energy', equation: 'E = hf = \\frac{hc}{\\lambda}', variables: '$E$: energy (J), $h$: Planck const., $f$: frequency (Hz), $\\lambda$: wavelength (m)' },
        ],
    },
    {
        category: 'Thermodynamics',
        formulas: [
            { name: 'Ideal Gas Law', equation: 'PV = nRT', variables: '$P$: pressure (Pa), $V$: volume (m\u00b3), $n$: amount (mol), $R$: gas constant, $T$: temperature (K)' },
            { name: 'First Law of Thermodynamics', equation: '\\Delta U = Q - W', variables: '$\\Delta U$: internal energy change (J), $Q$: heat added (J), $W$: work done by system (J)' },
            { name: 'Heat Transfer', equation: 'Q = mc\\Delta T', variables: '$Q$: heat (J), $m$: mass (kg), $c$: specific heat (J/kg\u00b7K), $\\Delta T$: temp. change (K)' },
            { name: 'Stefan\u2013Boltzmann Law', equation: 'P = \\varepsilon \\sigma A T^4', variables: '$P$: radiated power (W), $\\varepsilon$: emissivity, $\\sigma$: S\u2013B constant, $A$: area (m\u00b2), $T$: temperature (K)' },
            { name: 'Entropy Change', equation: '\\Delta S = \\frac{Q}{T}', variables: '$\\Delta S$: entropy change (J/K), $Q$: reversible heat (J), $T$: temperature (K)' },
        ],
    },
    {
        category: 'Quantum Mechanics',
        formulas: [
            { name: 'Time-independent Schr\u00f6dinger Equation', equation: '\\hat{H}\\psi = E\\psi', variables: '$\\hat{H}$: Hamiltonian, $\\psi$: wave function, $E$: energy eigenvalue' },
            { name: 'Time-dependent Schr\u00f6dinger Equation', equation: 'i\\hbar\\frac{\\partial \\psi}{\\partial t} = \\hat{H}\\psi', variables: '$i$: imaginary unit, $\\hbar$: reduced Planck const., $\\psi$: wave function, $\\hat{H}$: Hamiltonian' },
            { name: 'de Broglie Wavelength', equation: '\\lambda = \\frac{h}{p}', variables: '$\\lambda$: wavelength, $h$: Planck const., $p$: momentum' },
            { name: 'Heisenberg Uncertainty (position-momentum)', equation: '\\Delta x \\cdot \\Delta p \\geq \\frac{\\hbar}{2}', variables: '$\\Delta x$: position uncertainty, $\\Delta p$: momentum uncertainty, $\\hbar$: reduced Planck const.' },
            { name: 'Heisenberg Uncertainty (energy-time)', equation: '\\Delta E \\cdot \\Delta t \\geq \\frac{\\hbar}{2}', variables: '$\\Delta E$: energy uncertainty, $\\Delta t$: time uncertainty, $\\hbar$: reduced Planck const.' },
            { name: 'Particle in a Box (energy levels)', equation: 'E_n = \\frac{n^2 \\pi^2 \\hbar^2}{2mL^2}', variables: '$n$: quantum number, $m$: mass, $L$: box length, $\\hbar$: reduced Planck const.' },
            { name: 'Hydrogen Atom Energy Levels', equation: 'E_n = -\\frac{13.6 \\text{ eV}}{n^2}', variables: '$E_n$: energy of level $n$, $n$: principal quantum number' },
            { name: 'Bohr Radius', equation: 'a_0 = \\frac{4\\pi\\varepsilon_0 \\hbar^2}{m_e e^2}', variables: '$a_0$: Bohr radius, $\\varepsilon_0$: vacuum permittivity, $m_e$: electron mass, $e$: elementary charge' },
            { name: 'Expectation Value', equation: '\\langle A \\rangle = \\langle \\psi | \\hat{A} | \\psi \\rangle', variables: '$\\langle A \\rangle$: expectation value, $\\hat{A}$: observable operator, $\\psi$: wave function' },
            { name: 'Commutator Relation', equation: '[\\hat{x}, \\hat{p}] = i\\hbar', variables: '$\\hat{x}$: position operator, $\\hat{p}$: momentum operator, $\\hbar$: reduced Planck const.' },
        ],
    },
    {
        category: 'Analytical Mechanics',
        formulas: [
            { name: 'Euler-Lagrange Equation', equation: '\\frac{d}{dt}\\frac{\\partial L}{\\partial \\dot{q}} - \\frac{\\partial L}{\\partial q} = 0', variables: '$L$: Lagrangian, $q$: generalized coordinate, $\\dot{q}$: generalized velocity' },
            { name: 'Lagrangian', equation: 'L = T - V', variables: '$L$: Lagrangian, $T$: kinetic energy, $V$: potential energy' },
            { name: "Hamilton's Equations", equation: '\\dot{q} = \\frac{\\partial H}{\\partial p},\\quad \\dot{p} = -\\frac{\\partial H}{\\partial q}', variables: '$H$: Hamiltonian, $q$: generalized coordinate, $p$: generalized momentum' },
            { name: 'Hamiltonian', equation: 'H = \\sum_i p_i \\dot{q}_i - L', variables: '$H$: Hamiltonian, $p_i$: generalized momenta, $\\dot{q}_i$: generalized velocities, $L$: Lagrangian' },
            { name: 'Action Principle', equation: 'S = \\int_{t_1}^{t_2} L\\, dt', variables: '$S$: action ($\\delta S = 0$ for true path), $L$: Lagrangian' },
            { name: 'Poisson Bracket', equation: '\\{f, g\\} = \\sum_i \\left(\\frac{\\partial f}{\\partial q_i}\\frac{\\partial g}{\\partial p_i} - \\frac{\\partial f}{\\partial p_i}\\frac{\\partial g}{\\partial q_i}\\right)', variables: '$f, g$: functions on phase space, $q_i$: generalized coordinates, $p_i$: generalized momenta' },
            { name: "Noether's Theorem (conserved quantity)", equation: 'Q = \\frac{\\partial L}{\\partial \\dot{q}}\\delta q', variables: '$Q$: conserved quantity, $L$: Lagrangian, $\\delta q$: symmetry variation' },
            { name: 'Small Oscillations', equation: '\\omega^2 = \\frac{V\'\'(q_0)}{m}', variables: "$\\omega$: angular frequency, $V''(q_0)$: second derivative of potential at equilibrium, $m$: mass" },
        ],
    },
    {
        category: 'Astronomy & Astrophysics',
        formulas: [
            { name: "Newton's Law of Gravitation", equation: 'F = \\frac{Gm_1 m_2}{r^2}', variables: '$F$: gravitational force, $G$: gravitational constant, $m_1, m_2$: masses, $r$: separation' },
            { name: "Kepler's Third Law", equation: 'T^2 = \\frac{4\\pi^2}{GM}a^3', variables: '$T$: orbital period, $G$: gravitational constant, $M$: central mass, $a$: semi-major axis' },
            { name: 'Escape Velocity', equation: 'v_e = \\sqrt{\\frac{2GM}{r}}', variables: '$v_e$: escape velocity, $G$: gravitational constant, $M$: mass, $r$: radius' },
            { name: 'Schwarzschild Radius', equation: 'r_s = \\frac{2GM}{c^2}', variables: '$r_s$: Schwarzschild radius, $G$: gravitational constant, $M$: mass, $c$: speed of light' },
            { name: 'Luminosity–Distance Relation', equation: 'F = \\frac{L}{4\\pi d^2}', variables: '$F$: observed flux, $L$: luminosity, $d$: distance' },
            { name: 'Stefan-Boltzmann Law (stars)', equation: 'L = 4\\pi R^2 \\sigma T^4', variables: '$L$: luminosity, $R$: stellar radius, $\\sigma$: Stefan-Boltzmann const., $T$: surface temperature' },
            { name: "Wien's Displacement Law", equation: '\\lambda_{\\max} = \\frac{b}{T}', variables: '$\\lambda_{\\max}$: peak wavelength, $b = 2.898 \\times 10^{-3}$ m K, $T$: temperature' },
            { name: 'Hubble\'s Law', equation: 'v = H_0 d', variables: '$v$: recession velocity, $H_0$: Hubble constant, $d$: distance' },
            { name: 'Gravitational Potential Energy (orbital)', equation: 'U = -\\frac{GMm}{r}', variables: '$U$: potential energy, $G$: gravitational constant, $M, m$: masses, $r$: separation' },
            { name: 'Vis-viva Equation', equation: 'v^2 = GM\\left(\\frac{2}{r} - \\frac{1}{a}\\right)', variables: '$v$: orbital speed, $G$: gravitational constant, $M$: central mass, $r$: distance, $a$: semi-major axis' },
        ],
    },
];

const CATEGORY_EMOJI: Record<string, string> = {
    'Mechanics': '\u2699\ufe0f',
    'Electricity & Magnetism': '\u26a1',
    'Optics': '\ud83d\udd2d',
    'Thermodynamics': '\ud83c\udf21\ufe0f',
    'Quantum Mechanics': '\u269b\ufe0f',
    'Analytical Mechanics': '\ud83d\udcd0',
    'Astronomy & Astrophysics': '\ud83c\udf1f',
};

function renderVariablesWithKatex(text: string): string {
    // Replace $...$ with KaTeX rendered HTML
    return text.replace(/\$([^$]+)\$/g, (_match, latex) => {
        return renderKatex(latex);
    });
}

function ConstantsReference() {
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'constants' | 'formulas'>('constants');
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const { setCurrentTool } = useAnalysis();

    useEffect(() => {
        setCurrentTool('Constants');
    }, []);

    const filteredConstants = PHYSICAL_CONSTANTS.filter((c) => {
        const q = search.toLowerCase();
        return (
            c.name.toLowerCase().includes(q) ||
            c.symbol.toLowerCase().includes(q) ||
            c.units.toLowerCase().includes(q)
        );
    });

    const filteredFormulas = FORMULA_CATEGORIES.map((cat) => ({
        ...cat,
        formulas: cat.formulas.filter((f) => {
            const q = search.toLowerCase();
            return (
                f.name.toLowerCase().includes(q) ||
                f.equation.toLowerCase().includes(q) ||
                f.variables.toLowerCase().includes(q)
            );
        }),
    })).filter((cat) => cat.formulas.length > 0);

    const handleCopy = (value: string, index: number) => {
        navigator.clipboard.writeText(value).then(() => {
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 1500);
        });
    };

    return (
        <div className="card" style={{ maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={{ textAlign: 'center', marginBottom: 4 }}>
                📚 Physics Constants & Equations Reference
            </h2>
            <p style={{ textAlign: 'center', color: '#666', marginTop: 0, marginBottom: 20, fontSize: 14 }}>
                Essential physical constants and common lab formulas at your fingertips
            </p>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
                <input
                    type="text"
                    placeholder="Search by name, symbol, or keyword\u2026"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '10px 14px',
                        fontSize: 15,
                        borderRadius: 6,
                        border: '1px solid #ccc',
                        boxSizing: 'border-box',
                    }}
                />
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e0e0e0', marginBottom: 20 }}>
                <button
                    onClick={() => setActiveTab('constants')}
                    style={{
                        padding: '10px 24px',
                        fontSize: 15,
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'constants' ? '3px solid #c62828' : '3px solid transparent',
                        fontWeight: activeTab === 'constants' ? 700 : 400,
                        color: activeTab === 'constants' ? '#c62828' : '#555',
                        marginBottom: -2,
                    }}
                >
                    Physical Constants
                </button>
                <button
                    onClick={() => setActiveTab('formulas')}
                    style={{
                        padding: '10px 24px',
                        fontSize: 15,
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'formulas' ? '3px solid #c62828' : '3px solid transparent',
                        fontWeight: activeTab === 'formulas' ? 700 : 400,
                        color: activeTab === 'formulas' ? '#c62828' : '#555',
                        marginBottom: -2,
                    }}
                >
                    Common Lab Formulas
                </button>
            </div>

            {/* Constants Tab */}
            {activeTab === 'constants' && (
                <div style={{ overflowX: 'auto' }}>
                    <table
                        style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: 14,
                        }}
                    >
                        <thead>
                            <tr style={{ backgroundColor: '#e3f2fd' }}>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Symbol</th>
                                <th style={thStyle}>Value</th>
                                <th style={thStyle}>Uncertainty</th>
                                <th style={thStyle}>Units</th>
                                <th style={{ ...thStyle, width: 50 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredConstants.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                                        No constants match your search.
                                    </td>
                                </tr>
                            ) : (
                                filteredConstants.map((c, i) => (
                                    <tr
                                        key={i}
                                        style={{
                                            borderBottom: '1px solid #e0e0e0',
                                            backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa',
                                        }}
                                    >
                                        <td style={tdStyle}>{c.name}</td>
                                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600, color: '#1565c0' }}>
                                            {c.symbol}
                                        </td>
                                        <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{c.value}</td>
                                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: '#777' }}>
                                            {c.uncertainty}
                                        </td>
                                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 13 }}>{c.units}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleCopy(c.value, i)}
                                                title="Copy value"
                                                style={{
                                                    background: 'none',
                                                    border: '1px solid #ccc',
                                                    borderRadius: 4,
                                                    padding: '2px 8px',
                                                    cursor: 'pointer',
                                                    fontSize: 13,
                                                    color: copiedIndex === i ? '#2e7d32' : '#555',
                                                }}
                                            >
                                                {copiedIndex === i ? '\u2713' : '\ud83d\udccb'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    <p style={{ fontSize: 12, color: '#999', marginTop: 12 }}>
                        Values from CODATA 2018 recommended values. Constants marked "exact" have defined values with zero uncertainty.
                    </p>
                </div>
            )}

            {/* Formulas Tab */}
            {activeTab === 'formulas' && (
                <div>
                    {filteredFormulas.length === 0 ? (
                        <p style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                            No formulas match your search.
                        </p>
                    ) : (
                        filteredFormulas.map((cat) => (
                            <div key={cat.category} style={{ marginBottom: 28 }}>
                                <h3
                                    style={{
                                        color: 'var(--primary)',
                                        borderBottom: '2px solid #e0e0e0',
                                        paddingBottom: 6,
                                        marginBottom: 12,
                                        fontSize: 17,
                                    }}
                                >
                                    {CATEGORY_EMOJI[cat.category] || ''} {cat.category}
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {cat.formulas.map((f, j) => (
                                        <div
                                            key={j}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 2,
                                                padding: '10px 14px',
                                                borderRadius: 6,
                                                backgroundColor: j % 2 === 0 ? '#fafafa' : '#fff',
                                                border: '1px solid #eee',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</span>
                                                <span
                                                    style={{
                                                        fontSize: 18,
                                                        color: '#000',
                                                        fontWeight: 700,
                                                    }}
                                                    dangerouslySetInnerHTML={{ __html: renderKatex(f.equation) }}
                                                />
                                            </div>
                                            <div
                                                style={{ fontSize: 12, color: '#666', marginTop: 2 }}
                                                dangerouslySetInnerHTML={{ __html: renderVariablesWithKatex(f.variables) }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 12px',
    fontWeight: 600,
    fontSize: 13,
    color: '#333',
    whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    verticalAlign: 'middle',
};

export default ConstantsReference;
