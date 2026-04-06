import React, { useState, useEffect, useRef } from 'react';
import { FileText, Briefcase, Calendar, X, Eye, Trash2, Edit, ArrowRight, MoreHorizontal, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ResumeTemplate from '../components/ResumeTemplate';

function AtsBar({ pct }) {
    if (pct == null) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: pct >= 70 ? 'var(--success)' : '#D4A017', flexShrink: 0 }} />
            <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', width: 56 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 70 ? 'var(--success)' : '#D4A017', borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
        </div>
    );
}

export default function Dashboard({ addToast }) {
    const [applications, setApplications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingResume, setViewingResume] = useState(null);
    const [viewingApp, setViewingApp] = useState(null);
    const [viewingJob, setViewingJob] = useState(null);
    const [editingApp, setEditingApp] = useState(null);
    const [editForm, setEditForm] = useState({ company: '', role: '', status: '' });
    const [openOverflow, setOpenOverflow] = useState(null); // appId | null
    const [confirmDelete, setConfirmDelete] = useState(null); // appId | null
    const pdfRef = useRef(null);

    useEffect(() => {
        api.getApplications()
           .then(data => setApplications(data))
           .catch(err => addToast('Failed to load applications: ' + err.message, 'error'))
           .finally(() => setIsLoading(false));
    }, [addToast]);

    // Close overflow on outside click
    useEffect(() => {
        if (!openOverflow) return;
        const handler = () => setOpenOverflow(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [openOverflow]);

    const handleViewResume = async (app) => {
        try {
            setViewingResume(null); setViewingJob(null);
            const [resumeData, jobData] = await Promise.all([
                api.getApplicationResume(app.id),
                api.getJob(app.job_id).catch(() => ({ failed: true }))
            ]);
            setViewingResume(resumeData); setViewingJob(jobData); setViewingApp(app);
        } catch (e) {
            addToast('Failed to fetch resume: ' + e.message, 'error');
        }
    };

    const handleDelete = async (appId) => {
        try {
            await api.deleteApplication(appId);
            setApplications(prev => prev.filter(a => a.id !== appId));
            setConfirmDelete(null);
            addToast('Application deleted', 'success');
        } catch (e) {
            addToast('Failed to delete: ' + e.message, 'error');
        }
    };

    const handleEdit = (app) => {
        setEditingApp(app);
        setEditForm({ company: app.company, role: app.role, status: app.status });
        setOpenOverflow(null);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        try {
            await api.updateApplication(editingApp.id, editForm);
            setApplications(prev => prev.map(a => a.id === editingApp.id ? { ...a, ...editForm } : a));
            setEditingApp(null);
            addToast('Updated', 'success');
        } catch (e) {
            addToast('Failed to update: ' + e.message, 'error');
        }
    };

    // Derive ATS pct from stored scores if available
    const getAtsPct = (app) => {
        if (app.output_scores) {
            const vals = Object.values(app.output_scores);
            return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        }
        return null;
    };

    return (
        <>
            <div style={{ paddingBottom: 64 }} className="no-print">
                {/* Workspace page header */}
                <div className="ws-page-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="ws-page-title">Applications</span>
                        {!isLoading && applications.length > 0 && (
                            <span className="count-badge">{applications.length} tailored</span>
                        )}
                    </div>
                    <Link to="/tailor" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                        New <ArrowRight size={11} />
                    </Link>
                </div>

                <div style={{
                    background: 'var(--bg-card)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 10,
                    overflow: 'hidden'
                }}>
                    {isLoading ? (
                        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            Loading...
                        </div>
                    ) : applications.length === 0 ? (
                        <div className="empty-state">
                            <FileText size={32} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.3 }} />
                            <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No applications yet</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, maxWidth: 240 }}>
                                Craft your first AI-tailored resume and it will appear here.
                            </p>
                            <Link to="/tailor" className="btn btn-ghost btn-sm" style={{ fontSize: 12, gap: 6 }}>
                                Go to Tailor <ArrowRight size={12} />
                            </Link>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{
                                    borderBottom: '0.5px solid var(--border)',
                                    fontSize: 11, color: 'var(--text-muted)', fontWeight: 500
                                }}>
                                    <th style={{ padding: '12px 20px' }}>Date</th>
                                    <th style={{ padding: '12px 20px' }}>Role / Company</th>
                                    <th style={{ padding: '12px 20px' }}>ATS match</th>
                                    <th style={{ padding: '12px 20px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {applications.map(app => (
                                    <tr key={app.id}
                                        style={{ borderBottom: '0.5px solid var(--border)', transition: 'background 100ms ease' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input, var(--bg-surface))'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}>

                                        {/* Date */}
                                        <td style={{ padding: '14px 20px', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>
                                            {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </td>

                                        {/* Role + Company */}
                                        <td style={{ padding: '14px 20px' }}>
                                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                                                {app.role || 'Untitled role'}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Briefcase size={10} /> {app.company || 'Company'}
                                            </div>
                                        </td>

                                        {/* ATS Match */}
                                        <td style={{ padding: '14px 20px' }}>
                                            {confirmDelete === app.id ? (
                                                <span />
                                            ) : (
                                                <AtsBar pct={getAtsPct(app)} />
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                            {confirmDelete === app.id ? (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Delete?</span>
                                                    <button className="btn btn-sm" style={{ fontSize: 11, color: 'var(--error)', background: 'rgba(220,38,38,0.08)', padding: '5px 10px' }}
                                                        onClick={() => handleDelete(app.id)}>Confirm</button>
                                                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '5px 10px' }}
                                                        onClick={() => setConfirmDelete(null)}>Cancel</button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                                    <button className="btn btn-sm" onClick={() => handleViewResume(app)}
                                                        style={{ fontSize: 11, background: 'rgba(212,160,23,0.1)', color: '#D4A017', border: '0.5px solid rgba(212,160,23,0.2)', padding: '5px 12px' }}>
                                                        <Eye size={12} /> View
                                                    </button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(app)}
                                                        style={{ fontSize: 11, padding: '5px 10px' }}>
                                                        <Edit size={12} /> Edit
                                                    </button>
                                                    <div className="overflow-menu-wrapper">
                                                        <button className="btn btn-ghost btn-sm"
                                                            style={{ fontSize: 11, padding: '5px 8px' }}
                                                            onClick={e => { e.stopPropagation(); setOpenOverflow(openOverflow === app.id ? null : app.id); }}>
                                                            <MoreHorizontal size={14} />
                                                        </button>
                                                        {openOverflow === app.id && (
                                                            <div className="overflow-menu" onClick={e => e.stopPropagation()}>
                                                                <button className="overflow-menu-item danger"
                                                                    onClick={() => { setOpenOverflow(null); setConfirmDelete(app.id); }}>
                                                                    <Trash2 size={12} /> Delete
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Edit modal */}
            {editingApp && (
                <div className="modal-overlay no-print" onClick={() => setEditingApp(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, padding: 0 }}>
                        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '0.5px solid var(--border)', margin: 0 }}>
                            <div>
                                <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Edit application</h2>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Update tracking details</p>
                            </div>
                            <button className="modal-close" onClick={() => setEditingApp(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ padding: 24 }}>
                            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Company name</label>
                                    <input className="form-input" value={editForm.company}
                                        onChange={e => setEditForm({ ...editForm, company: e.target.value })}
                                        required placeholder="e.g. Acme Corp" />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Role</label>
                                    <input className="form-input" value={editForm.role}
                                        onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                                        required placeholder="e.g. Frontend Engineer" />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Status</label>
                                    <select className="form-input" value={editForm.status}
                                        onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                                        <option value="pending_review">Pending review</option>
                                        <option value="approved">Approved</option>
                                        <option value="submitted">Submitted</option>
                                        <option value="failed">Failed</option>
                                        <option value="withdrawn">Withdrawn</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingApp(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary btn-sm">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Resume viewer modal */}
            {viewingResume && (
                <div className="modal-overlay no-print"
                    onClick={() => { setViewingResume(null); setViewingJob(null); }}
                    style={{ padding: '28px', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
                    <div className="modal-content resume-viewer-modal" onClick={e => e.stopPropagation()} style={{
                        maxWidth: 1360, width: '100%', height: '100%', margin: '0 auto',
                        borderRadius: 12, border: '0.5px solid var(--border)',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        backgroundColor: 'var(--bg-card)'
                    }}>
                        {/* Modal header */}
                        <div style={{
                            padding: '16px 24px', borderBottom: '0.5px solid var(--border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'var(--bg-surface)'
                        }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{viewingApp?.company}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{viewingApp?.role}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <button className="btn btn-primary btn-sm" onClick={() => {
                                    const originalTitle = document.title;
                                    const originalPath = window.location.pathname;
                                    const candidateName = viewingResume?.personal_info?.name
                                        ? viewingResume.personal_info.name.replace(/\s+/g, '_') : 'Candidate';
                                    document.title = `${candidateName}_Resume`;
                                    window.history.replaceState(null, '', '/');
                                    setTimeout(() => {
                                        window.print();
                                        document.title = originalTitle;
                                        window.history.replaceState(null, '', originalPath);
                                    }, 100);
                                }}>
                                    <Printer size={12} /> Download PDF
                                </button>
                                <button className="modal-close" onClick={() => { setViewingResume(null); setViewingJob(null); }}>
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* JD sidebar */}
                            <div style={{
                                width: 340, borderRight: '0.5px solid var(--border)',
                                padding: 20, overflowY: 'auto', background: 'var(--bg-surface)'
                            }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 12 }}>Job description</div>
                                {viewingJob ? (
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
                                        {viewingJob.failed ? (
                                            <span style={{ fontStyle: 'italic', color: 'var(--error)' }}>Failed to load</span>
                                        ) : (
                                            viewingJob.job_description || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No description recorded</span>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading...</div>
                                )}
                            </div>

                            {/* Resume pane */}
                            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: 'var(--bg-page)', padding: '28px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100%' }}>
                                    <div style={{
                                        width: 816, minHeight: 1056,
                                        backgroundColor: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                        borderRadius: 3
                                    }}>
                                        <ResumeTemplate data={viewingResume} ref={pdfRef} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {viewingResume && (
                <div className="print-only">
                    <ResumeTemplate data={viewingResume} />
                </div>
            )}
        </>
    );
}
