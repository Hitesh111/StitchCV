import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Chrome, Linkedin } from 'lucide-react';
import api from '../services/api';

export default function Auth({ mode = 'login', addToast, onAuthenticated }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const isSignup = mode === 'signup';
    const nextPath = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('next') || '/app';
    }, [location.search]);
    const oauthError = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('error');
    }, [location.search]);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        try {
            const user = isSignup
                ? await api.signup({ full_name: fullName, email, password })
                : await api.login({ email, password });
            onAuthenticated?.(user);
            addToast(isSignup ? 'Account created successfully' : 'Signed in successfully', 'success');
            navigate(nextPath);
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    function handleOAuth(provider) {
        window.location.href = `/api/auth/oauth/${provider}/start?next=${encodeURIComponent(nextPath)}`;
    }

    return (
        <div className="auth-shell">
            <div className="auth-panel">
                <div className="auth-copy">
                    <div className="page-kicker">Secure workspace access</div>
                    <h1 className="auth-title">{isSignup ? 'Create your HireFlow workspace' : 'Sign in to HireFlow'}</h1>
                    <p className="auth-subtitle">
                        Keep discovery, tailoring, and application tracking inside one authenticated workspace.
                    </p>
                    <div className="auth-highlights">
                        <div className="auth-highlight-card">
                            <span className="label-caps">Auth model</span>
                            <strong>Session-based access</strong>
                            <p>Email/password plus Google and LinkedIn sign-in.</p>
                        </div>
                        <div className="auth-highlight-card">
                            <span className="label-caps">Workspace scope</span>
                            <strong>One account, one pipeline</strong>
                            <p>Jobs, tailored resumes, and application progress stay tied to a single identity.</p>
                        </div>
                    </div>
                </div>

                <div className="auth-card">
                    <div className="auth-card-header">
                        <h2>{isSignup ? 'Create account' : 'Welcome back'}</h2>
                        <p>{isSignup ? 'Set up your workspace access.' : 'Sign in to continue.'}</p>
                    </div>

                    {oauthError && <div className="auth-alert">OAuth failed: {oauthError.replaceAll('_', ' ')}</div>}

                    <div className="auth-oauth-row">
                        <button type="button" className="btn btn-ghost auth-oauth-btn" onClick={() => handleOAuth('google')}>
                            <Chrome size={15} />
                            Continue with Google
                        </button>
                        <button type="button" className="btn btn-ghost auth-oauth-btn" onClick={() => handleOAuth('linkedin')}>
                            <Linkedin size={15} />
                            Continue with LinkedIn
                        </button>
                    </div>

                    <div className="auth-divider"><span>or use email</span></div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        {isSignup && (
                            <div className="form-group">
                                <label className="form-label">Full name</label>
                                <input
                                    className="form-input"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Hitesh Kumar"
                                    required
                                />
                            </div>
                        )}
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Minimum 8 characters"
                                required
                                minLength={8}
                            />
                        </div>
                        <button className="btn btn-primary btn-full" disabled={loading}>
                            {loading ? (isSignup ? 'Creating account...' : 'Signing in...') : (
                                <>
                                    {isSignup ? 'Create account' : 'Sign in'}
                                    <ArrowRight size={15} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="auth-footer">
                        {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <Link to={`${isSignup ? '/login' : '/signup'}?next=${encodeURIComponent(nextPath)}`}>
                            {isSignup ? 'Sign in' : 'Create one'}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
