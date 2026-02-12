import { useState, useRef, useEffect } from 'react';
import * as api from '../services/api';

function AIAssistant() {
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: 'Hello! I am your lab assistant. How can I help you with your calculations or data analysis today?' }
    ]);
    const [input, setInput] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const response = await api.chatWithAssistant({ message: userMsg });
            setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please check if your OpenAI API key is configured correctly.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card" style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h2>AI Lab Assistant</h2>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', border: '1px solid #eee', borderRadius: '8px', marginBottom: '1rem', background: '#f9f9f9' }}>
                {messages.map((msg, idx) => (
                    <div key={idx} style={{
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        marginBottom: '1rem'
                    }}>
                        <div style={{
                            maxWidth: '80%',
                            padding: '0.8rem 1.2rem',
                            borderRadius: '16px',
                            background: msg.role === 'user' ? 'var(--primary)' : 'white',
                            color: msg.role === 'user' ? 'white' : 'var(--text)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                            borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
                            border: msg.role === 'assistant' ? '1px solid #ddd' : 'none'
                        }}>
                            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ padding: '0.8rem 1.2rem', background: 'white', borderRadius: '16px', border: '1px solid #ddd' }}>
                            <span className="loading-dots">Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask about formulas, data analysis, or physics concepts..."
                    disabled={loading}
                    style={{ flex: 1 }}
                />
                <button onClick={handleSend} disabled={loading || !input.trim()}>
                    Send
                </button>
            </div>
        </div>
    );
}

export default AIAssistant;
