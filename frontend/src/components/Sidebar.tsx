import { useState, useRef, useEffect } from 'react';
import * as api from '../services/api';
import { useAnalysis } from '../context/AnalysisContext';

function Sidebar() {
    const { currentTool, currentData, lastResult, analysisHistory } = useAnalysis();
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: 'Hello! I am your lab assistant. I can see what you are working on. How can I help?' }
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
            // Construct context-aware prompt
            const context = {
                tool: currentTool,
                data_summary: currentData ? JSON.stringify(currentData).slice(0, 1000) : 'No data loaded',
                last_result: lastResult ? JSON.stringify(lastResult).slice(0, 1000) : 'No recent result',
                history: analysisHistory.slice(-5)
            };

            const systemPrompt = `
Context:
- User is using tool: ${context.tool}
- Current Data: ${context.data_summary}
- Last Result: ${context.last_result}

User Question: ${userMsg}
            `.trim();

            const response = await api.chatWithAssistant({ message: systemPrompt });
            setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error connecting to the AI service.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            width: '350px',
            height: '100vh',
            borderLeft: '1px solid #ddd',
            background: '#f8f9fa',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            right: 0,
            top: 0,
            zIndex: 1000,
            boxShadow: '-2px 0 5px rgba(0,0,0,0.05)'
        }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #ddd', background: 'white' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>🤖 AI Assistant</h3>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                    Context: {currentTool}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.map((msg, idx) => (
                    <div key={idx} style={{
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        padding: '0.75rem 1rem',
                        borderRadius: '12px',
                        background: msg.role === 'user' ? '#1976d2' : 'white',
                        color: msg.role === 'user' ? 'white' : '#333',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                        borderBottomLeftRadius: msg.role === 'assistant' ? '2px' : '12px',
                        border: msg.role === 'assistant' ? '1px solid #e0e0e0' : 'none',
                        fontSize: '0.9rem'
                    }}>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    </div>
                ))}
                {loading && (
                    <div style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', background: '#f0f0f0', borderRadius: '12px', fontSize: '0.8rem', color: '#666' }}>
                        Thinking...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: '1rem', borderTop: '1px solid #ddd', background: 'white' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about your data..."
                        disabled={loading}
                        style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        style={{ padding: '0.5rem 1rem', background: '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Sidebar;
