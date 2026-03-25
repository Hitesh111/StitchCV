import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileText, Search, ShieldCheck, Sparkles } from 'lucide-react';

export default function Landing({ user }) {
    const primaryHref = user ? '/tailor' : '/signup';

    return (
        <div className="landing-page">
            <section className="landing-hero">
                <div className="landing-hero-copy">
                    <div className="page-kicker">AI-powered resume adaptation</div>
                    <h1 className="landing-title">Tailor your resume for any job description in seconds.</h1>
                    <p className="landing-subtitle">
                        StichCV automatically generates targeted, mathematically optimized resumes from your master profile to help you land more interviews.
                    </p>
                    <div className="landing-actions">
                        <Link to={primaryHref} className="btn btn-primary">
                            {user ? 'Open workspace' : 'Create account'}
                            <ArrowRight size={15} />
                        </Link>
                        <Link to={user ? '/tailor' : '/login'} className="btn btn-outline">
                            {user ? 'Go to tailor flow' : 'Sign in'}
                        </Link>
                    </div>
                    <div className="landing-proof">
                        <span><CheckCircle2 size={14} /> Link-based JD scraping</span>
                        <span><CheckCircle2 size={14} /> Text-native resume export</span>
                        <span><CheckCircle2 size={14} /> Deterministic ATS scoring</span>
                    </div>
                </div>

                <div className="landing-hero-panel">
                    <div className="landing-metric-card landing-metric-card-accent">
                        <span className="label-caps">Tailor-First Workflow</span>
                        <strong>Compare → Adapt → Preview → Export</strong>
                        <p>Move from a saved job description to a completely customized, targeted resume without ever leaving the workspace.</p>
                    </div>
                    <div className="landing-metric-grid">
                        <div className="landing-mini-card">
                            <Search size={16} />
                            <div>
                                <strong>Context</strong>
                                <p>Import JDs directly via URL or paste.</p>
                            </div>
                        </div>
                        <div className="landing-mini-card">
                            <Sparkles size={16} />
                            <div>
                                <strong>Tailoring</strong>
                                <p>AI rewrites to match exact keywords.</p>
                            </div>
                        </div>
                        <div className="landing-mini-card">
                            <ShieldCheck size={16} />
                            <div>
                                <strong>Analysis</strong>
                                <p>Real-time ATS keyword matching score.</p>
                            </div>
                        </div>
                        <div className="landing-mini-card">
                            <FileText size={16} />
                            <div>
                                <strong>Exports</strong>
                                <p>Clean PDF and JSON output.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="landing-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="landing-feature-card">
                    <div className="label-caps">Tailor</div>
                    <h3>Generate targeted resumes from a reusable master profile</h3>
                    <p>Paste a JD, fetch it from a URL, or upload a file and compare your original experience against the tailored output.</p>
                </div>
            </section>
        </div>
    );
}
