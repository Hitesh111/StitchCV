import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, Check, Settings, X, Trash2, MoreHorizontal } from 'lucide-react';
import ResumeTemplate from '../components/ResumeTemplate';

const STORAGE_KEY = 'stitchcv_tailor_v1';

function loadFromStorage() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch { return null; }
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateKeywords(text) {
    if (!text || text.trim().length < 10) return 0;
    const words = text.trim().split(/\s+/).filter(w => w.length > 3 && /^[a-zA-Z]/.test(w));
    // Rough dedup
    return new Set(words.map(w => w.toLowerCase())).size;
}

export default function Tailor({ addToast }) {
    const saved = loadFromStorage();

    const [resumeInputMode, setResumeInputMode] = useState(saved?.resumeInputMode || 'file');
    const [resumeFile, setResumeFile] = useState(null);
    const [resumeText, setResumeText] = useState(saved?.resumeText || '');

    const [jdInputMode, setJdInputMode] = useState(saved?.jdInputMode || 'text');
    const [jdFile, setJdFile] = useState(null);
    const [jdText, setJdText] = useState(saved?.jdText || '');
    const [jdUrl, setJdUrl] = useState(saved?.jdUrl || '');
    const [fetchedJd, setFetchedJd] = useState(saved?.fetchedJd || '');

    const [isLoading, setIsLoading] = useState(false);
    const [tailoredResume, setTailoredResume] = useState(saved?.tailoredResume || null);
    const [logs, setLogs] = useState(saved?.logs || []);
    const [showLogs, setShowLogs] = useState(false);
    const [inputScores, setInputScores] = useState(saved?.inputScores || null);
    const [outputScores, setOutputScores] = useState(saved?.outputScores || null);
    const [hasChangedInputs, setHasChangedInputs] = useState(false);
    const pdfRef = useRef(null);
    const resumeFileInputRef = useRef(null);
    const jdFileInputRef = useRef(null);

    const markChanged = () => { if (tailoredResume) setHasChangedInputs(true); };

    useEffect(() => {
        const snapshot = { resumeInputMode, resumeText, jdInputMode, jdText, jdUrl, fetchedJd, tailoredResume, logs, inputScores, outputScores };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }, [resumeInputMode, resumeText, jdInputMode, jdText, jdUrl, fetchedJd, tailoredResume, logs, inputScores, outputScores]);

    const handleClear = () => {
        setTailoredResume(null); setInputScores(null); setOutputScores(null);
        setLogs([]); setResumeText(''); setJdText(''); setJdUrl('');
        setFetchedJd(''); setResumeFile(null); setJdFile(null);
        localStorage.removeItem(STORAGE_KEY);
        addToast('Cleared', 'success');
    };

    const handleGenerate = async () => {
        if (resumeInputMode === 'file' && !resumeFile) return addToast('Upload a master resume file', 'error');
        if (resumeInputMode === 'text' && !resumeText.trim()) return addToast('Paste your master resume text', 'error');
        if (jdInputMode === 'file' && !jdFile) return addToast('Upload a job description file', 'error');
        if (jdInputMode === 'text' && !jdText.trim()) return addToast('Paste a job description', 'error');
        if (jdInputMode === 'url' && !jdUrl.trim()) return addToast('Paste a job posting URL', 'error');

        setIsLoading(true); setHasChangedInputs(false);
        setTailoredResume(null); setInputScores(null); setOutputScores(null);
        setLogs([]); setFetchedJd(''); setShowLogs(true);

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
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const chunk of lines) {
                    if (!chunk.trim()) continue;
                    const eventMatch = chunk.match(/^event:\s*(.*?)$/m);
                    const dataMatch = chunk.match(/^data:\s*(.*?)$/m);
                    if (eventMatch && dataMatch) {
                        const event = eventMatch[1].trim();
                        const dataStr = dataMatch[1].trim();
                        if (event === 'log') {
                            setLogs(prev => [...prev, dataStr.replace(/\\n/g, '\n')]);
                        } else if (event === 'jd_preview') {
                            try {
                                const parsed = JSON.parse(atob(dataStr));
                                if (parsed.job_description) setFetchedJd(parsed.job_description);
                            } catch (e) { console.error('JD preview parse fail', e); }
                        } else if (event === 'result') {
                            try {
                                const parsed = JSON.parse(atob(dataStr));
                                setTailoredResume(JSON.parse(parsed.formatted_resume));
                                if (parsed.input_scores) setInputScores(parsed.input_scores);
                                if (parsed.output_scores) setOutputScores(parsed.output_scores);
                                addToast('Resume ready', 'success');
                            } catch (e) { console.error('Parse fail', e); }
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

    const handleDownloadPdf = async () => {
        if (!tailoredResume || !pdfRef.current) return;
        const html2pdf = (await import('html2pdf.js')).default;
        const candidateName = tailoredResume?.personal_info?.name
            ? tailoredResume.personal_info.name.replace(/\s+/g, '_')
            : 'Tailored_Resume';
        html2pdf().set({
            margin: 0, filename: `${candidateName}_Resume.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        }).from(pdfRef.current).save();
    };

    const hasResume = resumeInputMode === 'file' ? !!resumeFile : !!resumeText.trim();
    const hasJd = jdInputMode === 'file' ? !!jdFile : jdInputMode === 'url' ? !!jdUrl.trim() : !!jdText.trim();
    const canGenerate = (hasResume && hasJd) || (!!tailoredResume && hasChangedInputs);
    const generateBtnLabel = isLoading ? 'Generating...' : tailoredResume ? 'Regenerate' : 'Generate';
    const keywordCount = jdInputMode === 'text' ? estimateKeywords(jdText) : 0;

    // Step status
    const stepResume = hasResume ? 'done' : 'pending';
    const stepJd = hasJd ? 'done' : 'pending';
    const stepResult = tailoredResume ? 'done' : isLoading ? 'active' : 'pending';

    // Score derived values
    const origTotal = inputScores ? Math.round(Object.values(inputScores).reduce((a, b) => a + b, 0) / 4) : null;
    const newTotal = outputScores ? Math.round(Object.values(outputScores).reduce((a, b) => a + b, 0) / 4) : null;
    const totalDelta = origTotal !== null && newTotal !== null ? newTotal - origTotal : null;
    const scoreMetrics = outputScores ? Object.entries(outputScores) : [];

    return (
        <div style={{ paddingBottom: 80 }}>
            {/* Compact workspace header */}
            <div className="ws-page-header">
                <span className="ws-page-title">Tailor resume</span>
                <div className="ws-step-pills">
                    <span className={`ws-step-pill ${stepResume}`}>
                        {stepResume === 'done' && <Check size={9} />} Resume
                    </span>
                    <span style={{ color: 'var(--border)', fontSize: 10 }}>·</span>
                    <span className={`ws-step-pill ${stepJd}`}>
                        {stepJd === 'done' && <Check size={9} />} JD
                    </span>
                    <span style={{ color: 'var(--border)', fontSize: 10 }}>·</span>
                    <span className={`ws-step-pill ${stepResult}`}>
                        {stepResult === 'done' ? <><Check size={9} /> Result ready</> :
                         stepResult === 'active' ? <><Settings size={9} className="spin-icon" /> Processing</> :
                         'Result'}
                    </span>
                </div>
            </div>

            {/* Input panels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {/* Master Resume */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 10,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Master resume</span>
                        <div className="pill-group">
                            <button className={`pill-tab ${resumeInputMode === 'file' ? 'active' : ''}`}
                                onClick={() => { setResumeInputMode('file'); markChanged(); }}>File</button>
                            <button className={`pill-tab ${resumeInputMode === 'text' ? 'active' : ''}`}
                                onClick={() => { setResumeInputMode('text'); markChanged(); }}>Text</button>
                        </div>
                    </div>

                    {resumeInputMode === 'file' ? (
                        resumeFile ? (
                            <div className="upload-row">
                                <div className="upload-row-icon"><FileText size={14} /></div>
                                <div className="upload-row-meta">
                                    <div className="upload-row-name">{resumeFile.name}</div>
                                    <div className="upload-row-size">{formatFileSize(resumeFile.size)}</div>
                                </div>
                                <label className="upload-row-change">
                                    <input type="file" accept=".pdf,.json,.docx" style={{ display: 'none' }}
                                        onChange={e => { setResumeFile(e.target.files[0]); markChanged(); }} />
                                    Change
                                </label>
                            </div>
                        ) : (
                            <label style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                border: '0.5px dashed var(--border)', borderRadius: 7, background: 'var(--bg-input, var(--bg-surface))',
                                minHeight: 120, cursor: 'pointer', transition: 'border-color 120ms ease', gap: 8
                            }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = '#D4A017'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = ''}>
                                <input type="file" accept=".pdf,.json,.docx" style={{ display: 'none' }}
                                    onChange={e => { setResumeFile(e.target.files[0]); markChanged(); }} />
                                <Upload size={18} style={{ color: 'var(--text-muted)' }} />
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>Upload resume (.pdf, .json)</span>
                            </label>
                        )
                    ) : (
                        <textarea className="form-textarea" style={{ minHeight: 120, resize: 'vertical' }}
                            placeholder="Paste resume text..."
                            value={resumeText}
                            onChange={e => { setResumeText(e.target.value); markChanged(); }} />
                    )}
                </div>

                {/* Job Description */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 10,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Job description</span>
                        <div className="pill-group">
                            <button className={`pill-tab ${jdInputMode === 'text' ? 'active' : ''}`}
                                onClick={() => { setJdInputMode('text'); markChanged(); }}>Text</button>
                            <button className={`pill-tab ${jdInputMode === 'url' ? 'active' : ''}`}
                                onClick={() => { setJdInputMode('url'); markChanged(); }}>Link</button>
                            <button className={`pill-tab ${jdInputMode === 'file' ? 'active' : ''}`}
                                onClick={() => { setJdInputMode('file'); markChanged(); }}>File</button>
                        </div>
                    </div>

                    {jdInputMode === 'text' ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <textarea className="form-textarea" style={{ minHeight: 120, resize: 'vertical' }}
                                placeholder="Paste the job description..."
                                value={jdText}
                                onChange={e => { setJdText(e.target.value); markChanged(); }} />
                            {keywordCount > 5 && (
                                <span className="keyword-hint">{keywordCount} unique keywords detected</span>
                            )}
                        </div>
                    ) : jdInputMode === 'url' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <input type="url" className="form-input"
                                placeholder="Paste job posting URL..."
                                value={jdUrl}
                                onChange={e => { setJdUrl(e.target.value); markChanged(); }} />
                            <div style={{
                                padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: 7,
                                background: 'var(--bg-input, var(--bg-surface))', fontSize: 12, color: 'var(--text-muted)',
                                lineHeight: 1.6
                            }}>
                                StitchCV fetches and extracts the JD automatically. LinkedIn links work if you're logged in.
                            </div>
                            {fetchedJd && (
                                <div style={{
                                    padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: 7,
                                    background: 'var(--bg-input, var(--bg-surface))', fontSize: 12,
                                    color: 'var(--text-secondary)', whiteSpace: 'pre-wrap',
                                    maxHeight: 180, overflowY: 'auto', lineHeight: 1.6
                                }}>
                                    {fetchedJd}
                                </div>
                            )}
                        </div>
                    ) : (
                        jdFile ? (
                            <div className="upload-row">
                                <div className="upload-row-icon"><FileText size={14} /></div>
                                <div className="upload-row-meta">
                                    <div className="upload-row-name">{jdFile.name}</div>
                                    <div className="upload-row-size">{formatFileSize(jdFile.size)}</div>
                                </div>
                                <label className="upload-row-change">
                                    <input type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }}
                                        onChange={e => { setJdFile(e.target.files[0]); markChanged(); }} />
                                    Change
                                </label>
                            </div>
                        ) : (
                            <label style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                border: '0.5px dashed var(--border)', borderRadius: 7, background: 'var(--bg-input, var(--bg-surface))',
                                minHeight: 120, cursor: 'pointer', transition: 'border-color 120ms ease', gap: 8
                            }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = '#D4A017'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = ''}>
                                <input type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }}
                                    onChange={e => { setJdFile(e.target.files[0]); markChanged(); }} />
                                <Upload size={18} style={{ color: 'var(--text-muted)' }} />
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>Upload JD (.txt, .pdf)</span>
                            </label>
                        )
                    )}
                </div>
            </div>

            {/* Generate row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
                <button
                    className="btn btn-primary"
                    style={{ padding: '9px 18px', fontSize: 13, fontWeight: 500 }}
                    onClick={handleGenerate}
                    disabled={!canGenerate || isLoading}
                >
                    {generateBtnLabel}
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>Uses 5 credits</span>
                {tailoredResume && (
                    <button className="btn btn-ghost btn-sm" onClick={handleClear}
                        style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                        <Trash2 size={12} /> Clear
                    </button>
                )}
            </div>

            {/* Output section */}
            {(isLoading || tailoredResume) && (
                <div style={{
                    background: 'var(--bg-card)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 10,
                    overflow: 'hidden'
                }}>
                    {/* Output header */}
                    <div style={{
                        padding: '12px 20px',
                        borderBottom: '0.5px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--bg-surface)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Result</span>
                            {logs.length > 0 && (
                                <button
                                    style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                                    onClick={() => setShowLogs(v => !v)}
                                >
                                    {showLogs ? 'Hide log' : 'Show log'}
                                </button>
                            )}
                        </div>
                        {tailoredResume && (
                            <button className="btn btn-primary btn-sm" onClick={handleDownloadPdf}
                                style={{ fontSize: 11, padding: '6px 12px' }}>
                                <Download size={12} /> Download PDF
                            </button>
                        )}
                    </div>

                    {/* Agent log — timeline */}
                    {showLogs && logs.length > 0 && (
                        <div style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--bg-surface)' }}>
                            <div className="agent-timeline">
                                {logs.map((log, i) => (
                                    <div key={i} className={`agent-timeline-item ${i === logs.length - 1 && isLoading ? 'active' : 'done'}`}>
                                        {log}
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="agent-timeline-item active">Working...</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Loading state */}
                    {isLoading && !tailoredResume && (
                        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                            <Settings size={28} className="spin-icon" style={{ color: '#D4A017', marginBottom: 12 }} />
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400 }}>
                                Tailoring your resume — 20–40 seconds
                            </div>
                        </div>
                    )}

                    {/* Score hero + resume preview */}
                    {tailoredResume && (
                        <>
                            {/* Scores */}
                            {(inputScores || outputScores) && (
                                <div className="score-hero">
                                    <div>
                                        <div className="score-hero-number">{newTotal ?? origTotal}%</div>
                                        {totalDelta !== null && totalDelta > 0 && (
                                            <div className="score-hero-delta">+{totalDelta} pts from original ({origTotal}%)</div>
                                        )}
                                        {totalDelta === null && origTotal !== null && (
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>ATS match score</div>
                                        )}
                                    </div>
                                    <div className="score-hero-bars">
                                        {scoreMetrics.map(([k, v]) => {
                                            const orig = inputScores?.[k];
                                            const delta = orig !== undefined ? v - orig : null;
                                            const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                            return (
                                                <div key={k} className="score-bar-row">
                                                    <span className="score-bar-label">{label}</span>
                                                    <div className="score-bar-track">
                                                        <div className="score-bar-fill" style={{ width: `${v}%` }} />
                                                    </div>
                                                    <span className="score-bar-pct">{v}%</span>
                                                    {delta !== null && delta > 0 && (
                                                        <span style={{ fontSize: 10, color: 'var(--success)', width: 28, flexShrink: 0, fontWeight: 500 }}>+{delta}</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Resume preview */}
                            <div style={{ padding: 16, overflowX: 'auto' }}>
                                <div style={{
                                    minWidth: 816, maxWidth: 816, margin: '0 auto',
                                    backgroundColor: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                    borderRadius: 3
                                }}>
                                    <ResumeTemplate data={tailoredResume} ref={pdfRef} />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            <style>{`
                .spin-icon { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
