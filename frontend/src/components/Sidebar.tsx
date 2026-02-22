import { useState, useRef, useEffect } from 'react';
import * as api from '../services/api';

function Sidebar() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: 'Hello! I\'m your lab assistant. Ask me about physics, data analysis, or your current work.' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const response = await api.chatWithAssistant({ message: userMsg });
            setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
        } catch {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '⚠️ Could not connect to the AI service. Please check that the OPENAI_API_KEY is configured on the server.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Toggle button */}
            <button
                onClick={() => setOpen(o => !o)}
                className="sidebar-toggle"
                aria-label="Toggle AI Assistant"
            >
                {open ? '✕' : '🤖'}
            </button>

            {/* Sidebar panel */}
            <div className={`sidebar-panel ${open ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <img src="/chatbot.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                    <h3>AI Lab Assistant</h3>
                </div>

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
