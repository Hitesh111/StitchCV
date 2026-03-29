import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Zap, LayoutDashboard, Search, Briefcase, ClipboardList, Wand2, LogOut, ArrowRight, User as UserIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Header({ user, onLogout, publicMode = false }) {
    const location = useLocation();
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem('stitchcv-theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            setIsDark(true);
            document.body.classList.add('dark');
        }
    }, []);

    const toggleTheme = () => {
        if (isDark) {
            document.body.classList.remove('dark');
            localStorage.setItem('stitchcv-theme', 'light');
            setIsDark(false);
        } else {
            document.body.classList.add('dark');
            localStorage.setItem('stitchcv-theme', 'dark');
            setIsDark(true);
        }
    };

    const navLinks = [
        { path: '/tailor', label: 'Tailor Resume' },
        { path: '/applications', label: 'Applications' },
        { path: '/profile', label: 'Profile Builder' }
    ];

    // Mobile bottom nav — 1 primary (Tailor)
    const mobileNav = [
        { path: '/tailor', label: 'Tailor', icon: <Wand2 size={20} />, primary: true },
        { path: '/applications', label: 'Applications', icon: <LayoutDashboard size={20} /> },
        { path: '/profile', label: 'Profile', icon: <UserIcon size={20} /> }
    ];

    const isActive = (path) => {
        if (path === '/app') return location.pathname === '/app';
        return location.pathname === path || location.pathname.startsWith(`${path}/`);
    };

    return (
        <>
            <header className="header">
                <div className="header-container">
                    {/* Logo Area */}
                    <Link to={publicMode ? '/' : '/tailor'} className="header-logo">
                        <div className="header-logo-mark">
                            <Zap size={14} strokeWidth={3} />
                        </div>
                        <div className="header-logo-copy">
                            <span>StitchCV</span>
                            <small>AI job command center</small>
                        </div>
                    </Link>

                    {/* Main Navigation (desktop only — hidden on mobile via CSS) */}
                    {publicMode ? (
                        <nav className="header-nav header-nav-public">
                            <Link to="/">Product</Link>
                            <Link to="/login">Login</Link>
                            <Link to="/signup">Signup</Link>
                        </nav>
                    ) : (
                        <nav className="header-nav">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    className={isActive(link.path) ? 'active' : ''}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>
                    )}

                    {/* Right Controls */}
                    <div className="header-actions">
                        <span className="version-string">Studio v2.0.0</span>
                        {publicMode && !user && (
                            <Link className="btn btn-primary header-cta" to="/signup">
                                Get started
                                <ArrowRight size={14} />
                            </Link>
                        )}
                        {publicMode && user && (
                            <Link className="btn btn-primary header-cta" to="/tailor">
                                Open workspace
                                <ArrowRight size={14} />
                            </Link>
                        )}
                        {user && (
                            <div className="header-credits" onClick={() => document.dispatchEvent(new CustomEvent('open-pricing'))} title="Buy Credits">
                                <Zap size={14} className="credits-icon" />
                                <span>{user.credits ?? 0} Credits</span>
                            </div>
                        )}
                        {user && (
                            <div className="header-user-pill" title={user.email}>
                                <span className="header-user-avatar">
                                    {user.full_name?.slice(0, 1)?.toUpperCase() || user.email?.slice(0, 1)?.toUpperCase()}
                                </span>
                                <span className="header-user-name">{user.full_name || user.email}</span>
                            </div>
                        )}
                        {user && (
                            <button className="theme-toggle" onClick={onLogout} aria-label="Sign out">
                                <LogOut size={14} strokeWidth={2.5} />
                            </button>
                        )}
                        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                            {isDark ? <Sun size={14} strokeWidth={2.5} /> : <Moon size={14} strokeWidth={2.5} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Bottom Navigation (shown only on mobile via CSS) */}
            {!publicMode && <nav className="mobile-bottom-nav" role="navigation" aria-label="Mobile navigation">
                {mobileNav.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`mobile-nav-item${item.primary ? ' primary' : ''}${isActive(item.path) ? ' active' : ''}`}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>}
        </>
    );
}
