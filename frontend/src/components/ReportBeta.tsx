import { useState } from 'react';

function ReportBeta() {
    const [downloading, setDownloading] = useState(false);

    const handleTestPdf = async () => {
        setDownloading(true);
        try {
            const response = await fetch('/api/report/test-pdf');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (err) {
            alert('Failed to generate test PDF. Make sure the backend is running.');
            console.error(err);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div style={{ maxWidth: 700, margin: '2rem auto', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <h1 style={{ margin: 0 }}>Lab Report Export</h1>
                <span style={{
                    background: 'linear-gradient(135deg, #1565c0, #7b1fa2)',
                    color: 'white',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}>Beta</span>
            </div>

            <div style={{
                background: '#f0f4ff',
                border: '1px solid #c5cae9',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
            }}>
                <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#1565c0' }}>
                    Coming Soon
                </h2>
                <p style={{ margin: '0 0 1rem 0', color: '#444', lineHeight: 1.6 }}>
                    Generate professional academic lab reports from your AutoLab analysis —
                    complete with Hebrew RTL support, LaTeX equations, fitted plots, and
                    uncertainty tables. Upload your data, let AI write the report, review and
                    edit each section, then export as PDF.
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#555', lineHeight: 1.8 }}>
                    <li>AI-generated report sections from your analysis results</li>
                    <li>Hebrew right-to-left layout with inline math equations</li>
                    <li>Section-by-section editing with live LaTeX preview</li>
                    <li>Professional A4 PDF export with bundled fonts</li>
                </ul>
            </div>

            <div style={{
                background: '#fff3e0',
                border: '1px solid #ffe0b2',
                borderRadius: '12px',
                padding: '1.5rem',
            }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#e65100' }}>
                    Infrastructure Preview
                </h3>
                <p style={{ margin: '0 0 1rem 0', color: '#555', lineHeight: 1.6 }}>
                    The PDF rendering engine is ready. Generate a test PDF with Hebrew text
                    and 12 physics equations to see the rendering quality.
                </p>
                <button
                    onClick={handleTestPdf}
                    disabled={downloading}
                    style={{
                        background: downloading ? '#bbb' : '#e65100',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.6rem 1.2rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: downloading ? 'not-allowed' : 'pointer',
                    }}
                >
                    {downloading ? 'Generating...' : 'View Test PDF'}
                </button>
            </div>
        </div>
    );
}

export default ReportBeta;
