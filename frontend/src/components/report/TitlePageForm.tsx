import { useEffect } from 'react';

export interface TitlePageData {
  studentName: string;
  studentId: string;
  labPartner: string;
  labPartnerId: string;
  courseName: string;
  experimentTitle: string;
  date: string;
}

interface TitlePageFormProps {
  data: TitlePageData;
  onChange: (data: TitlePageData) => void;
  language: 'he' | 'en';
  experimentTitleFromContext?: string;
}

const INPUT_STYLE: React.CSSProperties = {
  border: '1.5px solid var(--border, #e0e0e0)',
  borderRadius: '8px',
  padding: '16px',
  background: 'var(--surface, #ffffff)',
  fontSize: '0.875rem',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

// UI labels are always in English — language setting only affects the generated report content
const LABELS = {
  heading: 'Title Page Information',
  studentName: 'Student Name',
  studentId: 'Student ID',
  labPartner: 'Lab Partner Name',
  labPartnerId: 'Lab Partner ID',
  courseName: 'Course Name',
  experimentTitle: 'Experiment Title',
  date: 'Date',
} as const;

export default function TitlePageForm({
  data,
  onChange,
  language: _language,
  experimentTitleFromContext,
}: TitlePageFormProps) {
  const labels = LABELS;
  void _language; // language only affects generated report, not UI labels

  // Pre-fill experiment title from context if field is empty
  useEffect(() => {
    if (experimentTitleFromContext && !data.experimentTitle) {
      onChange({ ...data, experimentTitle: experimentTitleFromContext });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (field: keyof TitlePageData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: 400,
    color: 'var(--text, #1a1a2e)',
    marginBottom: '4px',
    display: 'block',
  };

  return (
    <div
      style={{
        background: 'var(--surface, #ffffff)',
        border: '1px solid var(--border, #e0e0e0)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '32px',
      }}
    >
      <h2
        style={{
          margin: '0 0 16px 0',
          fontSize: '1.25rem',
          fontWeight: 600,
          color: 'var(--text, #1a1a2e)',
        }}
      >
        {labels.heading}
      </h2>

      {/* Row 1: Student Name + Student ID */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{labels.studentName}</label>
          <input
            type="text"
            value={data.studentName}
            onChange={(e) => update('studentName', e.target.value)}
            style={INPUT_STYLE}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{labels.studentId}</label>
          <input
            type="text"
            value={data.studentId}
            onChange={(e) => update('studentId', e.target.value)}
            placeholder="Optional"
            style={INPUT_STYLE}
          />
        </div>
      </div>

      {/* Row 2: Lab Partner + Lab Partner ID */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{labels.labPartner}</label>
          <input
            type="text"
            value={data.labPartner}
            onChange={(e) => update('labPartner', e.target.value)}
            style={INPUT_STYLE}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{labels.labPartnerId}</label>
          <input
            type="text"
            value={data.labPartnerId}
            onChange={(e) => update('labPartnerId', e.target.value)}
            placeholder="Optional"
            style={INPUT_STYLE}
          />
        </div>
      </div>

      {/* Row 3: Course Name + Date */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{labels.courseName}</label>
          <input
            type="text"
            value={data.courseName}
            onChange={(e) => update('courseName', e.target.value)}
            style={INPUT_STYLE}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{labels.date}</label>
          <input
            type="date"
            value={data.date}
            onChange={(e) => update('date', e.target.value)}
            style={INPUT_STYLE}
          />
        </div>
      </div>

      {/* Row 4: Experiment Title (full-width) */}
      <div>
        <label style={labelStyle}>{labels.experimentTitle}</label>
        <input
          type="text"
          value={data.experimentTitle}
          onChange={(e) => update('experimentTitle', e.target.value)}
          style={INPUT_STYLE}
        />
      </div>
    </div>
  );
}
