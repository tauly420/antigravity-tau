interface PlotThumbnailProps {
  imageBase64: string | null;
  caption: string;
  missingText: string;
}

export default function PlotThumbnail({ imageBase64, caption, missingText }: PlotThumbnailProps) {
  if (imageBase64) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <img
          src={imageBase64}
          alt={caption}
          style={{ width: '100%', maxHeight: '300px', objectFit: 'contain' }}
        />
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-muted, #9e9e9e)',
            margin: '8px 0 0 0',
          }}
        >
          {caption}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--surface-alt, #f4f5f9)',
        border: '1px dashed var(--border, #e0e0e0)',
        borderRadius: '8px',
        padding: '32px',
        textAlign: 'center',
        color: 'var(--text-muted, #9e9e9e)',
        fontSize: '0.875rem',
        marginBottom: '16px',
      }}
    >
      {missingText}
    </div>
  );
}
