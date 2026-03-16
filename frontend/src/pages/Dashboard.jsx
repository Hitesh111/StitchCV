import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import api from '../services/api';
import { NudgeBar, ST_COLORS } from '../components/Shared';

export default function Dashboard({ addToast }) {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState('');
    const userName = "Hitesh"; // Or fetch from profile API

    useEffect(() => { loadStats(); }, []);

    async function loadStats() {
        try {
            const data = await api.getStats();
            setStats(data);
        } catch {
            setStats({
                jobs: { new: 0, analyzed: 0, matched: 0, applied: 0, skipped: 0 },
                applications: { draft: 0, pending_review: 0, submitted: 0, failed: 0 },
                recent: { jobs_discovered_24h: 0, applications_created_24h: 0 },
            });
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(action) {
        setActionLoading(action);
        try {
            let result;
            if (action === 'analyze') result = await api.analyze({ limit: 10 });
            else if (action === 'prepare') result = await api.prepare({ min_score: 0.5, limit: 5 });
            addToast(result.message, 'success');
            loadStats();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setActionLoading('');
        }
    }

    if (loading) {
        return (
            <div className="loading-state">
                <div className="skeleton" style={{ width: 200, height: 32, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: 300, height: 20, marginBottom: 32 }} />
                <div className="stats-grid" style={{ width: '100%' }}>
                    {[1, 2, 3, 4].map(i => <div key={i} className="card skeleton" style={{ height: 110 }} />)}
                </div>
            </div>
        );
    }

    const totalJobs = stats ? Object.values(stats.jobs).reduce((a, b) => a + b, 0) : 0;
    const totalApps = stats ? Object.values(stats.applications).reduce((a, b) => a + b, 0) : 0;
    const matchedJobs = stats?.jobs?.matched || 0;
    const pendingApps = stats?.applications?.pending_review || 0;

    const topStats = [
        { label: 'Total Jobs', value: totalJobs, sub: `+${stats?.recent?.jobs_discovered_24h || 0} today` },
        { label: 'Applications', value: totalApps, sub: `+${stats?.recent?.applications_created_24h || 0} today` },
        { label: 'Matched', value: matchedJobs, sub: 'Ready to apply', isHighlight: true },
        { label: 'Pending Review', value: pendingApps, sub: 'Awaiting approval' },
    ];

    return (
        <div>
            <div className="hero-split app-hero dashboard-hero" style={{ marginBottom: 24 }}>
                <div className="hero-split-copy">
                    <div className="page-kicker">Pipeline overview</div>
                    <h2 className="page-title hero-title">Good morning, {userName}</h2>
                    <p className="page-subtitle hero-subtitle">Discovery, matching, and application progress in one place.</p>
                    <div className="page-header-actions">
                        <button className="btn btn-ghost" onClick={() => handleAction('prepare')} disabled={!!actionLoading}>
                            {actionLoading === 'prepare' ? 'Preparing applications...' : 'Prepare applications'}
                        </button>
                        <button className="btn btn-primary" onClick={() => handleAction('analyze')} disabled={!!actionLoading}>
                            {actionLoading === 'analyze' ? 'Analyzing jobs...' : 'Analyze jobs'}
                        </button>
                    </div>
                </div>
                <div className="hero-mosaic compact-mosaic">
                    <div className="hero-mosaic-card hero-mosaic-card-accent">
                        <div className="label-caps">Matched jobs</div>
                        <div className="hero-mosaic-value">{matchedJobs}</div>
                        <div className="hero-mosaic-meta">ready for tailoring</div>
                    </div>
                    <div className="hero-mosaic-card">
                        <div className="hero-mosaic-icon"><Zap size={16} /></div>
                        <div className="hero-mosaic-text">Automated analysis, tailoring, and application preparation.</div>
                    </div>
                    <div className="hero-mosaic-card hero-mosaic-card-dark">
                        <div className="label-caps">Pending review</div>
                        <div className="hero-mosaic-inline">
                            <span className="hero-mosaic-value small">{pendingApps}</span>
                            <span className="hero-mosaic-meta">awaiting approval</span>
                        </div>
                    </div>
                    <div className="hero-mosaic-card">
                        <div className="label-caps">24h activity</div>
                        <div className="hero-mosaic-inline">
                            <span className="hero-mosaic-value small">{stats?.recent?.jobs_discovered_24h || 0}</span>
                            <span className="hero-mosaic-meta">jobs in the last 24h</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="stats-grid">
                {topStats.map(({ label, value, sub, isHighlight }) => (
                    <div className={`card stat-card ${isHighlight ? 'highlight card-accent' : ''}`} key={label}>
                        <div className="label-caps" style={isHighlight ? { color: 'var(--yellow-dark)' } : {}}>{label}</div>
                        <div className="stat-val-large" style={isHighlight ? { color: 'var(--yellow-dark)' } : {}}>{value}</div>
                        <div style={{ fontSize: '10.5px', color: isHighlight ? 'var(--yellow-dark)' : 'var(--text-muted)', marginTop: '4px', opacity: 0.8 }}>{sub}</div>
                    </div>
                ))}
            </div>

            <div className="showcase-panel app-panel">
                <div className="showcase-panel-header">
                    <div>
                        <div className="label-caps">Live pipelines</div>
                        <h3 className="showcase-panel-title">Pipeline status</h3>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

                    <div className="card feature-card-dark">
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 className="card-title">Jobs Pipeline</h3>
                            <span className="label-caps">{totalJobs} total</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {Object.entries(stats?.jobs || {}).map(([status, count]) => {
                                const isMatched = status === 'matched';
                                return (
                                    <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: ST_COLORS[status] || '#A8A29E' }} />
                                        <span style={{ fontSize: '13px', flex: 1, textTransform: 'capitalize', fontWeight: 600 }}>
                                            {status.replace('_', ' ')}
                                        </span>
                                        {isMatched && count > 0 ? (
                                            <span className="chip chip-yellow">{count}</span>
                                        ) : (
                                            <span className="chip chip-neutral">{count}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="card feature-card-dark">
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 className="card-title">Applications</h3>
                            <span className="label-caps">{totalApps} total</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {Object.entries(stats?.applications || {}).map(([status, count]) => {
                                const isActionable = status === 'pending_review' || status === 'draft';
                                return (
                                    <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: ST_COLORS[status] || '#A8A29E' }} />
                                        <span style={{ fontSize: '13px', flex: 1, textTransform: 'capitalize', fontWeight: 600 }}>
                                            {status.replace('_', ' ')}
                                        </span>
                                        {isActionable && count > 0 ? (
                                            <span className="chip chip-yellow">{count}</span>
                                        ) : (
                                            <span className="chip chip-neutral">{count}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <NudgeBar 
                text={totalJobs === 0 ? "Nothing here yet — start by discovering jobs." : "Need more options? Run a new discovery search."}
                buttonText="Go to Discover"
                onClick={() => navigate('/discover')}
            />
        </div>
    );
}
