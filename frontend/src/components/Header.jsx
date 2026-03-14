import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Header() {
    const location = useLocation();
    const [isDark, setIsDark] = useState(false);

    // Initialize theme from localStorage or system preference
    useEffect(() => {
        const savedTheme = localStorage.getItem('hireflow-theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            setIsDark(true);
            document.body.classList.add('dark');
        }
    }, []);

    const toggleTheme = () => {
        if (isDark) {
            document.body.classList.remove('dark');
            localStorage.setItem('hireflow-theme', 'light');
            setIsDark(false);
        } else {
            document.body.classList.add('dark');
            localStorage.setItem('hireflow-theme', 'dark');
            setIsDark(true);
        }
    };

    const navLinks = [
        { path: '/', label: 'Overview' },
        { path: '/discover', label: 'Discover' },
        { path: '/jobs', label: 'Jobs' },
        { path: '/applications', label: 'Applications' },
        { path: '/tailor', label: 'Tailor Resume' }
    ];

    return (
        <header className="header">
            <div className="header-container">
                {/* Logo Area */}
                <Link to="/" className="header-logo">
                    <div className="header-logo-mark">
                        <Zap size={14} strokeWidth={3} />
                    </div>
                    <span>HireFlow</span>
                </Link>

                {/* Main Navigation */}
                <nav className="header-nav">
                    {navLinks.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={location.pathname === link.path ? 'active' : ''}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/* Right Controls */}
                <div className="header-actions">
                    <span className="version-string">v2.0.0</span>
                    <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                        {isDark ? <Sun size={14} strokeWidth={2.5} /> : <Moon size={14} strokeWidth={2.5} />}
                    </button>
                </div>
            </div>
        </header>
    );
}
