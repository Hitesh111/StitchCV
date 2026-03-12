import { useState, useEffect } from 'react';
import {
    Briefcase,
    FileText,
    TrendingUp,
    Clock,
    CheckCircle,
    AlertCircle,
    Zap,
    BarChart3,
} from 'lucide-react';
import api from '../services/api';

export default function Dashboard({ addToast }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState('');

    useEffect(() => {
        loadStats();
    }, []);

    async function loadStats() {
        try {
            const data = await api.getStats();
            setStats(data);
        } catch (err) {
            // If API is down, show placeholder stats
            setStats({
                jobs: { new: 0, analyzed: 0, matched: 0, applied: 0, skipped: 0 },
                applications: { draft: 0, pending_review: 0, submitted: 0, failed: 0 },
                recent: { jobs_discovered_24h: 0, applications_created_24h: 0 },
            });
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(action, label) {
        setActionLoading(action);
        try {
            let result;
            switch (action) {
                case 'analyze':
                    result = await api.analyze({ limit: 10 });
                    break;
                case 'prepare':
                    result = await api.prepare({ min_score: 0.5, limit: 5 });
                    break;
                default:
                    return;
            }
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
            <div className="loading-container">
                <div className="spinner" />
                <p>Loading dashboard...</p>
            </div>
        );
    }

    const totalJobs = stats ? Object.values(stats.jobs).reduce((a, b) => a + b, 0) : 0;
    const totalApps = stats ? Object.values(stats.applications).reduce((a, b) => a + b, 0) : 0;

    return (
        <div>
            <div className="page-header">
                <h2>Dashboard</h2>
                <p>Overview of your job application pipeline</p>
            </div>

            {/* Quick Actions */}
            <div className="actions-bar">
                <button
                    className="btn btn-primary"
                    onClick={() => handleAction('analyze', 'Analyze')}
                    disabled={!!actionLoading}
                >
                    <Zap size={16} />
                    {actionLoading === 'analyze' ? 'Analyzing...' : 'Analyze Jobs'}
                </button>
                <button
                    className="btn btn-secondary"
                    onClick={() => handleAction('prepare', 'Prepare')}
                    disabled={!!actionLoading}
                >
                    <FileText size={16} />
                    {actionLoading === 'prepare' ? 'Preparing...' : 'Prepare Applications'}
                </button>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Total Jobs</div>
                    <div className="stat-value">{totalJobs}</div>
                    <div className="stat-subtitle">
                        {stats?.recent?.jobs_discovered_24h || 0} new in 24h
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Applications</div>
                    <div className="stat-value">{totalApps}</div>
                    <div className="stat-subtitle">
                        {stats?.recent?.applications_created_24h || 0} created in 24h
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Matched Jobs</div>
                    <div className="stat-value">{stats?.jobs?.matched || 0}</div>
                    <div className="stat-subtitle">Ready for application</div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Pending Review</div>
                    <div className="stat-value">{stats?.applications?.pending_review || 0}</div>
                    <div className="stat-subtitle">Awaiting approval</div>
                </div>
            </div>

            {/* Pipeline Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="card">
                    <div className="card-header">
                        <h3><Briefcase size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Jobs Pipeline</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {Object.entries(stats?.jobs || {}).map(([status, count]) => (
                            <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <StatusIcon status={status} />
                                    <span style={{ fontSize: 14, textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>
                                </div>
                                <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-accent)' }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3><FileText size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Applications Pipeline</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {Object.entries(stats?.applications || {}).map(([status, count]) => (
                            <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <StatusIcon status={status} />
                                    <span style={{ fontSize: 14, textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>
                                </div>
                                <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-accent)' }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatusIcon({ status }) {
    const style = { width: 18, height: 18 };
    switch (status) {
        case 'new': return <Clock style={{ ...style, color: 'var(--accent-info)' }} />;
        case 'analyzed': return <BarChart3 style={{ ...style, color: 'var(--accent-warning)' }} />;
        case 'matched': return <TrendingUp style={{ ...style, color: 'var(--accent-success)' }} />;
        case 'applied':
        case 'submitted': return <CheckCircle style={{ ...style, color: '#a78bfa' }} />;
        case 'pending_review':
        case 'draft': return <AlertCircle style={{ ...style, color: 'var(--accent-warning)' }} />;
        case 'failed':
        case 'rejected': return <AlertCircle style={{ ...style, color: 'var(--accent-danger)' }} />;
        default: return <Clock style={{ ...style, color: 'var(--text-muted)' }} />;
    }
}
