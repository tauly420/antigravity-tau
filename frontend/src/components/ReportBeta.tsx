import { useState, useRef } from 'react';
import { uploadInstructionFile } from '../services/api';

function ReportBeta() {
    const [downloading, setDownloading] = useState(false);
    const [instructionFile, setInstructionFile] = useState<File | null>(null);
    const [extractedText, setExtractedText] = useState<string>('');
    const [extractionWarning, setExtractionWarning] = useState<string | null>(null);
    const [extractionError, setExtractionError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleFileUpload = async (file: File) => {
        const filename = file.name.toLowerCase();
        if (!filename.endsWith('.pdf') && !filename.endsWith('.docx')) {
            setExtractionError('Unsupported file type. Please upload a PDF or DOCX file.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setExtractionError('File is too large. Please upload a file under 10 MB.');
            return;
        }
        setInstructionFile(file);
        setExtractionError(null);
        setExtractionWarning(null);
        setUploading(true);
        try {
            const result = await uploadInstructionFile(file);
            if (result.error) {
                setExtractionError(result.error);
            } else {
                setExtractedText(result.text);
                setExtractionWarning(result.warning);
            }
        } catch {
            setExtractionError('Failed to extract text. Please try again or paste the instructions manually.');
        } finally {
            setUploading(false);
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

            {/* Lab Instructions Upload Section */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', fontWeight: 400 }}>
                    Lab Instructions (Optional)
                </h3>
                <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-secondary, #666)', fontSize: '0.875rem' }}>
                    Upload your lab instruction file for AI context
                </p>

                {/* Dropzone */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
                    style={{
                        border: `2px ${isDragOver ? 'solid' : 'dashed'} var(--primary, #1565c0)`,
                        borderRadius: '10px',
                        padding: '1.5rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: instructionFile && !uploading
                            ? 'var(--success-bg, #e8f5e9)'
                            : 'var(--info-bg, #e3f2fd)',
                        transition: 'border-style 0.15s ease',
                    }}
                >
                    {uploading ? (
                        <span style={{ color: 'var(--text-secondary, #666)' }}>Extracting text...</span>
                    ) : instructionFile ? (
                        <span style={{ color: 'var(--success, #2e7d32)', fontWeight: 600 }}>
                            {instructionFile.name} ({Math.round(instructionFile.size / 1024)} KB)
                        </span>
                    ) : (
                        <span style={{ color: 'var(--primary, #1565c0)' }}>
                            Click or drag &amp; drop your instruction file<br />
                            <small>.pdf, .docx</small>
                        </span>
                    )}
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx"
                    style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                />

                {/* Error display */}
                {extractionError && (
                    <div aria-live="polite" style={{
                        color: 'var(--danger, #d32f2f)',
                        fontSize: '0.875rem',
                        marginTop: '0.5rem',
                    }}>
                        {extractionError}
                    </div>
                )}

                {/* Extracted text section */}
                {(extractedText || extractionWarning !== null) && (
                    <div style={{ marginTop: '1rem' }}>
                        {extractionWarning && (
                            <div role="alert" style={{
                                background: 'linear-gradient(135deg, var(--warning-bg, #fff3e0) 0%, var(--warning-bg-end, #ffe0b2) 100%)',
                                border: '1px solid var(--warning-border, #ffe0b2)',
                                borderRadius: '12px',
                                padding: '1rem',
                                marginBottom: '0.75rem',
                            }}>
                                <span aria-hidden="true">&#x26A0;&#xFE0F; </span>
                                {extractionWarning}
                            </div>
                        )}
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 600 }}>Extracted Text</h3>
                        <textarea
                            id="extracted-text"
                            value={extractedText}
                            onChange={(e) => setExtractedText(e.target.value)}
                            placeholder="Extracted text will appear here, or type/paste your lab instructions manually..."
                            style={{
                                width: '100%',
                                minHeight: '200px',
                                maxHeight: '400px',
                                resize: 'vertical',
                                border: '1.5px solid var(--border, #e0e0e0)',
                                borderRadius: '8px',
                                padding: '1rem',
                                background: 'var(--surface, #ffffff)',
                                color: 'var(--text, #333)',
                                fontFamily: 'inherit',
                                fontSize: '0.875rem',
                                lineHeight: 1.6,
                                boxSizing: 'border-box',
                            }}
                        />
                        <label htmlFor="extracted-text" style={{
                            display: 'block',
                            marginTop: '0.5rem',
                            color: 'var(--text-secondary, #666)',
                            fontSize: '0.875rem',
                        }}>
                            Review and edit the extracted text. This will be sent to AI for report generation.
                        </label>
                    </div>
                )}
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
