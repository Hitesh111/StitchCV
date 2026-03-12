import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Send, Eye } from 'lucide-react';
import api from '../services/api';

export default function Applications({ addToast }) {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [actionLoading, setActionLoading] = useState('');

    useEffect(() => {
        loadApplications();
    }, [statusFilter]);

    async function loadApplications() {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter) params.status = statusFilter;
            const data = await api.getApplications(params);
            setApplications(data);
        } catch (err) {
            addToast('Failed to load applications: ' + err.message, 'error');
            setApplications([]);
        } finally {
            setLoading(false);
        }
    }

    async function handleApprove(appId) {
        setActionLoading(appId);
        try {
            await api.approve(appId);
            addToast('Application approved!', 'success');
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
            addToast('Application submitted!', 'success');
            loadApplications();
        } catch (err) {
            addToast('Submission failed: ' + err.message, 'error');
        } finally {
            setActionLoading('');
        }
    }

    const statusOptions = ['', 'draft', 'pending_review', 'approved', 'submitted', 'failed'];

    return (
        <div>
            <div className="page-header">
                <h2>Applications</h2>
                <p>Track and manage your job applications</p>
            </div>

            <div className="actions-bar">
                <select
                    className="form-select"
                    style={{ width: 180 }}
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                >
                    <option value="">All Statuses</option>
                    {statusOptions.filter(Boolean).map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>
                    ))}
                </select>

                <button className="btn btn-secondary btn-sm" onClick={loadApplications}>
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner" />
                    <p>Loading applications...</p>
                </div>
            ) : applications.length === 0 ? (
                <div className="empty-state">
                    <Clock size={48} />
                    <h3>No applications yet</h3>
                    <p>Prepare applications from matched jobs to get started</p>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Role</th>
                                <th>Company</th>
                                <th>Score</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {applications.map(app => (
                                <tr key={app.id}>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {app.role || '—'}
                                    </td>
                                    <td>{app.company || '—'}</td>
                                    <td>
                                        {app.match_score != null ? (
                                            <span style={{
                                                fontWeight: 600,
                                                color: app.match_score >= 0.7
                                                    ? 'var(--accent-success)'
                                                    : app.match_score >= 0.4
                                                        ? 'var(--accent-warning)'
                                                        : 'var(--accent-danger)',
                                            }}>
                                                {Math.round(app.match_score * 100)}%
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td>
                                        <span className={`badge badge-${app.status}`}>
                                            {app.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                        {app.created_at ? new Date(app.created_at).toLocaleDateString() : '—'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {app.status === 'pending_review' && (
                                                <button
                                                    className="btn btn-success btn-sm"
                                                    onClick={() => handleApprove(app.id)}
                                                    disabled={actionLoading === app.id}
                                                >
                                                    <CheckCircle size={14} />
                                                    {actionLoading === app.id ? '...' : 'Approve'}
                                                </button>
                                            )}
                                            {(app.status === 'approved' || app.status === 'draft') && (
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => handleSubmit(app.id)}
                                                    disabled={actionLoading === app.id}
                                                >
                                                    <Send size={14} />
                                                    {actionLoading === app.id ? '...' : 'Submit'}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
