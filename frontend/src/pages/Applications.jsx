import { useState, useEffect } from 'react';
import { Send, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { NudgeBar, EmptyState } from '../components/Shared';

export default function Applications({ addToast }) {
    const navigate = useNavigate();
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [actionLoading, setActionLoading] = useState('');

    useEffect(() => { loadApplications(); }, [statusFilter]);

    async function loadApplications() {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            const data = await api.getApplications(params);
            setApplications(data);
        } catch (err) {
            setApplications([]);
        } finally {
            setLoading(false);
        }
    }

    async function handleApprove(appId) {
        setActionLoading(appId);
        try {
            await api.approve(appId);
            addToast('Application approved for submission.', 'success');
            loadApplications();
        } catch (err) {
            addToast('Approval failed: ' + err.message, 'error');
        } finally {
            setActionLoading('');
        }
    }

    async function handleSubmit(appId) {
        setActionLoading(appId);
        try {
            await api.apply(appId, false);
            addToast('Application submitted successfully!', 'success');
            loadApplications();
        } catch (err) {
            addToast('Submission failed: ' + err.message, 'error');
        } finally {
            setActionLoading('');
        }
    }

    const statusOptions = ['all', 'draft', 'pending_review', 'approved', 'submitted', 'failed'];

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 className="page-title">Applications</h2>
                    <p className="page-subtitle">Track and manage your submitted applications.</p>
                </div>
                <button className="btn btn-ghost" onClick={loadApplications}>
                    Refresh List
                </button>
            </div>

            <div className="actions-bar" style={{ marginBottom: 32 }}>
                <div className="pill-group">
                    {statusOptions.map(s => (
                        <button
                            key={s}
                            className={`pill-tab ${statusFilter === (s === 'all' ? '' : s) ? 'active' : ''}`}
                            onClick={() => setStatusFilter(s === 'all' ? '' : s)}
                        >
                            {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="loading-state">
                    <div className="skeleton" style={{ width: '100%', height: 40, marginBottom: 1 }} />
                    <div className="skeleton" style={{ width: '100%', height: 60, marginBottom: 1 }} />
                    <div className="skeleton" style={{ width: '100%', height: 60, marginBottom: 1 }} />
                </div>
            ) : applications.length === 0 ? (
                <EmptyState 
                    icon={Clock} 
                    title="No applications yet" 
                    subtitle="Prepare applications from matched jobs in your dashboard to get started."
                    actionText="Go to Dashboard"
                    onAction={() => navigate('/')}
                />
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Role</th>
                                <th>Company</th>
                                <th>Match</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {applications.map(app => {
                                const isActionable = app.status === 'pending_review' || app.status === 'draft' || app.status === 'approved';
                                return (
                                <tr key={app.id}>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{app.role || '—'}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{app.company || '—'}</td>
                                    <td>
                                        {app.match_score != null ? (
                                            <span style={{ fontWeight: 600 }}>{Math.round(app.match_score * 100)}%</span>
                                        ) : <span style={{ color: 'var(--border)' }}>—</span>}
                                    </td>
                                    <td>
                                        <span className={`chip ${isActionable ? 'chip-yellow' : 'chip-neutral'}`}>
                                            {app.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                                        {app.created_at ? new Date(app.created_at).toLocaleDateString() : '—'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {app.status === 'pending_review' && (
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    onClick={() => handleApprove(app.id)}
                                                    disabled={actionLoading === app.id}
                                                >
                                                    <CheckCircle size={14} />
                                                    {actionLoading === app.id ? 'Wait...' : 'Approve'}
                                                </button>
                                            )}
                                            {(app.status === 'approved' || app.status === 'draft') && (
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => handleSubmit(app.id)}
                                                    disabled={actionLoading === app.id}
                                                >
                                                    <Send size={14} color="#1C1917" />
                                                    {actionLoading === app.id ? 'Sending...' : 'Submit'}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <NudgeBar 
                text="Discover → Jobs → Analyze → Prepare → here"
                buttonText="Tailor Resume"
                onClick={() => navigate('/tailor')}
            />
        </div>
    );
}
