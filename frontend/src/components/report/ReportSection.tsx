import { useState, useRef, useEffect, useCallback } from 'react';
import {
  uploadInstructionFile,
  analyzeReportContext,
  generateReport,
  exportReportPdf,
  exportReportDocx,
  type ContextForm,
  type FollowUpQuestion,
  type GeneratedSections,
} from '../../services/api';
import { normalizeAnalysisData } from '../../utils/normalize';
import SectionAccordion from './SectionAccordion';
import TitlePageForm, { type TitlePageData } from './TitlePageForm';
import PlotThumbnail from './PlotThumbnail';

// UI section titles are always English -- language setting only affects generated report content
const SECTION_ORDER = [
  { key: 'theory', label: '1. Theoretical Background' },
  { key: 'method', label: '2. Measurement Method' },
  { key: 'results', label: '3. Results' },
  { key: 'discussion', label: '4. Discussion' },
  { key: 'conclusions', label: '5. Conclusions' },
];

type GenerationPhase = 'idle' | 'analyzing' | 'follow-up' | 'generating' | 'complete' | 'error';

interface ReportSectionProps {
  analysisData: Record<string, unknown> | null;
  plotImages: { fit: string | null; residuals: string | null };
  initialTitle?: string;
  instructions?: string;
  demoContext?: {
    title: string;
    subject: string;
    equipment: string;
    notes: string;
    titlePage?: Record<string, string>;
  } | null;
}

// Shared inline style constants
const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 400,
  color: 'var(--text, #1a1a2e)',
  marginBottom: '4px',
  display: 'block',
  lineHeight: 1.4,
};

const INPUT_STYLE: React.CSSProperties = {
  border: '1.5px solid var(--border, #e0e0e0)',
  borderRadius: '8px',
  padding: '16px',
  background: 'var(--surface, #ffffff)',
  fontSize: '0.9375rem',
  width: '100%',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
};

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--surface, #ffffff)',
  border: '1px solid var(--border, #e0e0e0)',
  borderRadius: '12px',
  padding: '24px',
  marginBottom: '32px',
};

