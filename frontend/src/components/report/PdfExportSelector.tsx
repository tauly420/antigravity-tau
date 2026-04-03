interface PdfExportSelectorProps {
  onExportResults: () => void;
  onExportFullReport: () => void;
  fullReportDisabled: boolean;
  resultsExporting: boolean;
  fullReportExporting: boolean;
  error?: string | null;
}

export default function PdfExportSelector({
  onExportResults,
  onExportFullReport,
  fullReportDisabled,
  resultsExporting,
  fullReportExporting,
  error,
}: PdfExportSelectorProps) {
  const isAnyExporting = resultsExporting || fullReportExporting;

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        {/* Results PDF Button (secondary) */}
        <button
          onClick={onExportResults}
          disabled={resultsExporting || isAnyExporting}
          style={{
            flex: 1,
            padding: '8px 24px',
            height: '44px',
            border: '2px solid var(--primary, #1565c0)',
            borderRadius: '8px',
            background: 'var(--surface, #ffffff)',
            color: 'var(--primary, #1565c0)',
            fontSize: '0.9375rem',
            fontWeight: 700,
            cursor: resultsExporting || isAnyExporting ? 'not-allowed' : 'pointer',
            opacity: resultsExporting || isAnyExporting ? 0.6 : 1,
            fontFamily: 'inherit',
            transition: 'opacity 200ms ease',
          }}
        >
          {resultsExporting ? 'Generating PDF...' : 'Export Results PDF'}
        </button>

        {/* Full Report PDF Button (accent) */}
        <button
          onClick={onExportFullReport}
          disabled={fullReportDisabled || fullReportExporting || isAnyExporting}
          style={{
            flex: 1,
            padding: '8px 24px',
            height: '44px',
            border: 'none',
            borderRadius: '8px',
            background: fullReportDisabled
              ? 'var(--text-secondary, #999)'
              : 'linear-gradient(135deg, var(--primary, #1565c0) 0%, #1976d2 100%)',
            color: 'white',
            fontSize: '0.9375rem',
            fontWeight: 700,
            cursor: fullReportDisabled || fullReportExporting || isAnyExporting ? 'not-allowed' : 'pointer',
            opacity: fullReportDisabled || fullReportExporting || isAnyExporting ? 0.5 : 1,
            fontFamily: 'inherit',
            transition: 'opacity 200ms ease',
          }}
        >
          {fullReportExporting ? 'Generating PDF...' : 'Export Full Report PDF'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p
          style={{
            color: 'var(--danger, #d32f2f)',
            fontSize: '0.875rem',
            margin: '8px 0 0 0',
            lineHeight: 1.4,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
