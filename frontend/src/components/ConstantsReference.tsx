import { useState, useEffect } from 'react';
import { useAnalysis } from '../context/AnalysisContext';

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
            { name: "Newton's Second Law", equation: 'F = ma', variables: 'F: force (N), m: mass (kg), a: acceleration (m/s\u00b2)' },
            { name: 'Kinetic Energy', equation: 'KE = \u00bdmv\u00b2', variables: 'KE: kinetic energy (J), m: mass (kg), v: velocity (m/s)' },
            { name: 'Gravitational Potential Energy', equation: 'U = mgh', variables: 'U: potential energy (J), m: mass (kg), g: gravitational accel. (m/s\u00b2), h: height (m)' },
            { name: 'Work', equation: 'W = F\u00b7d\u00b7cos\u03b8', variables: 'W: work (J), F: force (N), d: displacement (m), \u03b8: angle between F and d' },
            { name: 'Momentum', equation: 'p = mv', variables: 'p: momentum (kg\u00b7m/s), m: mass (kg), v: velocity (m/s)' },
            { name: 'Centripetal Acceleration', equation: 'a_c = v\u00b2/r', variables: 'a_c: centripetal accel. (m/s\u00b2), v: speed (m/s), r: radius (m)' },
            { name: 'Period of Simple Pendulum', equation: 'T = 2\u03c0\u221a(L/g)', variables: 'T: period (s), L: length (m), g: gravitational accel. (m/s\u00b2)' },
            { name: 'Hooke\'s Law', equation: 'F = \u2212kx', variables: 'F: restoring force (N), k: spring constant (N/m), x: displacement (m)' },
        ],
    },
    {
        category: 'Electricity & Magnetism',
        formulas: [
            { name: "Ohm's Law", equation: 'V = IR', variables: 'V: voltage (V), I: current (A), R: resistance (\u03a9)' },
            { name: 'Electrical Power', equation: 'P = IV', variables: 'P: power (W), I: current (A), V: voltage (V)' },
            { name: "Coulomb's Law", equation: 'F = k_e \u00b7 q\u2081q\u2082 / r\u00b2', variables: 'F: force (N), k_e: Coulomb constant, q: charges (C), r: separation (m)' },
            { name: 'Capacitance', equation: 'C = Q/V', variables: 'C: capacitance (F), Q: charge (C), V: voltage (V)' },
            { name: 'Energy in Capacitor', equation: 'U = \u00bdCV\u00b2', variables: 'U: energy (J), C: capacitance (F), V: voltage (V)' },
            { name: 'Resistors in Series', equation: 'R_total = R\u2081 + R\u2082 + \u2026', variables: 'R: resistance (\u03a9)' },
            { name: 'Resistors in Parallel', equation: '1/R_total = 1/R\u2081 + 1/R\u2082 + \u2026', variables: 'R: resistance (\u03a9)' },
        ],
    },
    {
        category: 'Optics',
        formulas: [
            { name: "Snell's Law", equation: 'n\u2081 sin\u03b8\u2081 = n\u2082 sin\u03b8\u2082', variables: 'n: refractive index, \u03b8: angle of incidence/refraction' },
            { name: 'Thin Lens Equation', equation: '1/f = 1/d_o + 1/d_i', variables: 'f: focal length, d_o: object distance, d_i: image distance' },
            { name: 'Magnification', equation: 'M = \u2212d_i / d_o = h_i / h_o', variables: 'M: magnification, d: distances, h: heights' },
            { name: 'Diffraction Grating', equation: 'd sin\u03b8 = m\u03bb', variables: 'd: slit spacing, \u03b8: angle, m: order (integer), \u03bb: wavelength' },
            { name: 'Photon Energy', equation: 'E = hf = hc/\u03bb', variables: 'E: energy (J), h: Planck const., f: frequency (Hz), \u03bb: wavelength (m)' },
        ],
    },
    {
        category: 'Thermodynamics',
        formulas: [
            { name: 'Ideal Gas Law', equation: 'PV = nRT', variables: 'P: pressure (Pa), V: volume (m\u00b3), n: amount (mol), R: gas constant, T: temperature (K)' },
            { name: 'First Law of Thermodynamics', equation: '\u0394U = Q \u2212 W', variables: '\u0394U: internal energy change (J), Q: heat added (J), W: work done by system (J)' },
            { name: 'Heat Transfer', equation: 'Q = mc\u0394T', variables: 'Q: heat (J), m: mass (kg), c: specific heat (J/kg\u00b7K), \u0394T: temp. change (K)' },
            { name: 'Stefan\u2013Boltzmann Law', equation: 'P = \u03b5\u03c3AT\u2074', variables: 'P: radiated power (W), \u03b5: emissivity, \u03c3: S\u2013B constant, A: area (m\u00b2), T: temperature (K)' },
            { name: 'Entropy Change', equation: '\u0394S = Q/T', variables: '\u0394S: entropy change (J/K), Q: reversible heat (J), T: temperature (K)' },
        ],
    },
];

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
                \ud83d\udcda Physics Constants & Equations Reference
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
                                        color: '#c62828',
                                        borderBottom: '2px solid #e0e0e0',
                                        paddingBottom: 6,
                                        marginBottom: 12,
                                        fontSize: 17,
                                    }}
                                >
                                    {cat.category}
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
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                <span style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</span>
                                                <span
                                                    style={{
                                                        fontFamily: 'monospace',
                                                        fontSize: 16,
                                                        color: '#1565c0',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {f.equation}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                                                {f.variables}
                                            </div>
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
