import { useState, useRef, useCallback } from 'react';
import { renderLatex } from '../../utils/latex';

interface SectionEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  language: 'he' | 'en';
}

export default function SectionEditor({ content, onChange, language }: SectionEditorProps) {
  const [previewHtml, setPreviewHtml] = useState(() => renderLatex(content));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      onChange(newText);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setPreviewHtml(renderLatex(newText));
      }, 300);
    },
    [onChange],
  );

  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        flexDirection: language === 'he' ? 'row-reverse' : 'row',
      }}
    >
      {/* Textarea */}
      <textarea
        value={content}
        onChange={handleChange}
        dir="auto"
        style={{
          width: '50%',
          minHeight: '200px',
          resize: 'vertical',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          padding: '16px',
          border: '1.5px solid var(--border, #e0e0e0)',
          borderRadius: '8px',
          background: 'var(--surface, #ffffff)',
          boxSizing: 'border-box',
        }}
      />

      {/* Live KaTeX preview */}
      <div
        dir={language === 'he' ? 'rtl' : 'ltr'}
        style={{
          width: '50%',
          padding: '16px',
          border: '1px solid var(--border, #e0e0e0)',
          borderRadius: '8px',
          background: 'var(--surface, #ffffff)',
          overflow: 'auto',
          minHeight: '200px',
          boxSizing: 'border-box',
        }}
        dangerouslySetInnerHTML={{ __html: previewHtml }}
      />
    </div>
  );
}