export default function ReportSection({
  analysisData,
  plotImages,
  initialTitle,
  instructions: initialInstructions,
  demoContext,
}: ReportSectionProps) {
  // --- State declarations ---
  const [contextForm, setContextForm] = useState<ContextForm>({
    title: '', subject: '', equipment: '', notes: '',
  });
  const [language, setLanguage] = useState<'he' | 'en'>('he');

  // Instruction file upload
  const [instructionText, setInstructionText] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generation flow
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle');
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generatedSections, setGeneratedSections] = useState<GeneratedSections | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const followUpRef = useRef<HTMLDivElement>(null);

  // Section editing
  const [editedSections, setEditedSections] = useState<Set<string>>(new Set());
  const [editableSections, setEditableSections] = useState<Record<string, string>>({});

  // Title page
  const [titlePageData, setTitlePageData] = useState<TitlePageData>({
    studentName: '', studentId: '', labPartner: '', labPartnerId: '', courseName: '',
    experimentTitle: '', date: new Date().toISOString().split('T')[0],
  });

  // Export format + status
  const [exportFormat, setExportFormat] = useState<'docx' | 'pdf'>('docx');
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'error'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);

  // Track UI state
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [generateHovered, setGenerateHovered] = useState(false);

  // --- Pre-fill logic (D-04) ---
  useEffect(() => {
    if (initialTitle) {
      setContextForm(prev => ({ ...prev, title: prev.title || initialTitle }));
      setTitlePageData(prev => ({ ...prev, experimentTitle: prev.experimentTitle || initialTitle }));
    }
    if (initialInstructions) {
      setContextForm(prev => ({ ...prev, notes: prev.notes || initialInstructions }));
    }
  }, [initialTitle, initialInstructions]);

  // Demo context pre-fill (D-12)
  useEffect(() => {
    if (demoContext) {
      setContextForm({
        title: demoContext.title,
        subject: demoContext.subject,
        equipment: demoContext.equipment,
        notes: demoContext.notes,
      });
      if (demoContext.titlePage) {
        setTitlePageData(prev => ({
          ...prev,
          studentName: demoContext.titlePage?.studentName || '',
          studentId: demoContext.titlePage?.studentId || '',
          labPartner: demoContext.titlePage?.labPartner || '',
          labPartnerId: demoContext.titlePage?.labPartnerId || '',
          courseName: demoContext.titlePage?.courseName || '',
          experimentTitle: demoContext.titlePage?.experimentTitle || '',
          date: demoContext.titlePage?.date || '',
        }));
      }
    }
  }, [demoContext]);

  // Auto-focus first follow-up question
  useEffect(() => {
    if (generationPhase === 'follow-up' && followUpRef.current) {
      const firstInput = followUpRef.current.querySelector('input');
      if (firstInput) firstInput.focus();
    }
  }, [generationPhase]);

  // Initialize editableSections when generatedSections arrives
  useEffect(() => {
    if (generatedSections) {
      setEditableSections({
        theory: generatedSections.theory,
        method: generatedSections.method,
        discussion: generatedSections.discussion,
        conclusions: generatedSections.conclusions,
      });
      setEditedSections(new Set());
    }
  }, [generatedSections]);

  // --- Handlers ---
  const updateContextField = useCallback((field: keyof ContextForm, value: string) => {
    setContextForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSectionChange = useCallback((key: string, newContent: string) => {
    setEditableSections(prev => ({ ...prev, [key]: newContent }));
    setEditedSections(prev => new Set(prev).add(key));
  }, []);

  const doGenerate = async (answersList: { id: string; answer: string }[]) => {
    setGenerationPhase('generating');
    setGenerationError(null);

    const rawData = analysisData ? analysisData : {};
    const normalized = normalizeAnalysisData(rawData);
    const payload = {
      context_form: contextForm,
      instruction_text: instructionText,
      analysis_data: normalized,
      answers: answersList,
      language: language,
    };

    // First attempt
    try {
      const result = await generateReport(payload);
      if (result.error) throw new Error(result.error);
      setGeneratedSections(result.sections);
      setGenerationPhase('complete');
      return;
    } catch (_firstErr) {
      // Silent retry once
      try {
        const result = await generateReport(payload);
        if (result.error) throw new Error(result.error);
        setGeneratedSections(result.sections);
        setGenerationPhase('complete');
      } catch (retryErr: unknown) {
        const message = retryErr instanceof Error
          ? retryErr.message
          : 'Report generation failed. Please try again.';
        setGenerationError(message);
        setGenerationPhase('error');
      }
    }
  };

  const handleGenerate = async () => {
    setGenerationError(null);
    setGenerationPhase('analyzing');
    try {
      const rawData = analysisData ? analysisData : {};
      const normalized = normalizeAnalysisData(rawData);
      const result = await analyzeReportContext({
        context_form: contextForm,
        instruction_text: instructionText,
        analysis_data: normalized,
      });
      if (result.error) {
        setGenerationError(result.error);
        setGenerationPhase('error');
        return;
      }
      if (result.questions.length > 0) {
        setFollowUpQuestions(result.questions);
        setAnswers({});
        setGenerationPhase('follow-up');
      } else {
        await doGenerate([]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : 'Failed to connect. Check your internet connection and try again.';
      setGenerationError(message);
      setGenerationPhase('error');
    }
  };

  const handleGenerateWithAnswers = () => {
    const answersList = followUpQuestions.map(q => ({
      id: q.id,
      answer: answers[q.id] || '',
    }));
    doGenerate(answersList);
  };

  const handleGenerateAnyway = () => {
    doGenerate([]);
  };

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

  const handleExport = async () => {
    setExportStatus('exporting');
    setExportError(null);
    try {
      const rawData = analysisData ? analysisData : {};
      const normalized = normalizeAnalysisData(rawData);

      const titlePage = {
        studentName: titlePageData.studentName,
        studentId: titlePageData.studentId,
        labPartner: titlePageData.labPartner,
        labPartnerId: titlePageData.labPartnerId,
        courseName: titlePageData.courseName,
        experimentTitle: titlePageData.experimentTitle,
        date: titlePageData.date,
      };
      const plots = {
        fit: plotImages.fit,
        residuals: plotImages.residuals,
      };

      let blob: Blob;
      let filename: string;

      if (exportFormat === 'docx') {
        blob = await exportReportDocx({
          sections: editableSections,
          title_page: titlePage,
          plots,
          language: language,
          analysis_data: normalized,
        });
        filename = 'lab-report.docx';
      } else {
        blob = await exportReportPdf({
          sections: editableSections,
          title_page: titlePage,
          plots,
          template: 'israeli',
          language: language,
          analysis_data: normalized,
        });
        filename = 'lab-report.pdf';
      }

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatus('idle');
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : 'Export failed. Check that all required fields are filled and try again.';
      setExportError(msg);
      setExportStatus('error');
    }
  };

  // --- Derived state ---
  const isGenerating = generationPhase === 'analyzing' || generationPhase === 'generating';
  const hasGeneratedSections = generationPhase === 'complete' && generatedSections !== null;
  const canGenerate = contextForm.title.trim() !== '' && contextForm.subject.trim() !== '';

  // --- Render ---
  return (
    <div style={{ marginTop: '32px' }}>
      {/* Context Form Card */}
      <div style={CARD_STYLE}>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: '1.125rem',
          fontWeight: 700,
          color: 'var(--text, #1a1a2e)',
          lineHeight: 1.3,
        }}>
          Report Context
        </h3>

        {/* Title (required) */}
        <div style={{ marginBottom: '16px' }}>
          <label style={LABEL_STYLE}>Experiment Title *</label>
          <input
            type="text"
            value={contextForm.title}
            onChange={e => updateContextField('title', e.target.value)}
            onFocus={() => setFocusedField('title')}
            onBlur={() => setFocusedField(null)}
            placeholder="e.g., Free Fall Acceleration Measurement"
            style={{
              ...INPUT_STYLE,
              borderColor: focusedField === 'title' ? 'var(--primary, #1565c0)' : undefined,
            }}
          />
        </div>

        {/* Subject (required) */}
        <div style={{ marginBottom: '16px' }}>
          <label style={LABEL_STYLE}>Subject *</label>
          <input
            type="text"
            value={contextForm.subject}
            onChange={e => updateContextField('subject', e.target.value)}
            onFocus={() => setFocusedField('subject')}
            onBlur={() => setFocusedField(null)}
            placeholder="e.g., Classical Mechanics, Optics, Thermodynamics"
            style={{
              ...INPUT_STYLE,
              borderColor: focusedField === 'subject' ? 'var(--primary, #1565c0)' : undefined,
            }}
          />
        </div>

        {/* Equipment */}
        <div style={{ marginBottom: '16px' }}>
          <label style={LABEL_STYLE}>Equipment</label>
          <input
            type="text"
            value={contextForm.equipment}
            onChange={e => updateContextField('equipment', e.target.value)}
            onFocus={() => setFocusedField('equipment')}
            onBlur={() => setFocusedField(null)}
            placeholder="e.g., Timer, meter stick, metal ball, scale"
            style={{
              ...INPUT_STYLE,
              borderColor: focusedField === 'equipment' ? 'var(--primary, #1565c0)' : undefined,
            }}
          />
        </div>

        {/* Procedure Notes */}
        <div style={{ marginBottom: '16px' }}>
          <label style={LABEL_STYLE}>Procedure Notes</label>
          <textarea
            value={contextForm.notes}
            onChange={e => updateContextField('notes', e.target.value)}
            onFocus={() => setFocusedField('notes')}
            onBlur={() => setFocusedField(null)}
            placeholder="Additional notes about the experiment procedure, observations, or special conditions..."
            rows={3}
            style={{
              ...INPUT_STYLE,
              resize: 'vertical' as const,
              borderColor: focusedField === 'notes' ? 'var(--primary, #1565c0)' : undefined,
            }}
          />
        </div>

        {/* Lab instruction file upload (D-05) */}
        <div style={{ marginBottom: '16px' }}>
          <label style={LABEL_STYLE}>Lab Instructions (PDF/DOCX)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadStatus === 'uploading'}
              style={{
                padding: '8px 24px',
                border: '2px solid var(--primary, #1565c0)',
                borderRadius: '8px',
                background: 'var(--surface, #ffffff)',
                color: 'var(--primary, #1565c0)',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: uploadStatus === 'uploading' ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {uploadStatus === 'uploading' ? 'Uploading...' : uploadStatus === 'done' ? 'Replace File' : 'Upload Instructions'}
            </button>
            {uploadStatus === 'done' && (
              <span style={{ fontSize: '0.875rem', color: 'var(--success, #2e7d32)' }}>
                File uploaded successfully
              </span>
            )}
          </div>
          {uploadWarning && (
            <p style={{
              fontSize: '0.8125rem',
              color: uploadStatus === 'error' ? 'var(--danger, #d32f2f)' : 'var(--warning, #f57c00)',
              margin: '4px 0 0 0',
            }}>
              {uploadWarning}
            </p>
          )}
          {instructionText && (
            <div style={{
              marginTop: '8px',
              padding: '12px',
              background: 'var(--surface-alt, #f4f5f9)',
              borderRadius: '8px',
              maxHeight: '120px',
              overflow: 'auto',
              fontSize: '0.8125rem',
              color: 'var(--text-secondary, #666)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>
              {instructionText.slice(0, 500)}{instructionText.length > 500 ? '...' : ''}
            </div>
          )}
        </div>

        {/* Language Toggle (D-13) */}
        <div style={{ marginBottom: '16px' }}>
          <label style={LABEL_STYLE}>Report Language</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setLanguage('he')}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: language === 'he' ? '2px solid var(--primary, #1565c0)' : '1.5px solid var(--border, #e0e0e0)',
                background: language === 'he' ? 'var(--primary-light, #e3f2fd)' : 'var(--surface, #ffffff)',
                color: language === 'he' ? 'var(--primary, #1565c0)' : 'var(--text, #1a1a2e)',
                fontSize: '0.875rem',
                fontWeight: language === 'he' ? 700 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Hebrew
            </button>
            <button
              onClick={() => setLanguage('en')}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: language === 'en' ? '2px solid var(--primary, #1565c0)' : '1.5px solid var(--border, #e0e0e0)',
                background: language === 'en' ? 'var(--primary-light, #e3f2fd)' : 'var(--surface, #ffffff)',
                color: language === 'en' ? 'var(--primary, #1565c0)' : 'var(--text, #1a1a2e)',
                fontSize: '0.875rem',
                fontWeight: language === 'en' ? 700 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate || isGenerating}
        onMouseEnter={() => setGenerateHovered(true)}
        onMouseLeave={() => setGenerateHovered(false)}
        style={{
          width: '100%',
          padding: '12px 24px',
          height: '48px',
          border: 'none',
          borderRadius: '8px',
          background: (!canGenerate || isGenerating)
            ? 'var(--text-secondary, #999)'
            : generateHovered
              ? 'linear-gradient(135deg, #1976d2 0%, #1e88e5 100%)'
              : 'linear-gradient(135deg, var(--primary, #1565c0) 0%, #1976d2 100%)',
          color: 'white',
          fontSize: '1rem',
          fontWeight: 700,
          cursor: (!canGenerate || isGenerating) ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          marginBottom: '24px',
          transition: 'background 200ms ease',
        }}
      >
        {generationPhase === 'analyzing' ? 'Analyzing context...'
          : generationPhase === 'generating' ? 'Generating sections...'
          : 'Generate Lab Report'}
      </button>

      {/* Generation Error */}
      {generationError && (
        <div style={{
          padding: '16px',
          background: 'var(--danger-light, #fbe9e7)',
          border: '1px solid var(--danger, #d32f2f)',
          borderRadius: '8px',
          color: 'var(--danger, #d32f2f)',
          fontSize: '0.9375rem',
          lineHeight: 1.5,
          marginBottom: '24px',
        }}>
          Report generation failed: {generationError}. Check your internet connection and try again.
        </div>
      )}

      {/* Follow-up Questions (D-13) */}
      {generationPhase === 'follow-up' && followUpQuestions.length > 0 && (
        <div ref={followUpRef} style={CARD_STYLE}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--text, #1a1a2e)',
            lineHeight: 1.3,
          }}>
            Follow-up Questions
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary, #666)',
            margin: '0 0 16px 0',
            lineHeight: 1.5,
          }}>
            The AI needs a bit more information to generate an accurate report. Please answer the following questions:
          </p>
          {followUpQuestions.map(q => (
            <div key={q.id} style={{ marginBottom: '16px' }}>
              <label style={LABEL_STYLE}>{q.question}</label>
              {q.hint && (
                <p style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary, #666)',
                  margin: '0 0 4px 0',
                }}>
                  {q.hint}
                </p>
              )}
              <input
                type="text"
                value={answers[q.id] || ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                style={INPUT_STYLE}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleGenerateWithAnswers}
              style={{
                padding: '8px 24px',
                border: 'none',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--primary, #1565c0) 0%, #1976d2 100%)',
                color: 'white',
                fontSize: '0.9375rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Send Answers
            </button>
            <button
              onClick={handleGenerateAnyway}
              style={{
                padding: '8px 24px',
                border: '2px solid var(--border, #e0e0e0)',
                borderRadius: '8px',
                background: 'var(--surface, #ffffff)',
                color: 'var(--text-secondary, #666)',
                fontSize: '0.875rem',
                fontWeight: 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Section Accordion (D-13) */}
      {hasGeneratedSections && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--text, #1a1a2e)',
            lineHeight: 1.3,
          }}>
            Report Sections
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary, #666)',
            margin: '0 0 16px 0',
            lineHeight: 1.5,
          }}>
            Review the AI-generated sections below. Click to expand, and edit if needed.
          </p>
          {SECTION_ORDER.map(({ key, label }) => (
            <SectionAccordion
              key={key}
              sectionKey={key}
              title={label}
              content={editableSections[key] || ''}
              isAiGenerated={!editedSections.has(key)}
              onContentChange={(newContent) => handleSectionChange(key, newContent)}
              language={language}
            />
          ))}
        </div>
      )}

      {/* Empty state: no generated sections yet */}
      {generationPhase === 'idle' && !generatedSections && (
        <div style={{
          textAlign: 'center',
          padding: '32px',
          color: 'var(--text-secondary, #666)',
          fontSize: '0.9375rem',
          lineHeight: 1.5,
        }}>
          <p style={{ fontWeight: 700, fontSize: '1.125rem', margin: '0 0 8px 0', color: 'var(--text, #1a1a2e)' }}>
            Generate your report
          </p>
          <p style={{ margin: 0 }}>
            Fill in the context form above and click Generate Lab Report. AI will create theoretical
            background, discussion, and conclusions based on your analysis results.
          </p>
        </div>
      )}

      {/* Plot Thumbnails */}
      {hasGeneratedSections && (plotImages.fit || plotImages.residuals) && (
        <div style={CARD_STYLE}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--text, #1a1a2e)',
            lineHeight: 1.3,
          }}>
            Embedded Plots
          </h3>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
              <PlotThumbnail
                imageBase64={plotImages.fit}
                caption="Figure 1: Fit Plot"
                missingText="Fit plot not captured. Run analysis first."
              />
            </div>
            <div style={{ flex: '1 1 300px' }}>
              <PlotThumbnail
                imageBase64={plotImages.residuals}
                caption="Figure 2: Residuals Plot"
                missingText="Residuals plot not available."
              />
            </div>
          </div>
        </div>
      )}

      {/* Title Page Form */}
      {hasGeneratedSections && (
        <TitlePageForm
          data={titlePageData}
          onChange={setTitlePageData}
          language={language}
          experimentTitleFromContext={contextForm.title}
        />
      )}

      {/* Export Format Selector + Export Button */}
      {hasGeneratedSections && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <select
              value={exportFormat}
              onChange={e => setExportFormat(e.target.value as 'docx' | 'pdf')}
              style={{
                padding: '10px 16px',
                border: '1.5px solid var(--border, #e0e0e0)',
                borderRadius: '8px',
                background: 'var(--surface, #ffffff)',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                cursor: 'pointer',
                color: 'var(--text, #1a1a2e)',
              }}
            >
              <option value="docx">DOCX (Recommended)</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              onClick={handleExport}
              disabled={exportStatus === 'exporting'}
              style={{
                flex: 1,
                padding: '12px 24px',
                height: '48px',
                border: 'none',
                borderRadius: '8px',
                background: exportStatus === 'exporting'
                  ? 'var(--text-secondary, #999)'
                  : 'linear-gradient(135deg, var(--primary, #1565c0) 0%, #1976d2 100%)',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: exportStatus === 'exporting' ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {exportStatus === 'exporting'
                ? 'Exporting...'
                : exportFormat === 'docx' ? 'Export as DOCX' : 'Export as PDF'}
            </button>
          </div>
          <p style={{
            fontSize: '0.8125rem',
            color: 'var(--text-secondary, #666)',
            margin: '0',
            lineHeight: 1.4,
          }}>
            DOCX recommended — editable equations, better Word compatibility
          </p>
          {exportError && (
            <p style={{
              color: 'var(--danger, #d32f2f)',
              fontSize: '0.875rem',
              margin: '8px 0 0 0',
              lineHeight: 1.4,
            }}>
              Export failed: {exportError}. Please try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
