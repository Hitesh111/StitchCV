import React, { useState, useEffect, useRef } from 'react';
import { FileText, Briefcase, Calendar, X, Printer, Eye, Trash2, Edit } from 'lucide-react';
import api from '../services/api';
import ResumeTemplate from '../components/ResumeTemplate';

export default function Dashboard({ addToast }) {
    const [applications, setApplications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingResume, setViewingResume] = useState(null);
    const [viewingApp, setViewingApp] = useState(null);
    const [viewingJob, setViewingJob] = useState(null);
    const [editingApp, setEditingApp] = useState(null);
    const [editForm, setEditForm] = useState({ company: '', role: '', status: '' });
    const pdfRef = useRef(null);

    useEffect(() => {
        api.getApplications()
           .then(data => setApplications(data))
           .catch(err => addToast('Failed to load applications: ' + err.message, 'error'))
           .finally(() => setIsLoading(false));
    }, [addToast]);

    const handleViewResume = async (app) => {
        try {
            setViewingResume(null);
            setViewingJob(null);
            
            const [resumeData, jobData] = await Promise.all([
                api.getApplicationResume(app.id),
                api.getJob(app.job_id).catch(() => ({ failed: true }))
            ]);
            
            setViewingResume(resumeData);
            setViewingJob(jobData);
            setViewingApp(app);
        } catch(e) {
            addToast('Failed to fetch resume: ' + e.message, 'error');
        }
    };

    const handlePrintPDF = () => {
        window.print();
    };

    const handleDelete = async (appId) => {
        if (!window.confirm("Are you sure you want to delete this application? This cannot be undone.")) return;
        
        try {
            await api.deleteApplication(appId);
            setApplications(prev => prev.filter(a => a.id !== appId));
            addToast('Application deleted successfully', 'success');
        } catch(e) {
            addToast('Failed to delete: ' + e.message, 'error');
        }
    };

    const handleEdit = (app) => {
        setEditingApp(app);
        setEditForm({ company: app.company, role: app.role, status: app.status });
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        try {
            await api.updateApplication(editingApp.id, editForm);
            setApplications(prev => prev.map(a => a.id === editingApp.id ? { ...a, ...editForm } : a));
            setEditingApp(null);
            addToast('Application updated', 'success');
        } catch(e) {
            addToast('Failed to update: ' + e.message, 'error');
        }
    };

    return (
        <>
            <div style={{ paddingBottom: 64 }} className="no-print">
                <div className="hero-split app-hero tailor-hero" style={{ marginBottom: 24 }}>
                    <div className="hero-split-copy">
                        <div className="page-kicker">Saved</div>
                        <h2 className="page-title hero-title">My Applications</h2>
                        <p className="page-subtitle hero-subtitle">Review and manage your previously tailored job applications.</p>
                    </div>
                </div>

                <div className="showcase-panel app-panel" style={{ marginBottom: 32 }}>
                    {isLoading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading your dashboard...</div>
                    ) : applications.length === 0 ? (
                        <div className="empty-state">
                            <FileText size={40} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                            <h3>No applications yet</h3>
                            <p>Go to the Tailor view to craft your first customized resume.</p>
                        </div>
                    ) : (
                        <div className="table-responsive" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)'}}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        <th style={{ padding: '16px 24px', fontWeight: 600 }}>Date</th>
                                        <th style={{ padding: '16px 24px', fontWeight: 600 }}>Job Details</th>
                                        <th style={{ padding: '16px 24px', fontWeight: 600 }}>Status</th>
                                        <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {applications.map(app => (
                                        <tr key={app.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '20px 24px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Calendar size={14} />
                                                    <span>{new Date(app.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '20px 24px' }}>
                                                <div style={{ fontWeight: 600, marginBottom: 4 }}>{app.role || 'Custom Role'}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                                                    <Briefcase size={12} /> {app.company || 'Target Company'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '20px 24px' }}>
                                                <span style={{ 
                                                    display: 'inline-flex', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                                                    backgroundColor: 'var(--success-bg)', color: 'var(--success)'
                                                }}>{app.status.replace('_', ' ')}</span>
                                            </td>
                                            <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                                    <button className="btn btn-sm btn-secondary" onClick={() => handleViewResume(app)} title="View Resume">
                                                        <Eye size={14} /> View
                                                    </button>
                                                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(app)} title="Edit Details">
                                                        <Edit size={14} /> Edit
                                                    </button>
                                                    <button className="btn btn-sm" onClick={() => handleDelete(app.id)} title="Delete Application" style={{ color: 'var(--error)', backgroundColor: 'var(--success-bg)' }}>
                                                        <Trash2 size={14} /> Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Application Editing Modal */}
            {editingApp && (
                <div className="modal-overlay no-print" onClick={() => setEditingApp(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, padding: 0 }}>
                        <div className="modal-header" style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)', margin: 0 }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Edit Application</h2>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 4 }}>Update tracking details</p>
                            </div>
                            <button className="modal-close" onClick={() => setEditingApp(null)} style={{ alignSelf: 'flex-start' }}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div style={{ padding: '28px' }}>
                            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="form-group">
                                    <label className="form-label">Company Name</label>
                                    <input 
                                        className="form-input" 
                                        value={editForm.company} 
                                        onChange={e => setEditForm({...editForm, company: e.target.value})} 
                                        required 
                                        placeholder="e.g. Acme Corp"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Job Role</label>
                                    <input 
                                        className="form-input" 
                                        value={editForm.role} 
                                        onChange={e => setEditForm({...editForm, role: e.target.value})} 
                                        required 
                                        placeholder="e.g. Frontend Engineer"
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 32 }}>
                                    <label className="form-label">Current Status</label>
                                    <select 
                                        className="form-input" 
                                        value={editForm.status} 
                                        onChange={e => setEditForm({...editForm, status: e.target.value})}
                                    >
                                        <option value="pending_review">Pending Review</option>
                                        <option value="approved">Approved</option>
                                        <option value="submitted">Submitted</option>
                                        <option value="failed">Failed</option>
                                        <option value="withdrawn">Withdrawn</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setEditingApp(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Resume Viewer Modal */}
            {viewingResume && (
                <div className="modal-overlay no-print" onClick={() => { setViewingResume(null); setViewingJob(null); }} style={{ padding: '32px', backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)' }}>
                    <div className="modal-content resume-viewer-modal" onClick={e => e.stopPropagation()} style={{ 
                        maxWidth: '1400px', 
                        width: '100%', 
                        height: '100%', 
                        margin: '0 auto', 
                        borderRadius: '16px', 
                        border: '1px solid var(--border)', 
                        boxShadow: '0 24px 48px rgba(0,0,0,0.5)', 
                        display: 'flex', 
                        flexDirection: 'column',
                        overflow: 'hidden',
                        backgroundColor: 'var(--bg-surface)'
                    }}>
                        <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18 }}>{viewingApp?.company}</h3>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{viewingApp?.role}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <button className="btn btn-primary" onClick={() => {
                                    const originalTitle = document.title;
                                    const originalPath = window.location.pathname;
                                    const candidateName = viewingResume?.personal_info?.name ? viewingResume.personal_info.name.replace(/\s+/g, '_') : 'Candidate';
                                    document.title = `${candidateName}_Resume`; 
                                    window.history.replaceState(null, '', '/');
                                    
                                    setTimeout(() => {
                                        window.print();
                                        document.title = originalTitle;
                                        window.history.replaceState(null, '', originalPath);
                                    }, 100);
                                }}>
                                    <Printer size={16} color="#1C1917" /> Download PDF
                                </button>
                                <button className="modal-close" onClick={() => { setViewingResume(null); setViewingJob(null); }}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* JD Sidebar */}
                            <div style={{ 
                                width: '380px', 
                                borderRight: '1px solid var(--border)', 
                                padding: 24, 
                                overflowY: 'auto',
                                backgroundColor: 'var(--bg-surface)' 
                            }}>
                                <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job Description</h4>
                                {viewingJob ? (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                        {viewingJob.failed ? (
                                            <span style={{ fontStyle: 'italic', color: 'var(--error)' }}>Failed to fetch job description.</span>
                                        ) : (
                                            viewingJob.job_description || <span style={{ fontStyle: 'italic' }}>No job description text recorded for this application.</span>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading description...</div>
                                )}
                            </div>
                            
                            {/* Resume Preview Pane */}
                            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', backgroundColor: 'var(--bg-page)', padding: '32px 0' }}>
                                <div style={{ 
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'flex-start',
                                    minHeight: '100%'
                                }}>
                                    <div style={{
                                        width: '816px',
                                        minHeight: '1056px',
                                        backgroundColor: '#fff',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                                        borderRadius: '4px',
                                        padding: 'var(--space-4)',
                                    }}>
                                        <ResumeTemplate data={viewingResume} ref={pdfRef} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print-only container */}
            {viewingResume && (
                <div className="print-only">
                    <ResumeTemplate data={viewingResume} />
                </div>
            )}

            <style jsx="true">{`
                .resume-viewer-modal {
                    padding: 0 !important;
                    background-color: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-card);
                    overflow: hidden;
                }
            `}</style>
        </>
    );
}
