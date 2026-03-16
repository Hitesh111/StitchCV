import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, Check, Settings, X, Trash2 } from 'lucide-react';
import ResumeTemplate from '../components/ResumeTemplate';

const STORAGE_KEY = 'hireflow_tailor_v1';

function loadFromStorage() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch { return null; }
}

export default function Tailor({ addToast }) {
    const saved = loadFromStorage();

    // Master Resume State
    const [resumeInputMode, setResumeInputMode] = useState(saved?.resumeInputMode || 'file');
    const [resumeFile, setResumeFile] = useState(null);
    const [resumeText, setResumeText] = useState(saved?.resumeText || '');
    
    // Job Description State
    const [jdInputMode, setJdInputMode] = useState(saved?.jdInputMode || 'text');
    const [jdFile, setJdFile] = useState(null);
    const [jdText, setJdText] = useState(saved?.jdText || '');
    const [jdUrl, setJdUrl] = useState(saved?.jdUrl || '');
    const [fetchedJd, setFetchedJd] = useState(saved?.fetchedJd || '');

    const [isLoading, setIsLoading] = useState(false);
    const [tailoredResume, setTailoredResume] = useState(saved?.tailoredResume || null);
    const [logs, setLogs] = useState(saved?.logs || []);
    const [showThinking, setShowThinking] = useState(true);
    const [inputScores, setInputScores] = useState(saved?.inputScores || null);
    const [outputScores, setOutputScores] = useState(saved?.outputScores || null);
    const [hasChangedInputs, setHasChangedInputs] = useState(false);
    const pdfRef = useRef(null);

    // Mark inputs as changed if user edits anything after a result exists
    const markChanged = () => { if (tailoredResume) setHasChangedInputs(true); };

    // Persist result state to localStorage whenever it changes
    useEffect(() => {
        const snapshot = { resumeInputMode, resumeText, jdInputMode, jdText, jdUrl, fetchedJd, tailoredResume, logs, inputScores, outputScores };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }, [resumeInputMode, resumeText, jdInputMode, jdText, jdUrl, fetchedJd, tailoredResume, logs, inputScores, outputScores]);

    const handleClear = () => {
        setTailoredResume(null);
        setInputScores(null);
        setOutputScores(null);
        setLogs([]);
        setResumeText('');
        setJdText('');
        setJdUrl('');
        setFetchedJd('');
        setResumeFile(null);
        setJdFile(null);
        localStorage.removeItem(STORAGE_KEY);
        addToast('Cleared — start fresh!', 'success');
    };

    const handleGenerate = async () => {
        if (resumeInputMode === 'file' && !resumeFile) return addToast('Please upload a master resume file', 'error');
        if (resumeInputMode === 'text' && !resumeText.trim()) return addToast('Please paste your master resume text', 'error');
        if (jdInputMode === 'file' && !jdFile) return addToast('Please upload a job description file', 'error');
        if (jdInputMode === 'text' && !jdText.trim()) return addToast('Please paste a job description', 'error');
        if (jdInputMode === 'url' && !jdUrl.trim()) return addToast('Please paste a job posting URL', 'error');

        setIsLoading(true);
        setHasChangedInputs(false);
        setTailoredResume(null);
        setInputScores(null);
        setOutputScores(null);
        setLogs([]);
        setFetchedJd('');

        try {
            const formData = new FormData();
            if (resumeInputMode === 'file') formData.append('master_resume_file', resumeFile);
            else formData.append('master_resume_text', resumeText);

            if (jdInputMode === 'file') formData.append('job_description_file', jdFile);
            else if (jdInputMode === 'url') formData.append('job_description_url', jdUrl.trim());
            else formData.append('job_description_text', jdText);

            const response = await fetch('/api/tailor_resume', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Failed to tailor resume');

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || "";

                for (const chunk of lines) {
                    if (!chunk.trim()) continue;
                    const eventMatch = chunk.match(/^event:\s*(.*?)$/m);
                    const dataMatch = chunk.match(/^data:\s*(.*?)$/m);
                    
                    if (eventMatch && dataMatch) {
                        const event = eventMatch[1].trim();
                        let dataStr = dataMatch[1].trim();
                        if (event === "log") {
                            setLogs(prev => [...prev, dataStr.replace(/\\n/g, '\n')]);
                        } else if (event === "jd_preview") {
                            try {
                                const parsed = JSON.parse(atob(dataStr));
                                if (parsed.job_description) setFetchedJd(parsed.job_description);
                            } catch (e) { console.error("JD preview parse fail", e); }
                        } else if (event === "result") {
                            try {
                                const parsed = JSON.parse(atob(dataStr));
                                setTailoredResume(JSON.parse(parsed.formatted_resume));
                                if (parsed.input_scores) setInputScores(parsed.input_scores);
                                if (parsed.output_scores) setOutputScores(parsed.output_scores);
                                addToast('Resume generated successfully!', 'success');
                            } catch (e) { console.error("Parse fail", e); }
                        }
                    }
                }
            }
        } catch (error) {
            addToast(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = () => {
        if (!tailoredResume) return;
        addToast('Generating PDF...');
        fetch('/api/export_resume_pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resume: tailoredResume, filename: 'tailored_resume.pdf' }),
        })
            .then(async (response) => {
                if (!response.ok) {
                    const error = await response.json().catch(() => ({ detail: 'PDF export failed' }));
                    throw new Error(error.detail || 'PDF export failed');
                }
                return response.blob();
            })
            .then((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'tailored_resume.pdf';
                a.click();
                URL.revokeObjectURL(url);
                addToast('Downloaded successfully!', 'success');
            })
            .catch((error) => {
                addToast(error.message, 'error');
            });
    };

    const handleDownloadJson = () => {
        if (!tailoredResume) return;
        const blob = new Blob([JSON.stringify(tailoredResume, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tailored_resume.json';
        a.click();
        URL.revokeObjectURL(url);
        addToast('JSON downloaded successfully!', 'success');
    };

    const isReady = (resumeInputMode === 'file' ? !!resumeFile : !!resumeText.trim()) &&
                    (jdInputMode === 'file' ? !!jdFile : jdInputMode === 'url' ? !!jdUrl.trim() : !!jdText.trim());

    // Allow re-generate any time a result exists and user has changed inputs
    const canGenerate = isReady || (!!tailoredResume && hasChangedInputs);
    const generateBtnLabel = isLoading ? 'Crafting tailored resume...' : tailoredResume ? 'Generate Again' : 'Generate New Resume';

    // Tracking UI State
    const status = tailoredResume ? 'done' : isLoading ? 'current' : 'pending';

    return (
        <div style={{ paddingBottom: 64 }}>
            <div className="hero-split app-hero tailor-hero" style={{ marginBottom: 24 }}>
                <div className="hero-split-copy">
                    <div className="page-kicker">Resume studio</div>
                    <h2 className="page-title hero-title">Tailor resume</h2>
                    <p className="page-subtitle hero-subtitle">Feed a master resume and job description into the tailoring workflow.</p>
                </div>
                <div className="hero-process-panel app-summary-grid">
                    <div className="hero-process-card">
                        <span className="label-caps">Input</span>
                        <strong>Resume + JD</strong>
                        <p>Upload files, paste text, or fetch the JD from a link.</p>
                    </div>
                    <div className="hero-process-card">
                        <span className="label-caps">Output</span>
                        <strong>Preview + PDF + JSON</strong>
                        <p>Review the tailored result before exporting.</p>
                    </div>
                </div>
            </div>

            <div className="showcase-panel app-panel" style={{ marginBottom: 32 }}>
                <div className="showcase-panel-header">
                    <div>
                        <div className="label-caps">Studio workflow</div>
                        <h3 className="showcase-panel-title">Inputs</h3>
                    </div>
                </div>
                <div className="input-grid">
                
                <div className="card feature-card-dark" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div className="label-caps">1. Master Resume</div>
                        <div className="pill-group">
                            <button className={`pill-tab ${resumeInputMode === 'file' ? 'active' : ''}`} onClick={() => { setResumeInputMode('file'); markChanged(); }}>File</button>
                            <button className={`pill-tab ${resumeInputMode === 'text' ? 'active' : ''}`} onClick={() => { setResumeInputMode('text'); markChanged(); }}>Text</button>
                        </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {resumeInputMode === 'file' ? (
                            <label className={`upload-zone ${resumeFile ? 'loaded' : ''}`} style={{ flex: 1 }}>
                                <input type="file" accept=".pdf,.json,.docx" style={{ display: 'none' }} onChange={e => { setResumeFile(e.target.files[0]); markChanged(); }} />
                                {resumeFile ? (
                                    <>
                                        <Check size={24} style={{ color: 'var(--success)', marginBottom: 12 }} />
                                        <div style={{ fontWeight: 600, color: 'var(--success)' }}>{resumeFile.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--success)', textDecoration: 'underline', marginTop: 4 }}>change file</div>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={24} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                                        <div style={{ fontWeight: 600 }}>Upload Resume (.pdf, .json)</div>
                                    </>
                                )}
                            </label>
                        ) : (
                            <textarea className="form-textarea" style={{ flex: 1, minHeight: 200 }} placeholder="Paste Master Resume text..." value={resumeText} onChange={e => { setResumeText(e.target.value); markChanged(); }} />
                        )}
                    </div>
                </div>

                {/* Right: Job Description */}
                <div className="card feature-card-dark" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div className="label-caps">2. Job Description</div>
                        <div className="pill-group">
                            <button className={`pill-tab ${jdInputMode === 'text' ? 'active' : ''}`} onClick={() => { setJdInputMode('text'); markChanged(); }}>Text</button>
                            <button className={`pill-tab ${jdInputMode === 'url' ? 'active' : ''}`} onClick={() => { setJdInputMode('url'); markChanged(); }}>Link</button>
                            <button className={`pill-tab ${jdInputMode === 'file' ? 'active' : ''}`} onClick={() => { setJdInputMode('file'); markChanged(); }}>File</button>
                        </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {jdInputMode === 'text' ? (
                            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <textarea className="form-textarea jd-textarea" style={{ flex: 1, minHeight: 200 }} placeholder="Paste the Job Description..." value={jdText} onChange={e => { setJdText(e.target.value); markChanged(); }} />
                                <div style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 10, color: 'var(--text-muted)' }}>{jdText.length} chars</div>
                            </div>
                        ) : jdInputMode === 'url' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                                <input
                                    type="url"
                                    className="form-input"
                                    placeholder="Paste a job posting URL..."
                                    value={jdUrl}
                                    onChange={e => { setJdUrl(e.target.value); markChanged(); }}
                                />
                                <div className="tips-block" style={{ padding: 14 }}>
                                    <div className="tips-title" style={{ marginBottom: 8 }}>How it works</div>
                                    <div className="tip-item"><span className="arrow">→</span> HireFlow fetches the page and extracts the JD automatically.</div>
                                    <div className="tip-item"><span className="arrow">→</span> If the site is heavily rendered, it falls back to the browser session.</div>
                                    <div className="tip-item"><span className="arrow">→</span> LinkedIn links work if a specific job is already selected on the page.</div>
                                    <div className="tip-item"><span className="arrow">→</span> Logged-in pages like LinkedIn work best if your session is already active.</div>
                                </div>
                                {fetchedJd && (
                                    <div className="tips-block" style={{ padding: 14 }}>
                                        <div className="tips-title" style={{ marginBottom: 8 }}>Fetched JD Preview</div>
                                        <div style={{
                                            fontSize: 12.5,
                                            lineHeight: 1.65,
                                            color: 'var(--text-secondary)',
                                            whiteSpace: 'pre-wrap',
                                            maxHeight: 220,
                                            overflowY: 'auto'
                                        }}>
                                            {fetchedJd}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <label className={`upload-zone ${jdFile ? 'loaded' : ''}`} style={{ flex: 1 }}>
                                <input type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }} onChange={e => { setJdFile(e.target.files[0]); markChanged(); }} />
                                {jdFile ? (
                                    <>
                                        <Check size={24} style={{ color: 'var(--success)', marginBottom: 12 }} />
                                        <div style={{ fontWeight: 600, color: 'var(--success)' }}>{jdFile.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--success)', textDecoration: 'underline', marginTop: 4 }}>change file</div>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={24} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                                        <div style={{ fontWeight: 600 }}>Upload JD (.txt, .pdf)</div>
                                    </>
                                )}
                            </label>
                        )}
                    </div>
                </div>
                </div>
            </div>

            {/* Workflow Step Dots & Generate */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
                <div className="step-dot-row" style={{ marginBottom: 32 }}>
                    <div className="step-item done">
                        <div className="step-dot"><Check size={14} /></div>
                        <div className="step-line" />
                        <div className="step-label">INPUTS</div>
                    </div>
                    <div className={`step-item ${status === 'current' ? 'current' : status === 'done' ? 'done' : 'pending'}`}>
                        <div className="step-dot">{status === 'done' ? <Check size={14} /> : status === 'current' ? <Settings size={14} className="spin-icon" style={{color: '#1C1917'}}/> : <span style={{width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--border)'}}/>}</div>
                        <div className="step-line" />
                        <div className="step-label">PROCESSING</div>
                    </div>
                    <div className={`step-item ${status === 'done' ? 'current' : 'pending'}`} style={{ width: 40 }}>
                        <div className="step-dot">{status === 'done' ? <FileText size={14} style={{color: '#1C1917'}}/> : <span style={{width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--border)'}}/>}</div>
                        <div className="step-label">RESULT</div>
                    </div>
                </div>

                <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', maxWidth: 400, padding: '16px 24px', fontSize: 16 }} 
                    onClick={handleGenerate} 
                    disabled={!canGenerate || isLoading}
                >
                    {generateBtnLabel}
                </button>
            </div>

            {/* Full Width Output Section */}
            {(isLoading || tailoredResume) && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: 24, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="label-caps">3. Tailored Result</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {tailoredResume && (
                                <button className="btn btn-ghost btn-sm" onClick={handleClear} title="Clear and start fresh">
                                    <Trash2 size={14} /> Clear
                                </button>
                            )}
                            {tailoredResume && (
                                <button className="btn btn-outline btn-sm" onClick={handleDownloadJson}>
                                    <FileText size={14} />
                                    Download JSON
                                </button>
                            )}
                            {tailoredResume && (
                                <button className="btn btn-primary btn-sm" onClick={handleDownload}>
                                    <Download size={14} color="#1C1917"/> Download PDF
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Agent Logs (Toggleable) */}
                    {logs.length > 0 && (
                        <div style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                            <div 
                                style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                                onClick={() => setShowThinking(!showThinking)}
                            >
                                <span>Agent Execution Logs</span>
                                <span>{showThinking ? 'Hide' : 'Show'}</span>
                            </div>
                            {showThinking && (
                                <div style={{ padding: '0 24px 24px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {logs.map((L, i) => <div key={i} style={{ marginBottom: 4 }}>• {L}</div>)}
                                    {isLoading && <div style={{ color: 'var(--yellow-dark)' }}>• Working...</div>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Content */}
                    <div style={{ padding: 32 }}>
                        {isLoading && !tailoredResume ? (
                            <div className="empty-state">
                                <Settings size={40} className="spin-icon" style={{ color: 'var(--yellow)' }} />
                                <h3>Processing application data</h3>
                                <p>This takes 20-40 seconds. We're matching your history against the JD constraints.</p>
                            </div>
                        ) : tailoredResume && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                
                                {/* Top Row: Score Cards side-by-side */}
                                {(inputScores || outputScores) && (
                                    <div className="score-grid">
                                        {/* Original ATS Card */}
                                        {inputScores && (
                                            <div className="ats-card original">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                                    <div className="label-caps">Original Resume</div>
                                                    <div style={{ fontSize: 18, fontWeight: 800 }}>{Math.round(Object.values(inputScores).reduce((a,b)=>a+b,0)/4)}%</div>
                                                </div>
                                                {Object.entries(inputScores).map(([k, v]) => (
                                                    <div key={k} style={{ marginBottom: 12 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: 'var(--text-secondary)' }}>
                                                            <span style={{textTransform:'capitalize'}}>{k.replace('_', ' ')}</span>
                                                            <span>{v}%</span>
                                                        </div>
                                                        <div className="score-track"><div className="score-fill neutral" style={{ width: `${v}%` }}/></div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Tailored ATS Card */}
                                        {outputScores && (
                                            <div className="ats-card tailored">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                                    <div className="label-caps" style={{ color: 'var(--yellow-dark)' }}>Tailored Match</div>
                                                    <div style={{ fontSize: 18, fontWeight: 800 }}>{Math.round(Object.values(outputScores).reduce((a,b)=>a+b,0)/4)}%</div>
                                                </div>
                                                {Object.entries(outputScores).map(([k, v]) => {
                                                    const origV = inputScores ? inputScores[k] : 0;
                                                    const diff = v - origV;
                                                    return (
                                                    <div key={k} style={{ marginBottom: 12 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                                            <span style={{textTransform:'capitalize', fontWeight: 600}}>{k.replace('_', ' ')}</span>
                                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                                {diff > 0 && <span style={{ color: 'var(--success)' }}>+{diff}</span>}
                                                                <span style={{ fontWeight: 600 }}>{v}%</span>
                                                            </div>
                                                        </div>
                                                        <div className="score-track"><div className="score-fill yellow" style={{ width: `${v}%` }}/></div>
                                                    </div>
                                                )})}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Full-width Resume Preview */}
                                <div style={{ 
                                    backgroundColor: 'var(--bg-card)', 
                                    borderRadius: 'var(--radius-card)', 
                                    border: '1px solid var(--border)', 
                                    width: '100%',
                                    overflowX: 'auto',
                                    padding: 'var(--space-4)'
                                }}>
                                    <div style={{
                                        minWidth: '816px',
                                        maxWidth: '816px',
                                        margin: '0 auto',
                                        backgroundColor: '#fff',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                        borderRadius: '4px'
                                    }}>
                                        <ResumeTemplate data={tailoredResume} ref={pdfRef} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx="true">{`
                .upload-zone {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border: 1px dashed var(--border);
                    border-radius: var(--radius-input);
                    background-color: var(--bg-surface);
                    cursor: pointer;
                    transition: all 150ms ease;
                }
                .upload-zone:hover {
                    border-color: var(--yellow);
                    background-color: var(--yellow-muted);
                }
                .upload-zone.loaded {
                    border-style: solid;
                    border-color: var(--success);
                    background-color: var(--success-bg);
                }
                .upload-zone.loaded:hover { border-color: var(--success); background-color: var(--success-bg); }

                .spin-icon { animation: spin 1.2s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes pulse-btn {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(253, 224, 71, 0.5); }
                    50% { box-shadow: 0 0 0 8px rgba(253, 224, 71, 0); }
                }

                .ats-card {
                    padding: 20px;
                    border-radius: var(--radius-card);
                }
                .ats-card.original {
                    background-color: var(--bg-surface);
                    border: 1px solid var(--border);
                }
                .ats-card.tailored {
                    background-color: var(--yellow-muted);
                    border: 1px solid var(--yellow-border);
                }

                .score-track {
                    height: 4px;
                    background-color: var(--border);
                    border-radius: 2px;
                    overflow: hidden;
                }
                .dark .ats-card.tailored .score-track { background-color: rgba(255,255,255,0.05); }

                .score-fill { height: 100%; transition: width 1s ease; }
                .score-fill.neutral { background-color: var(--text-muted); }
                .score-fill.yellow { background-color: var(--yellow); }
            `}</style>
        </div>
    );
}
