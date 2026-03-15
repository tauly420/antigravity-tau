import { useState } from 'react';

/**
 * DataPreview — Reusable data table showing the first N rows of parsed data.
 * Used in Workflow, GraphFitting, and AutoLab.
 *
 * Props:
 *   columns: string[] — column names
 *   rows: Record<string, any>[] — data rows
 *   maxRows?: number — max rows to show (default 10)
 *   defaultOpen?: boolean — whether preview starts open (default true)
 */
interface DataPreviewProps {
    columns: string[];
    rows: Record<string, any>[];
    maxRows?: number;
    defaultOpen?: boolean;
}

function DataPreview({ columns, rows, maxRows = 10, defaultOpen = true }: DataPreviewProps) {
    const [open, setOpen] = useState(defaultOpen);
    const displayRows = rows.slice(0, maxRows);

    return (
        <div style={{
            marginTop: '0.75rem', marginBottom: '0.75rem',
            borderRadius: '10px', border: '1px solid #e0e0e0',
            overflow: 'hidden', background: '#fff',
        }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.6rem 1rem', background: '#f5f5f5',
                    border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
                    color: '#333',
                }}
            >
                <span>📋 Data Preview ({rows.length} rows, {columns.length} cols)</span>
                <span style={{ fontSize: '1.1rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>

            {open && (
                <div style={{ overflowX: 'auto', maxHeight: '350px', overflowY: 'auto' }}>
                    <table style={{
                        width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem',
                        fontFamily: 'monospace',
                    }}>
                        <thead>
                            <tr>
                                <th style={{
                                    padding: '0.4rem 0.6rem', background: '#e3f2fd',
                                    borderBottom: '2px solid #90caf9', textAlign: 'center',
                                    position: 'sticky', top: 0, zIndex: 1, fontSize: '0.75rem', color: '#666',
                                }}>#</th>
                                {columns.map(col => (
                                    <th key={col} style={{
                                        padding: '0.4rem 0.6rem', background: '#e3f2fd',
                                        borderBottom: '2px solid #90caf9', textAlign: 'left',
                                        whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1,
                                    }}>{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayRows.map((row, i) => (
                                <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                                    <td style={{
                                        padding: '0.3rem 0.6rem', borderBottom: '1px solid #eee',
                                        textAlign: 'center', color: '#999', fontSize: '0.75rem',
                                    }}>{i + 1}</td>
                                    {columns.map(col => (
                                        <td key={col} style={{
                                            padding: '0.3rem 0.6rem', borderBottom: '1px solid #eee',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {row[col] != null ? String(row[col]) : '—'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rows.length > maxRows && (
                        <div style={{
                            padding: '0.4rem 1rem', fontSize: '0.8rem', color: '#888',
                            background: '#fafafa', borderTop: '1px solid #eee',
                        }}>
                            Showing first {maxRows} of {rows.length} rows
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default DataPreview;
