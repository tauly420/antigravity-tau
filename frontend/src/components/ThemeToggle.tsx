import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tauly-theme';

function getInitialTheme(): Theme {
    if (typeof document === 'undefined') return 'light';
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'dark' || saved === 'light') return saved;
    } catch { /* ignore */ }
    return 'light';
}

function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
    }, [theme]);

    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    const label = theme === 'dark' ? 'Light' : 'Dark';
    const icon = theme === 'dark' ? '☀️' : '🌙';

    return (
        <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(next)}
            aria-label={`Switch to ${next} mode`}
            title={`Switch to ${next} mode`}
        >
            <span aria-hidden="true">{icon}</span>
            <span>{label}</span>
        </button>
    );
}

export default ThemeToggle;
