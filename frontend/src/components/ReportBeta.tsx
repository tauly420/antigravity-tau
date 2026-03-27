import { useState, useRef } from 'react';
import { uploadInstructionFile, ContextForm } from '../services/api';

function ReportBeta() {
    const [downloading, setDownloading] = useState(false);
    const [instructionText, setInstructionText] = useState('');
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [uploadWarning, setUploadWarning] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [contextForm, setContextForm] = useState<ContextForm>({
        title: '', subject: '', equipment: '', notes: ''
    });
    const [language, setLanguage] = useState<'he' | 'en'>('he');

    // Track focus state for input border color
    const [focusedField, setFocusedField] = useState<string | null>(null);
    // Track hover state for generate button
    const [generateHovered, setGenerateHovered] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadStatus('uploading');
        setUploadWarning(null);
        try {
            const result = await uploadInstructionFile(file);
            if (result.error) {
                setUploadStatus('error');
                setUploadWarning(result.error);
            } else {
                setInstructionText(result.text);
                setUploadStatus('done');
                if (result.warning) setUploadWarning(result.warning);
            }
        } catch {
            setUploadStatus('error');
            setUploadWarning('Failed to upload file. Make sure the backend is running.');
        }
    };

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

    const inputStyle = (fieldName: string): React.CSSProperties => ({
        border: `1.5px solid ${focusedField === fieldName ? 'var(--primary, #1565c0)' : 'var(--border, #e0e0e0)'}`,
        borderRadius: '8px',
        padding: '16px',
        background: 'var(--surface, #ffffff)',
        fontSize: '0.875rem',
        width: '100%',
        boxSizing: 'border-box' as const,
        fontFamily: 'inherit',
    });

    const hasAnyContext = instructionText.trim() !== '' ||
        contextForm.title.trim() !== '' ||
        contextForm.subject.trim() !== '' ||
        contextForm.equipment.trim() !== '' ||
        contextForm.notes.trim() !== '';

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

            {/* Lab Instructions Upload Section */}
            <div style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--border, #e0e0e0)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '32px',
            }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text, #1a1a2e)' }}>
                    Lab Instructions
                </h2>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                    Upload your lab instruction file (PDF or Word) to provide context for report generation
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadStatus === 'uploading'}
                    style={{
                        background: uploadStatus === 'uploading' ? '#bbb' : 'var(--surface-alt, #f4f5f9)',
                        color: 'var(--text, #1a1a2e)',
                        border: '1.5px dashed var(--border, #e0e0e0)',
                        borderRadius: '8px',
                        padding: '16px 24px',
                        fontSize: '0.875rem',
                        cursor: uploadStatus === 'uploading' ? 'not-allowed' : 'pointer',
                        width: '100%',
                    }}
                >
                    {uploadStatus === 'uploading' ? 'Uploading...' : uploadStatus === 'done' ? 'File uploaded — click to replace' : 'Click to upload instruction file (PDF, Word)'}
                </button>
                {uploadWarning && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.875rem', color: uploadStatus === 'error' ? 'var(--danger, #d32f2f)' : 'var(--warning, #f57c00)' }}>
                        {uploadWarning}
                    </p>
                )}
                {instructionText && (
                    <div style={{ marginTop: '16px' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text, #1a1a2e)', marginBottom: '4px', display: 'block' }}>
                            Extracted Text
                        </label>
                        <textarea
                            value={instructionText}
                            onChange={(e) => setInstructionText(e.target.value)}
                            rows={6}
                            style={{
                                ...inputStyle('instructionText'),
                                resize: 'vertical' as const,
                            }}
                            onFocus={() => setFocusedField('instructionText')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </div>
                )}
            </div>

            {/* Experiment Context Form */}
            <div style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--border, #e0e0e0)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '32px',
            }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text, #1a1a2e)' }}>
                    Experiment Context
                </h2>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                    Provide details to help AI generate your report
                </p>

                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
                    {/* Experiment Title */}
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text, #1a1a2e)', marginBottom: '4px', display: 'block' }}>
                            Experiment Title
                        </label>
                        <input
                            type="text"
                            value={contextForm.title}
                            onChange={(e) => setContextForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g., Hooke's Law -- Measuring Spring Constant"
                            style={inputStyle('title')}
                            onFocus={() => setFocusedField('title')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </div>

                    {/* Subject Area */}
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text, #1a1a2e)', marginBottom: '4px', display: 'block' }}>
                            Subject Area
                        </label>
                        <input
                            type="text"
                            value={contextForm.subject}
                            onChange={(e) => setContextForm(prev => ({ ...prev, subject: e.target.value }))}
                            placeholder="e.g., Mechanics, Optics, Thermodynamics"
                            style={inputStyle('subject')}
                            onFocus={() => setFocusedField('subject')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </div>

                    {/* Equipment Used */}
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text, #1a1a2e)', marginBottom: '4px', display: 'block' }}>
                            Equipment Used
                        </label>
                        <textarea
                            rows={3}
                            value={contextForm.equipment}
                            onChange={(e) => setContextForm(prev => ({ ...prev, equipment: e.target.value }))}
                            placeholder="e.g., Spring, masses (50-500g), ruler, force sensor"
                            style={{
                                ...inputStyle('equipment'),
                                resize: 'vertical' as const,
                            }}
                            onFocus={() => setFocusedField('equipment')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </div>

                    {/* Additional Notes */}
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text, #1a1a2e)', marginBottom: '4px', display: 'block' }}>
                            Additional Notes
                        </label>
                        <textarea
                            rows={4}
                            value={contextForm.notes}
                            onChange={(e) => setContextForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Any specific requirements, formulas to include, or details about your experiment..."
                            style={{
                                ...inputStyle('notes'),
                                resize: 'vertical' as const,
                            }}
                            onFocus={() => setFocusedField('notes')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </div>
                </div>
            </div>

            {/* Language Toggle */}
            <div style={{ marginBottom: '16px' }}>
                <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                    <legend style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text, #1a1a2e)', marginBottom: '8px', display: 'block', padding: 0 }}>
                        Report Language
                    </legend>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <label style={{
                            background: language === 'he' ? 'var(--primary, #1565c0)' : 'var(--surface-alt, #f4f5f9)',
                            color: language === 'he' ? 'white' : 'var(--text, #1a1a2e)',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            cursor: 'pointer',
                            border: 'none',
                            fontWeight: language === 'he' ? 500 : 400,
                            fontSize: '0.875rem',
                        }}>
                            <input
                                type="radio"
                                name="report-language"
                                value="he"
                                checked={language === 'he'}
                                onChange={() => setLanguage('he')}
                                style={{ display: 'none' }}
                            />
                            Hebrew
                        </label>
                        <label style={{
                            background: language === 'en' ? 'var(--primary, #1565c0)' : 'var(--surface-alt, #f4f5f9)',
                            color: language === 'en' ? 'white' : 'var(--text, #1a1a2e)',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            cursor: 'pointer',
                            border: 'none',
                            fontWeight: language === 'en' ? 500 : 400,
                            fontSize: '0.875rem',
                        }}>
                            <input
                                type="radio"
                                name="report-language"
                                value="en"
                                checked={language === 'en'}
                                onChange={() => setLanguage('en')}
                                style={{ display: 'none' }}
                            />
                            English
                        </label>
                    </div>
                </fieldset>
            </div>

            {/* Generate Report Button — Focal Point */}
            <button
                onClick={() => {}}
                disabled={!hasAnyContext}
                onMouseEnter={() => setGenerateHovered(true)}
                onMouseLeave={() => setGenerateHovered(false)}
                style={{
                    width: '100%',
                    background: !hasAnyContext ? '#bbb' : 'linear-gradient(135deg, var(--primary, #1565c0) 0%, #1976d2 100%)',
                    color: 'white',
                    fontSize: '1rem',
                    fontWeight: 600,
                    padding: '16px 32px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: !hasAnyContext ? 'not-allowed' : 'pointer',
                    boxShadow: !hasAnyContext ? 'none' : generateHovered ? '0 4px 12px rgba(21, 101, 192, 0.4)' : '0 2px 8px rgba(21, 101, 192, 0.3)',
                    marginBottom: '32px',
                }}
            >
                Generate Report
            </button>

            {/* Infrastructure Preview */}
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
