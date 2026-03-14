import { useState } from 'react';
import { Search, MapPin, Loader2, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { NudgeBar } from '../components/Shared';

export default function Discover({ addToast }) {
    const navigate = useNavigate();
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="page-header" style={{ width: '100%', maxWidth: 500, textAlign: 'center', marginBottom: 40 }}>
                <h2 className="page-title">Discover</h2>
                <p className="page-subtitle">Scrape new opportunities directly into your pipeline.</p>
            </div>

            <div className="card" style={{ width: '100%', maxWidth: 500, marginBottom: 32 }}>
                <form onSubmit={handleDiscover}>
                    
                    <div className="form-group" style={{ marginBottom: 24 }}>
                        <label className="form-label label-caps">Source</label>
                        <div className="pill-group" style={{ display: 'flex' }}>
                            <button
                                type="button"
                                className={`pill-tab ${source === 'linkedin' ? 'active-yellow' : ''}`}
                                onClick={() => setSource('linkedin')}
                                disabled={loading}
                                style={{ flex: 1 }}
                            >
                                LinkedIn
                            </button>
                            <button
                                type="button"
                                className={`pill-tab ${source === 'indeed' ? 'active-yellow' : ''}`}
                                onClick={() => {}}
                                disabled={true}
                                style={{ flex: 1, opacity: 0.5, cursor: 'not-allowed' }}
                                title="Coming soon"
                            >
                                Indeed
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label label-caps">Job Title / Keywords</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Senior Frontend Engineer..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-row" style={{ gap: 16 }}>
                        <div className="form-group" style={{ flex: 2 }}>
                            <label className="form-label label-caps">Location <span>(Optional)</span></label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Remote, NY..."
                                    value={location}
                                    onChange={e => setLocation(e.target.value)}
                                    disabled={loading}
                                    style={{ paddingLeft: 34 }}
                                />
                                <MapPin size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            </div>
                        </div>

                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label label-caps">Count</label>
                            <input
                                type="number"
                                className="form-input"
                                min="1"
                                max="100"
                                value={maxJobs}
                                onChange={e => setMaxJobs(parseInt(e.target.value) || 20)}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-full"
                        disabled={loading || !query.trim()}
                        style={{ marginTop: 8 }}
                    >
                        {loading ? (
                            <><Loader2 size={16} className="spin-icon" /> Scraping {source}...</>
                        ) : (
                            <><Rocket size={16} color="#1C1917" /> Start Discovery</>
                        )}
                    </button>
                </form>
            </div>

            {/* Result card */}
            {result && (
                <div className="card" style={{ width: '100%', maxWidth: 500, borderColor: 'var(--yellow)', backgroundColor: 'var(--yellow-muted)', marginBottom: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-btn)', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Search size={20} color="#1C1917" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{result.message}</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>View and score them in the Jobs list.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tips block */}
            <div className="tips-block" style={{ width: '100%', maxWidth: 500, marginBottom: 40 }}>
                <div className="tips-title">Discovery Tips</div>
                <div className="tip-item"><span className="arrow">→</span> Be specific with titles to improve AI matching accuracy.</div>
                <div className="tip-item"><span className="arrow">→</span> The scraper runs a real browser; it may ask you to log in to LinkedIn on the first run.</div>
                <div className="tip-item"><span className="arrow">→</span> Higher counts take longer. Start with 10-20.</div>
            </div>

            <div style={{ width: '100%' }}>
                <NudgeBar 
                    text="After discovery, review in Jobs"
                    buttonText="Go to Jobs"
                    onClick={() => navigate('/jobs')}
                />
            </div>
        </div>
    );
}
