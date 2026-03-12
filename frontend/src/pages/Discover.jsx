import { useState } from 'react';
import { Search, MapPin, Loader2, Rocket } from 'lucide-react';
import api from '../services/api';

export default function Discover({ addToast }) {
    const [query, setQuery] = useState('');
    const [location, setLocation] = useState('');
    const [source, setSource] = useState('linkedin');
    const [maxJobs, setMaxJobs] = useState(20);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    async function handleDiscover(e) {
        e.preventDefault();
        if (!query.trim()) {
            addToast('Please enter a search query', 'error');
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const data = await api.discover({
                source,
                query: query.trim(),
                location: location.trim() || null,
                max_jobs: maxJobs,
            });
            setResult(data);
            addToast(data.message, 'success');
        } catch (err) {
            addToast('Discovery failed: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <div className="page-header">
                <h2>Discover Jobs</h2>
                <p>Search and discover new job listings from online sources</p>
            </div>

            <div className="card" style={{ maxWidth: 640, marginBottom: 32 }}>
                <form onSubmit={handleDiscover}>
                    <div className="form-group">
                        <label className="form-label">Job Title / Keywords</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Senior Software Engineer, React Developer..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Location</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. San Francisco, Remote..."
                                    value={location}
                                    onChange={e => setLocation(e.target.value)}
                                    disabled={loading}
                                    style={{ paddingLeft: 36 }}
                                />
                                <MapPin size={16} style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)'
                                }} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Source</label>
                            <select
                                className="form-select"
                                value={source}
                                onChange={e => setSource(e.target.value)}
                                disabled={loading}
                            >
                                <option value="linkedin">LinkedIn</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Max Results</label>
                        <input
                            type="number"
                            className="form-input"
                            min="1"
                            max="100"
                            value={maxJobs}
                            onChange={e => setMaxJobs(parseInt(e.target.value) || 20)}
                            disabled={loading}
                            style={{ width: 120 }}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || !query.trim()}
                        style={{ marginTop: 8 }}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={16} className="spin-icon" /> Discovering...
                            </>
                        ) : (
                            <>
                                <Rocket size={16} /> Start Discovery
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Result card */}
            {result && (
                <div className="card" style={{ maxWidth: 640 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--accent-success-glow)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Search size={24} style={{ color: 'var(--accent-success)' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 600 }}>{result.message}</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                Head over to the Jobs page to view and analyze them
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tips card */}
            <div className="card" style={{ maxWidth: 640, marginTop: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-accent)' }}>
                    💡 Discovery Tips
                </h3>
                <ul style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20 }}>
                    <li>Use specific job titles for better results</li>
                    <li>Add location to narrow down listings</li>
                    <li>After discovery, use <strong>Analyze</strong> from the Dashboard to score matches</li>
                    <li>LinkedIn requires you to be logged in via browser — the scraper will prompt you</li>
                </ul>
            </div>
        </div>
    );
}
