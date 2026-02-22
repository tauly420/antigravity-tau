import { useState, useEffect } from 'react';
import * as api from '../services/api';

function UnitConverter() {
    const [value, setValue] = useState<string>('1');
    const [fromUnit, setFromUnit] = useState<string>('meter');
    const [toUnit, setToUnit] = useState<string>('foot');
    const [category, setCategory] = useState<string>('length'); // Default category
    const [categories, setCategories] = useState<Record<string, string[]>>({});
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const data = await api.getUnitCategories();
                setCategories(data);
                // Ensure defaults are valid
                if (data && data.length && data.length.length > 0) {
                    // kept default logic simple
                }
            } catch (err) {
                console.error('Failed to fetch unit categories', err);
            }
        };
        fetchCategories();
    }, []);

    const handleConvert = async () => {
        setError('');
        // setResult(null); // Keep previous result while loading feels faster
        setLoading(true);

        try {
            const val = parseFloat(value);
            if (isNaN(val)) throw new Error('Invalid value');

            const response = await api.convertUnits({
                value: val,
                from_unit: fromUnit,
                to_unit: toUnit
            });

            setResult(response);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Conversion failed');
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    // Trigger conversion automatically on change
    useEffect(() => {
        if (value && fromUnit && toUnit) {
            const timer = setTimeout(() => handleConvert(), 500);
            return () => clearTimeout(timer);
        }
    }, [value, fromUnit, toUnit]);

    // Update units when category changes
    const handleCategoryChange = (newCategory: string) => {
        setCategory(newCategory);
        const units = categories[newCategory] || [];
        if (units.length >= 2) {
            setFromUnit(units[0]);
            setToUnit(units[1]);
        } else if (units.length === 1) {
            setFromUnit(units[0]);
            setToUnit(units[0]);
        }
    };

    const currentUnits = categories[category] || [];

    return (
        <div className="card">
            <h2>Unit Converter</h2>

            <div className="form-group">
                <label>Category</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {Object.keys(categories).map(cat => (
                        <button
                            key={cat}
                            onClick={() => handleCategoryChange(cat)}
                            className={category === cat ? 'active' : ''}
                            style={{
                                flex: 1,
                                background: category === cat ? 'var(--primary)' : 'white',
                                color: category === cat ? 'white' : 'var(--text)',
                                borderColor: category === cat ? 'var(--primary)' : '#ddd',
                                padding: '0.5rem',
                                fontSize: '0.9rem'
                            }}
                        >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-2" style={{ alignItems: 'end' }}>
                <div className="form-group">
                    <label>From</label>
                    <input
                        type="number"
                        step="any"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        style={{ marginBottom: '0.5rem' }}
                    />
                    <select value={fromUnit} onChange={(e) => setFromUnit(e.target.value)}>
                        {currentUnits.map(u => (
                            <option key={u} value={u}>{u.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>To {loading && <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'normal' }}>(Converting...)</span>}</label>
                    <div style={{
                        padding: '0.75rem',
                        background: '#f5f5f5',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        marginBottom: '0.5rem',
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        color: 'var(--primary)'
                    }}>
                        {result ? Number(result.result).toLocaleString(undefined, { maximumSignificantDigits: 10 }) : '...'}
                    </div>
                    <select value={toUnit} onChange={(e) => setToUnit(e.target.value)}>
                        {currentUnits.map(u => (
                            <option key={u} value={u}>{u.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                </div>
            </div>

            {result && (
                <div style={{ textAlign: 'center', marginTop: '2rem', color: '#666' }}>
                    <p style={{ fontSize: '1rem' }}>
                        {value} {fromUnit.replace(/_/g, ' ')} =
                        <strong> {Number(result.result).toLocaleString()} </strong>
                        {toUnit.replace(/_/g, ' ')}
                    </p>
                </div>
            )}

            {error && <div className="error-message">{error}</div>}
        </div>
    );
}

export default UnitConverter;
