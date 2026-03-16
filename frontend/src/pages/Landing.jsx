import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileText, Search, ShieldCheck, Sparkles } from 'lucide-react';

export default function Landing({ user }) {
    const primaryHref = user ? '/app' : '/signup';

    return (
        <div className="landing-page">
            <section className="landing-hero">
                <div className="landing-hero-copy">
                    <div className="page-kicker">AI job search operating system</div>
                    <h1 className="landing-title">Discover roles, tailor resumes, and run applications from one serious workspace.</h1>
                    <p className="landing-subtitle">
                        HireFlow combines sourcing, JD analysis, resume tailoring, and application tracking into one focused workflow designed for high-volume job hunts.
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
                        <span className="label-caps">Core flow</span>
                        <strong>Discover → Analyze → Tailor → Apply</strong>
                        <p>Move from sourced jobs to submission-ready material without bouncing across tools.</p>
                    </div>
                    <div className="landing-metric-grid">
                        <div className="landing-mini-card">
                            <Search size={16} />
                            <div>
                                <strong>Discovery</strong>
                                <p>Browser-backed sourcing from live job pages.</p>
                            </div>
                        </div>
                        <div className="landing-mini-card">
                            <Sparkles size={16} />
                            <div>
                                <strong>Tailoring</strong>
                                <p>Resume adaptation with preview-first review.</p>
                            </div>
                        </div>
                        <div className="landing-mini-card">
                            <FileText size={16} />
                            <div>
                                <strong>Exports</strong>
                                <p>PDF and JSON output for round-tripping.</p>
                            </div>
                        </div>
                        <div className="landing-mini-card">
                            <ShieldCheck size={16} />
                            <div>
                                <strong>Auth</strong>
                                <p>Email, Google, and LinkedIn sign-in.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="landing-grid">
                <div className="landing-feature-card">
                    <div className="label-caps">Discover</div>
                    <h3>Pull job opportunities directly into your pipeline</h3>
                    <p>Search live sources, review discovered jobs, and keep qualification close to sourcing.</p>
                </div>
                <div className="landing-feature-card">
                    <div className="label-caps">Tailor</div>
                    <h3>Generate targeted resumes from a reusable master profile</h3>
                    <p>Paste a JD, fetch it from a URL, or upload a file and compare the original against the tailored output.</p>
                </div>
                <div className="landing-feature-card">
                    <div className="label-caps">Track</div>
                    <h3>Manage approvals and applications like an operating workflow</h3>
                    <p>Keep review, submission state, and application progress in one system instead of disconnected docs.</p>
                </div>
            </section>
        </div>
    );
}
