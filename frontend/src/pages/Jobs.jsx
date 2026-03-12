import { useState, useEffect } from 'react';
import { Search, MapPin, ExternalLink, Filter } from 'lucide-react';
import api from '../services/api';

export default function Jobs({ addToast }) {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedJob, setSelectedJob] = useState(null);

    useEffect(() => {
        loadJobs();
    }, [statusFilter]);

    async function loadJobs() {
        setLoading(true);
        try {
            const params = { limit: 100 };
            if (statusFilter) params.status = statusFilter;
            if (search) params.search = search;
            const data = await api.getJobs(params);
            setJobs(data);
        } catch (err) {
            addToast('Failed to load jobs: ' + err.message, 'error');
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }

    function handleSearch(e) {
        e.preventDefault();
        loadJobs();
    }

    const statusOptions = ['', 'new', 'analyzed', 'matched', 'applied', 'skipped', 'rejected'];

    return (
        <div>
            <div className="page-header">
                <h2>Jobs</h2>
                <p>All discovered job listings</p>
            </div>

            {/* Filters */}
            <div className="actions-bar">
                <form onSubmit={handleSearch} className="search-input" style={{ display: 'flex', gap: 8 }}>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search jobs by role or company..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <button type="submit" className="btn btn-secondary btn-sm">
                        <Search size={16} />
                    </button>
                </form>

                <select
                    className="form-select"
                    style={{ width: 160 }}
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                >
                    <option value="">All Statuses</option>
                    {statusOptions.filter(Boolean).map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>
                    ))}
                </select>
            </div>

            {/* Jobs Table */}
            {loading ? (
                <div className="loading-container">
                    <div className="spinner" />
                    <p>Loading jobs...</p>
                </div>
            ) : jobs.length === 0 ? (
                <div className="empty-state">
                    <Search size={48} />
                    <h3>No jobs found</h3>
                    <p>Use the Discover page to find new job listings</p>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Role</th>
                                <th>Company</th>
                                <th>Location</th>
                                <th>Score</th>
                                <th>Status</th>
                                <th>Source</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map(job => (
                                <tr key={job.id} onClick={() => setSelectedJob(job)} style={{ cursor: 'pointer' }}>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{job.role}</td>
                                    <td>{job.company}</td>
                                    <td>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                                            <MapPin size={14} /> {job.location || '—'}
                                        </span>
                                    </td>
                                    <td>
                                        {job.match_score != null ? (
                                            <ScoreBar score={job.match_score} />
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`badge badge-${job.status}`}>
                                            {job.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{job.source}</td>
                                    <td>
                                        {job.apply_link && (
                                            <a
                                                href={job.apply_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                style={{ color: 'var(--text-accent)' }}
                                            >
                                                <ExternalLink size={16} />
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Job Detail Modal */}
            {selectedJob && (
                <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{selectedJob.role}</h3>
                            <button className="btn btn-icon btn-secondary" onClick={() => setSelectedJob(null)}>✕</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <span style={{ fontWeight: 600 }}>{selectedJob.company}</span>
                                {selectedJob.location && (
                                    <span style={{ color: 'var(--text-secondary)', marginLeft: 12 }}>
                                        <MapPin size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                        {selectedJob.location}
                                    </span>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <span className={`badge badge-${selectedJob.status}`}>
                                    {selectedJob.status.replace('_', ' ')}
                                </span>
                                {selectedJob.match_score != null && (
                                    <ScoreBar score={selectedJob.match_score} />
                                )}
                                {selectedJob.seniority_level && (
                                    <span className="badge badge-new">{selectedJob.seniority_level}</span>
                                )}
                            </div>

                            {selectedJob.key_skills && selectedJob.key_skills.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Skills</div>
                                    <div className="skill-tags">
                                        {selectedJob.key_skills.map((s, i) => (
                                            <span key={i} className="skill-tag">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedJob.job_description && (
                                <div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Description</div>
                                    <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                        {selectedJob.job_description}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="modal-actions">
                            {selectedJob.apply_link && (
                                <a href={selectedJob.apply_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                                    <ExternalLink size={14} /> Apply Externally
                                </a>
                            )}
                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedJob(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ScoreBar({ score }) {
    const pct = Math.round(score * 100);
    const level = pct >= 70 ? 'high' : pct >= 40 ? 'medium' : 'low';
    return (
        <div className="score-bar">
            <div className="score-track">
                <div className={`score-fill ${level}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="score-value" style={{ color: `var(--accent-${level === 'high' ? 'success' : level === 'medium' ? 'warning' : 'danger'})` }}>
                {pct}%
            </span>
        </div>
    );
}
