import { useState, useRef, useEffect } from 'react';
import * as api from '../services/api';

function Sidebar() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: 'Hello! I\'m your lab assistant. Ask me about physics, data analysis, or your current work.' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'unknown' | 'ok' | 'no-key' | 'error'>('unknown');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Check status on first open
    useEffect(() => {
        if (open && status === 'unknown') {
            api.getAssistantStatus().then(s => {
                if (!s.has_api_key) setStatus('no-key');
                else if (s.available) setStatus('ok');
                else setStatus('error');
            }).catch(() => setStatus('error'));
        }
    }, [open]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const data = await api.chatWithAssistant({ message: userMsg });
            // Backend returns { response: "...", error: null }
            const reply = data.response || data.message || 'No response received.';
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        } catch (err: any) {
            const errMsg = err.response?.data?.error
                || err.response?.data?.debug
                || err.message
                || 'Connection error';
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `⚠️ Error: ${errMsg}`
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Toggle button — prominent pill shape */}
            <button
                onClick={() => setOpen(o => !o)}
                className="sidebar-toggle"
                aria-label="Toggle AI Assistant"
            >
                {open ? '✕' : '🤖 Ask AI'}
            </button>

            {/* Sidebar panel */}
            <div className={`sidebar-panel ${open ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <img src="/chatbot.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                    <h3>AI Lab Assistant</h3>
                    <button onClick={() => setOpen(false)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}>✕</button>
                </div>

                {status === 'no-key' && (
                    <div style={{ padding: '0.75rem 1rem', background: '#fff3e0', borderBottom: '1px solid #ffe0b2', fontSize: '0.85rem', color: '#e65100' }}>
                        ⚠️ <strong>OPENAI_API_KEY</strong> not set on the server. Chat won't work until it's configured in Railway.
                    </div>
                )}
                {status === 'error' && (
                    <div style={{ padding: '0.75rem 1rem', background: '#ffebee', borderBottom: '1px solid #ef9a9a', fontSize: '0.85rem', color: '#c62828' }}>
                        ⚠️ Chat agent failed to initialize. Check server logs.
                    </div>
                )}

                <div className="sidebar-messages">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`chat-bubble ${msg.role}`}>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                        </div>
                    ))}
                    {loading && (
                        <div className="chat-bubble assistant" style={{ opacity: 0.6 }}>Thinking…</div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="sidebar-input">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask anything…"
                        disabled={loading}
                    />
                    <button onClick={handleSend} disabled={loading || !input.trim()}>
                        Send
                    </button>
                </div>
            </div>
        </>
    );
}

export default Sidebar;
