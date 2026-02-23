import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import * as api from '../services/api';
import { useAnalysis } from '../context/AnalysisContext';

/* ─── Page-specific welcome messages ─── */
const PAGE_TIPS: Record<string, { title: string; tip: string }> = {
    '/': { title: 'Home', tip: '' },
    '/workflow': {
        title: 'Lab Workflow',
        tip: "I can help you with your lab analysis! Upload your data file, select columns for X/Y and their errors, choose a fit model, and I'll guide you through uncertainty propagation and result comparison.",
    },
    '/fitting': {
        title: 'Graph & Curve Fitting',
        tip: "Upload your data (Excel/CSV) and fit it with various models. I can help you choose the right model, interpret R², χ²/dof, and P-values, or write a custom fit expression.",
    },
    '/formula': {
        title: 'Formula Calculator',
        tip: 'Enter any mathematical expression with variables. I can help you with uncertainty propagation — each variable can have a value ± uncertainty, and the calculator computes the propagated error automatically.',
    },
    '/matrix': {
        title: 'Matrix Calculator',
        tip: "Perform matrix operations: add, multiply, transpose, inverse, determinant, LU decomposition, eigenvalues & eigenvectors, or solve Ax = b. I can explain any of these operations!",
    },
    '/ode': {
        title: 'ODE Solver',
        tip: "Solve ordinary differential equations numerically. Convert your 2nd-order ODE to a first-order system using y[0], y[1] notation. Try the pendulum or damped oscillator examples! I can help with the math.",
    },
    '/integrator': {
        title: 'Numerical Integrator',
        tip: "Compute definite integrals in 1D–6D. For 1D, you'll see the function plot with the shaded area. Multi-dimensional integrals use Monte Carlo. I can help you set up tricky integrals.",
    },
    '/nsigma': {
        title: 'N-Sigma Calculator',
        tip: 'Compare two measurements and determine how many standard deviations apart they are. Great for checking if your experimental result agrees with theory!',
    },
    '/units': {
        title: 'Unit Converter',
        tip: 'Convert between 15+ categories: SI, CGS (dyne, erg, gauss), imperial, and more. Covers length, mass, force, energy, pressure, magnetic field, and more.',
    },
    '/fourier': {
        title: 'Fourier Analysis',
        tip: "Compute the DFT and Power Spectral Density of your signal. I'll highlight the 5 most dominant frequencies. You can also reconstruct the signal with frequency filtering (lowpass, highpass, bandpass).",
    },
};

function Sidebar() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
        { role: 'assistant', content: "Hello! I'm your lab assistant. Ask me about physics, data analysis, or your current work." },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'unknown' | 'ok' | 'no-key' | 'error'>('unknown');

    // Page-aware popup
    const [showPopup, setShowPopup] = useState(false);
    const [popupMsg, setPopupMsg] = useState('');
    const [lastPage, setLastPage] = useState('');
    const popupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const { currentTool, lastResult, analysisHistory, uploadedFileInfo } = useAnalysis();

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Check status on first open
    useEffect(() => {
        if (open && status === 'unknown') {
            api.getAssistantStatus()
                .then(s => {
                    if (!s.has_api_key) setStatus('no-key');
                    else if (s.available) setStatus('ok');
                    else setStatus('error');
                })
                .catch(() => setStatus('error'));
        }
    }, [open]);

    // Page-change welcome popup
    useEffect(() => {
        const path = location.pathname;
        if (path === lastPage || path === '/') {
            setLastPage(path);
            return;
        }
        setLastPage(path);
        const page = PAGE_TIPS[path];
        if (page && page.tip) {
            // Show popup
            setPopupMsg(`📍 **${page.title}**\n${page.tip}`);
            setShowPopup(true);
            // Auto-dismiss after 8 seconds
            if (popupTimeout.current) clearTimeout(popupTimeout.current);
            popupTimeout.current = setTimeout(() => setShowPopup(false), 8000);
        }
    }, [location.pathname]);

    const dismissPopup = () => {
        setShowPopup(false);
        if (popupTimeout.current) clearTimeout(popupTimeout.current);
    };

    const openFromPopup = () => {
        dismissPopup();
        setOpen(true);
    };

    // Build context for the AI
    const buildContext = () => {
        const ctx: Record<string, any> = {
            current_page: location.pathname,
            current_tool: currentTool,
        };
        if (uploadedFileInfo) ctx.uploaded_file = uploadedFileInfo;
        if (lastResult) {
            // Summarize last result (avoid sending huge arrays)
            const summary: Record<string, any> = {};
            if (lastResult.model_name) summary.model = lastResult.model_name;
            if (lastResult.parameter_names) summary.parameter_names = lastResult.parameter_names;
            if (lastResult.parameters) summary.parameters = lastResult.parameters;
            if (lastResult.r_squared != null) summary.r_squared = lastResult.r_squared;
            if (lastResult.reduced_chi_squared != null) summary.reduced_chi_squared = lastResult.reduced_chi_squared;
            if (lastResult.p_value != null) summary.p_value = lastResult.p_value;
            if (Object.keys(summary).length > 0) ctx.last_result = summary;
        }
        if (analysisHistory.length > 0) ctx.recent_actions = analysisHistory.slice(-5);
        return ctx;
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const data = await api.chatWithAssistant({
                message: userMsg,
                context: buildContext(),
            });
            const reply = data.response || data.message || 'No response received.';
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        } catch (err: any) {
            const errMsg =
                err.response?.data?.error || err.response?.data?.debug || err.message || 'Connection error';
            setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Error: ${errMsg}` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Welcome popup on page change */}
            {showPopup && !open && (
                <div className="ai-popup">
                    <div className="ai-popup-content">
                        <button className="ai-popup-close" onClick={dismissPopup}>✕</button>
                        <div style={{ whiteSpace: 'pre-line', fontSize: '0.88rem', lineHeight: 1.5 }}>
                            {popupMsg.replace(/\*\*(.*?)\*\*/g, '$1')}
                        </div>
                        <button className="btn-primary" onClick={openFromPopup} style={{ marginTop: '0.75rem', fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
                            💬 Chat about this
                        </button>
                    </div>
                </div>
            )}

            {/* Toggle button */}
            <button
                onClick={() => { setOpen(o => !o); dismissPopup(); }}
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
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#999', paddingRight: '0.5rem' }}>
                        📍 {PAGE_TIPS[location.pathname]?.title || 'Unknown'}
                    </span>
                    <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}>✕</button>
                </div>

                {status === 'no-key' && (
                    <div style={{ padding: '0.75rem 1rem', background: '#fff3e0', borderBottom: '1px solid #ffe0b2', fontSize: '0.85rem', color: '#e65100' }}>
                        ⚠️ <strong>OPENAI_API_KEY</strong> not set. Chat won't work until configured.
                    </div>
                )}
                {status === 'error' && (
                    <div style={{ padding: '0.75rem 1rem', background: '#ffebee', borderBottom: '1px solid #ef9a9a', fontSize: '0.85rem', color: '#c62828' }}>
                        ⚠️ Chat agent failed to initialize.
                    </div>
                )}

                <div className="sidebar-messages">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`chat-bubble ${msg.role}`}>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                        </div>
                    ))}
                    {loading && <div className="chat-bubble assistant" style={{ opacity: 0.6 }}>Thinking…</div>}
                    <div ref={messagesEndRef} />
                </div>

                <div className="sidebar-input">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
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
