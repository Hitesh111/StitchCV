import { useState, useEffect } from 'react';
import { Search, MapPin, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { NudgeBar, EmptyState } from '../components/Shared';

export default function Jobs({ addToast }) {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedJob, setSelectedJob] = useState(null);

    useEffect(() => { loadJobs(); }, [statusFilter]);

    async function loadJobs() {
        setLoading(true);
        try {
            const params = { limit: 100 };
            if (statusFilter !== 'all') params.status = statusFilter;
            if (search) params.search = search;
            const data = await api.getJobs(params);
            setJobs(data);
        } catch (err) {
            // Note: intentionally not showing red toasts on load
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }

    function handleSearch(e) {
        e.preventDefault();
        loadJobs();
    }

    const statusOptions = ['all', 'new', 'analyzed', 'matched', 'applied', 'skipped', 'rejected'];

    return (
        <div>
            <div className="page-header page-hero" style={{ marginBottom: 24 }}>
                <div className="page-kicker">Opportunity board</div>
                <h2 className="page-title">Jobs</h2>
                <p className="page-subtitle">Discovered opportunities from the web.</p>
            </div>

            {/* Filters */}
            <div className="actions-bar" style={{ marginBottom: 32 }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flex: 1, maxWidth: 300 }}>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search jobs by role or company..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary btn-icon-only">
                        <Search size={16} color="#1C1917" />
                    </button>
                </form>

                <div className="pill-group" style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
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

            {/* Jobs Content */}
            {loading ? (
                <div className="loading-state">
                    <div className="skeleton" style={{ width: '100%', height: 40, marginBottom: 1 }} />
                    <div className="skeleton" style={{ width: '100%', height: 60, marginBottom: 1 }} />
                    <div className="skeleton" style={{ width: '100%', height: 60, marginBottom: 1 }} />
                    <div className="skeleton" style={{ width: '100%', height: 60, marginBottom: 1 }} />
                </div>
            ) : jobs.length === 0 ? (
                <EmptyState 
                    icon={Search} 
                    title="No jobs found" 
                    subtitle="We couldn't find any jobs matching this criteria. Try clearing your filters or discovering new ones."
                    actionText="Discover New Jobs"
                    onAction={() => navigate('/discover')}
                />
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Role</th>
                                <th>Company</th>
                                <th>Location</th>
                                <th>Match</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Source</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map(job => (
                                <tr key={job.id} onClick={() => setSelectedJob(job)} style={{ cursor: 'pointer' }}>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{job.role}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{job.company}</td>
                                    <td>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                                            <MapPin size={12} /> {job.location || '—'}
                                        </span>
                                    </td>
                                    <td>
                                        {job.match_score != null ? (
                                            <span style={{ fontWeight: 600 }}>{Math.round(job.match_score * 100)}%</span>
                                        ) : <span style={{ color: 'var(--border)' }}>—</span>}
                                    </td>
                                    <td>
                                        <span className={`chip ${job.status === 'matched' ? 'chip-yellow' : 'chip-neutral'}`}>
                                            {job.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className="chip chip-neutral" style={{ padding: '2px 6px', fontSize: 10 }}>{job.source}</span>
                                    </td>
                                    <td>
                                        {job.apply_link && (
                                            <a
                                                href={job.apply_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <NudgeBar 
                text="Fetched everything interesting? Time to filter them into your pipeline."
                buttonText="Go to Dashboard"
                onClick={() => navigate('/')}
            />

            {/* Job Detail Modal */}
            {selectedJob && (
                <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{selectedJob.role}</h3>
                            <button className="btn btn-ghost btn-icon-only" style={{ border: 'none' }} onClick={() => setSelectedJob(null)}>✕</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div>
                                <span style={{ fontWeight: 600, fontSize: 15 }}>{selectedJob.company}</span>
                                {selectedJob.location && (
                                    <span style={{ color: 'var(--text-secondary)', marginLeft: 12, fontSize: 13 }}>
                                        <MapPin size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                        {selectedJob.location}
                                    </span>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span className={`chip ${selectedJob.status === 'matched' ? 'chip-yellow' : 'chip-neutral'}`}>
                                    {selectedJob.status.replace('_', ' ')}
                                </span>
                                {selectedJob.match_score != null && (
                                    <span className="chip chip-neutral">Match {Math.round(selectedJob.match_score * 100)}%</span>
                                )}
                                {selectedJob.seniority_level && (
                                    <span className="chip chip-neutral">{selectedJob.seniority_level}</span>
                                )}
                            </div>

                            {selectedJob.key_skills && selectedJob.key_skills.length > 0 && (
                                <div>
                                    <div className="label-caps" style={{ marginBottom: 6 }}>Skills</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {selectedJob.key_skills.map((s, i) => (
                                            <span key={i} className="chip chip-neutral">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedJob.job_description && (
                                <div>
                                    <div className="label-caps" style={{ marginBottom: 6 }}>Description</div>
                                    <div className="tips-block" style={{ padding: 16 }}>
                                        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                                            {selectedJob.job_description}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="nudge-bar" style={{ marginTop: 24, paddingTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--border)' }}>
                            <button className="btn btn-ghost" onClick={() => setSelectedJob(null)}>Close</button>
                            {selectedJob.apply_link && (
                                <a href={selectedJob.apply_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                                    <ExternalLink size={14} /> View Posting
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
