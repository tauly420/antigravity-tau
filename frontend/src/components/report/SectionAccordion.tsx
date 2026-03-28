import { useState } from 'react';
import { renderLatex } from '../../utils/latex';
import SectionEditor from './SectionEditor';

interface SectionAccordionProps {
  sectionKey: string;
  title: string;
  content: string;
  isAiGenerated: boolean;
  onContentChange: (newContent: string) => void;
  language: 'he' | 'en';
}

export default function SectionAccordion({
  sectionKey,
  title,
  content,
  isAiGenerated,
  onContentChange,
  language,
}: SectionAccordionProps) {
  const [mode, setMode] = useState<'collapsed' | 'preview' | 'editing'>('collapsed');

  const isExpanded = mode !== 'collapsed';

  const handleHeaderClick = () => {
    if (mode === 'collapsed') {
      setMode('preview');
    } else if (mode === 'preview') {
      setMode('collapsed');
    }
    // Don't collapse when editing -- user must click "Done Editing"
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMode('editing');
  };

  const handleDoneEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMode('preview');
  };

  return (
    <div
      data-section-key={sectionKey}
      style={{
        border: '1px solid var(--border, #e0e0e0)',
        borderRadius: '12px',
        marginBottom: '16px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        onClick={handleHeaderClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--surface-alt, #f4f5f9)',
          padding: '16px 24px',
          cursor: mode === 'editing' ? 'default' : 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Chevron */}
        <span
          style={{
            display: 'inline-block',
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            fontSize: '0.875rem',
            color: 'var(--text-secondary, #666)',
          }}
        >
          &#x25B6;
        </span>

        {/* Title */}
        <span style={{ flex: 1, fontWeight: 600, fontSize: '1rem', color: 'var(--text, #1a1a2e)' }}>
          {title}
        </span>

        {/* AI Generated Badge */}
        {isAiGenerated && (
          <span
            style={{
              background: 'var(--warning, #f57c00)',
              color: 'white',
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '10px',
              whiteSpace: 'nowrap',
            }}
          >
            {language === 'he' ? 'נוצר ע"י AI -- נא לבדוק' : 'AI Generated -- Please Review'}
          </span>
        )}

        {/* Edit / Done Editing button */}
        {mode === 'preview' && (
          <button
            onClick={handleEditClick}
            style={{
              color: 'var(--primary, #1565c0)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              padding: 0,
            }}
          >
            {language === 'he' ? 'עריכה' : 'Edit'}
          </button>
        )}
        {mode === 'editing' && (
          <button
            onClick={handleDoneEditing}
            style={{
              color: 'var(--primary, #1565c0)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              padding: 0,
            }}
          >
            {language === 'he' ? 'סיום עריכה' : 'Done Editing'}
          </button>
        )}
      </div>

      {/* Preview pane */}
      {mode === 'preview' && (
        <div
          style={{
            padding: '16px 24px',
            dir: language === 'he' ? 'rtl' : 'ltr',
          }}
          dangerouslySetInnerHTML={{ __html: renderLatex(content) }}
        />
      )}

      {/* Editor pane */}
      {mode === 'editing' && (
        <div style={{ padding: '16px 24px' }}>
          <SectionEditor
            content={content}
            onChange={onContentChange}
            language={language}
          />
        </div>
      )}
    </div>
  );
}
