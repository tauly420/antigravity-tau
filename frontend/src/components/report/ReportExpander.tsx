import { useState, useRef, useEffect } from 'react';

interface ReportExpanderProps {
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export default function ReportExpander({ expanded, onToggle, children }: ReportExpanderProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    if (expanded) {
      // Expand: set max-height to scrollHeight, then remove it after animation
      setAnimating(true);
      el.style.maxHeight = el.scrollHeight + 'px';
      el.style.opacity = '1';
      timeoutRef.current = setTimeout(() => {
        el.style.maxHeight = 'none';
        setAnimating(false);
        // Smooth-scroll into view after animation completes
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
    } else {
      // Collapse: first set maxHeight to scrollHeight (from 'none'), then animate to 0
      setAnimating(true);
      el.style.maxHeight = el.scrollHeight + 'px';
      el.style.opacity = '0';
      requestAnimationFrame(() => {
        el.style.maxHeight = '0';
      });
      timeoutRef.current = setTimeout(() => {
        setAnimating(false);
      }, 300);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [expanded]);

  return (
    <div style={{ marginTop: '32px' }}>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          height: '48px',
          background: 'linear-gradient(135deg, var(--primary, #1565c0) 0%, #1976d2 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '1.125rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontFamily: 'inherit',
        }}
      >
        <span>Generate Full Lab Report</span>
        <span
          style={{
            display: 'inline-block',
            transition: 'transform 200ms ease',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            fontSize: '0.75rem',
          }}
        >
          &#x25BC;
        </span>
      </button>

      {/* Subtitle */}
      <p
        style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary, #666)',
          lineHeight: 1.5,
          margin: '8px 0 0 0',
          textAlign: 'center',
        }}
      >
        Expand your analysis into a complete academic lab report with AI-generated theory,
        discussion, and professional PDF export.
      </p>

      {/* Collapsible Content */}
      <div
        ref={contentRef}
        style={{
          maxHeight: expanded ? undefined : '0',
          overflow: animating ? 'hidden' : (expanded ? 'visible' : 'hidden'),
          opacity: expanded ? 1 : 0,
          transition: 'max-height 300ms ease-out, opacity 200ms ease 100ms',
        }}
      >
        {children}
      </div>
    </div>
  );
}
