import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, Check, Settings, X } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import ResumeTemplate from '../components/ResumeTemplate';

export default function Tailor({ addToast }) {
    // Master Resume State
    const [resumeInputMode, setResumeInputMode] = useState('file'); // 'file' or 'text'
    const [resumeFile, setResumeFile] = useState(null);
    const [resumeText, setResumeText] = useState('');
    
    // Job Description State
    const [jdInputMode, setJdInputMode] = useState('text'); // 'file' or 'text'
    const [jdFile, setJdFile] = useState(null);
    const [jdText, setJdText] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [tailoredResume, setTailoredResume] = useState(null);
    const [logs, setLogs] = useState([]);
    const [showThinking, setShowThinking] = useState(false);
    const [inputScores, setInputScores] = useState(null);
    const [outputScores, setOutputScores] = useState(null);
    const pdfRef = useRef(null);

    const handleGenerate = async () => {
        if (resumeInputMode === 'file' && !resumeFile) return addToast('Please upload a master resume file', 'error');
        if (resumeInputMode === 'text' && !resumeText.trim()) return addToast('Please paste your master resume text', 'error');
        if (jdInputMode === 'file' && !jdFile) return addToast('Please upload a job description file', 'error');
        if (jdInputMode === 'text' && !jdText.trim()) return addToast('Please paste a job description', 'error');

        setIsLoading(true);
        setTailoredResume(null);
        setInputScores(null);
        setOutputScores(null);
        setLogs([]);

        try {
            const formData = new FormData();
            if (resumeInputMode === 'file') formData.append('master_resume_file', resumeFile);
            else formData.append('master_resume_text', resumeText);

            if (jdInputMode === 'file') formData.append('job_description_file', jdFile);
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
        if (!tailoredResume || !pdfRef.current) return;
        addToast('Generating PDF...');
        const opt = {
            margin: 0,
            filename: 'tailored_resume.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(pdfRef.current).save().then(() => {
            addToast('Downloaded successfully!', 'success');
        });
    };

    const isReady = (resumeInputMode === 'file' ? !!resumeFile : !!resumeText.trim()) &&
                    (jdInputMode === 'file' ? !!jdFile : !!jdText.trim());

    // Tracking UI State
    const status = tailoredResume ? 'done' : isLoading ? 'current' : 'pending';

    return (
        <div style={{ paddingBottom: 64 }}>
            <div className="page-header" style={{ textAlign: 'center', marginBottom: 40 }}>
                <h2 className="page-title">Tailor Resume</h2>
                <p className="page-subtitle">Map your master experiences to a specific JD below.</p>
            </div>

            {/* Top Row: Two Column Grid for inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24, marginBottom: 32 }}>
                
                {/* Left: Master Resume */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div className="label-caps">1. Master Resume</div>
                        <div className="pill-group">
                            <button className={`pill-tab ${resumeInputMode === 'file' ? 'active' : ''}`} onClick={() => setResumeInputMode('file')}>File</button>
                            <button className={`pill-tab ${resumeInputMode === 'text' ? 'active' : ''}`} onClick={() => setResumeInputMode('text')}>Text</button>
                        </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {resumeInputMode === 'file' ? (
                            <label className={`upload-zone ${resumeFile ? 'loaded' : ''}`} style={{ flex: 1 }}>
                                <input type="file" accept=".pdf,.json,.docx" style={{ display: 'none' }} onChange={e => setResumeFile(e.target.files[0])} />
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
                            <textarea className="form-textarea" style={{ flex: 1, minHeight: 200 }} placeholder="Paste Master Resume text..." value={resumeText} onChange={e => setResumeText(e.target.value)} />
                        )}
                    </div>
                </div>

                {/* Right: Job Description */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div className="label-caps">2. Job Description</div>
                        <div className="pill-group">
                            <button className={`pill-tab ${jdInputMode === 'text' ? 'active' : ''}`} onClick={() => setJdInputMode('text')}>Text</button>
                            <button className={`pill-tab ${jdInputMode === 'file' ? 'active' : ''}`} onClick={() => setJdInputMode('file')}>File</button>
                        </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {jdInputMode === 'text' ? (
                            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <textarea className="form-textarea jd-textarea" style={{ flex: 1, minHeight: 200 }} placeholder="Paste the Job Description..." value={jdText} onChange={e => setJdText(e.target.value)} />
                                <div style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 10, color: 'var(--text-muted)' }}>{jdText.length} chars</div>
                            </div>
                        ) : (
                            <label className={`upload-zone ${jdFile ? 'loaded' : ''}`} style={{ flex: 1 }}>
                                <input type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }} onChange={e => setJdFile(e.target.files[0])} />
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
                    disabled={!isReady || isLoading}
                >
                    {isLoading ? 'Crafting tailored resume...' : 'Generate New Resume'}
                </button>
            </div>

            {/* Full Width Output Section */}
            {(isLoading || tailoredResume) && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: 24, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="label-caps">3. Tailored Result</div>
                        {tailoredResume && (
                            <button className="btn btn-primary btn-sm" onClick={handleDownload}>
                                <Download size={14} color="#1C1917"/> Download PDF
                            </button>
                        )}
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
                            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 32, alignItems: 'start' }}>
                                
                                {/* Left Side: Score Cards */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                    
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

                                {/* Right Side: Resume Preview Canvas */}
                                <div style={{ backgroundColor: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                    <ResumeTemplate data={tailoredResume} ref={pdfRef} />
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
