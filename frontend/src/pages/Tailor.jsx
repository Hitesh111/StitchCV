import React, { useState } from 'react';
import { Upload, FileText, Wand2, Download, Check, AlertCircle } from 'lucide-react';

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

    const handleGenerate = async () => {
        if (resumeInputMode === 'file' && !resumeFile) {
            addToast('Please upload a master resume file', 'error');
            return;
        }
        if (resumeInputMode === 'text' && !resumeText.trim()) {
            addToast('Please paste your master resume text', 'error');
            return;
        }
        if (jdInputMode === 'file' && !jdFile) {
            addToast('Please upload a job description file', 'error');
            return;
        }
        if (jdInputMode === 'text' && !jdText.trim()) {
            addToast('Please paste a job description', 'error');
            return;
        }

        setIsLoading(true);
        setTailoredResume(null);
        setLogs([]);

        try {
            const formData = new FormData();
            
            // Append Resume
            if (resumeInputMode === 'file') {
                formData.append('master_resume_file', resumeFile);
            } else {
                formData.append('master_resume_text', resumeText);
            }

            // Append JD
            if (jdInputMode === 'file') {
                formData.append('job_description_file', jdFile);
            } else {
                formData.append('job_description_text', jdText);
            }

            const response = await fetch('/api/tailor_resume', {
                method: 'POST',
                body: formData, // No Content-Type header needed; browser boundary will be set
            });

            if (!response.ok) {
                let errorMsg = 'Failed to tailor resume';
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.detail || errorMsg;
                } catch(e) {}
                throw new Error(errorMsg);
            }

            // Read the SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                
                // Keep the last partial chunk in the buffer
                buffer = lines.pop() || "";

                for (const chunk of lines) {
                    if (!chunk.trim()) continue;
                    
                    const eventMatch = chunk.match(/^event:\s*(.*?)$/m);
                    const dataMatch = chunk.match(/^data:\s*(.*?)$/m);
                    
                    if (eventMatch && dataMatch) {
                        const event = eventMatch[1].trim();
                        let dataStr = dataMatch[1].trim();
                        // Unescape newlines
                        dataStr = dataStr.replace(/\\n/g, '\n');

                        if (event === "log") {
                            setLogs(prev => [...prev, dataStr]);
                        } else if (event === "result") {
                            // Final JSON payload
                            try {
                                const parsed = JSON.parse(dataStr);
                                setTailoredResume(parsed);
                                addToast('Resume tailored successfully!', 'success');
                            } catch (e) {
                                console.error("Failed to parse result JSON:", e);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Tailoring error:', error);
            addToast(error.message || 'Failed to connect to server', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = () => {
        if (!tailoredResume) return;

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tailoredResume, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "tailored_resume.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        addToast('Download started');
    };

    const isReady = (resumeInputMode === 'file' ? !!resumeFile : !!resumeText.trim()) &&
                    (jdInputMode === 'file' ? !!jdFile : !!jdText.trim());

    return (
        <div className="page-container">
            <header className="page-header">
                <div className="header-title">
                    <Wand2 className="header-icon" />
                    <h1>Tailor Resume</h1>
                </div>
                <p className="header-subtitle">
                    Provide your master resume (JSON, PDF, DOCX, or Text) and a job description to generate a highly targeted, ATS-optimized resume using AI.
                </p>
            </header>

            <div className="two-column-layout">
                <div className="column left-column">
                    {/* Master Resume Card */}
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title">1. Master Resume</h2>
                            <div className="tab-group">
                                <button 
                                    className={`tab-btn ${resumeInputMode === 'file' ? 'active' : ''}`}
                                    onClick={() => setResumeInputMode('file')}
                                >File</button>
                                <button 
                                    className={`tab-btn ${resumeInputMode === 'text' ? 'active' : ''}`}
                                    onClick={() => setResumeInputMode('text')}
                                >Plain Text</button>
                            </div>
                        </div>
                        <div className="card-body">
                            {resumeInputMode === 'file' ? (
                                <div className="upload-container">
                                    <label className="upload-label">
                                        <input 
                                            type="file" 
                                            accept=".json,application/json,.pdf,.docx" 
                                            onChange={(e) => setResumeFile(e.target.files[0] || null)} 
                                            className="hidden-input" 
                                        />
                                        <div className="upload-area">
                                            {resumeFile ? (
                                                <>
                                                    <Check className="icon-success" size={32} />
                                                    <span className="upload-text">{resumeFile.name} loaded</span>
                                                    <span className="upload-hint">Ready for AI processing</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="icon-muted" size={32} />
                                                    <span className="upload-text">Click to upload Master Resume</span>
                                                    <span className="upload-hint">Supports .json, .pdf, .docx</span>
                                                </>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            ) : (
                                <textarea
                                    className="input-textarea"
                                    placeholder="Paste your resume text here (or pure JSON)..."
                                    value={resumeText}
                                    onChange={(e) => setResumeText(e.target.value)}
                                    rows={8}
                                />
                            )}
                        </div>
                    </div>

                    {/* Job Description Card */}
                    <div className="card" style={{ marginTop: '20px' }}>
                        <div className="card-header">
                            <h2 className="card-title">2. Job Description</h2>
                            <div className="tab-group">
                                <button 
                                    className={`tab-btn ${jdInputMode === 'text' ? 'active' : ''}`}
                                    onClick={() => setJdInputMode('text')}
                                >Plain Text</button>
                                <button 
                                    className={`tab-btn ${jdInputMode === 'file' ? 'active' : ''}`}
                                    onClick={() => setJdInputMode('file')}
                                >File</button>
                            </div>
                        </div>
                        <div className="card-body">
                            {jdInputMode === 'text' ? (
                                <textarea
                                    className="input-textarea"
                                    placeholder="Paste the full job description here..."
                                    value={jdText}
                                    onChange={(e) => setJdText(e.target.value)}
                                    rows={8}
                                />
                            ) : (
                                <div className="upload-container">
                                    <label className="upload-label">
                                        <input 
                                            type="file" 
                                            accept=".pdf,.docx,.txt" 
                                            onChange={(e) => setJdFile(e.target.files[0] || null)} 
                                            className="hidden-input" 
                                        />
                                        <div className="upload-area">
                                            {jdFile ? (
                                                <>
                                                    <Check className="icon-success" size={32} />
                                                    <span className="upload-text">{jdFile.name} loaded</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="icon-muted" size={32} />
                                                    <span className="upload-text">Click to upload Job Description</span>
                                                    <span className="upload-hint">Supports .pdf, .docx, .txt</span>
                                                </>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            )}
                        </div>
                        <div className="card-footer">
                            <button 
                                className="btn btn-primary w-full" 
                                onClick={handleGenerate}
                                disabled={isLoading || !isReady}
                            >
                                {isLoading ? (
                                    <>
                                        <div className="spinner"></div>
                                        <span>Analyzing & Tailoring...</span>
                                    </>
                                ) : (
                                    <>
                                        <Wand2 size={18} />
                                        <span>Generate Tailored Resume</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="column right-column">
                    <div className="card h-full flex flex-col">
                        <div className="card-header flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <h2 className="card-title mb-0">3. Tailored Result</h2>
                                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer" style={{fontSize: '0.85rem'}}>
                                    <input 
                                        type="checkbox" 
                                        checked={showThinking} 
                                        onChange={(e) => setShowThinking(e.target.checked)}
                                        style={{ accentColor: 'var(--primary)' }}
                                    />
                                    Show "Thinking"
                                </label>
                            </div>
                            {tailoredResume && (
                                <button className="btn btn-outline btn-sm" onClick={handleDownload}>
                                    <Download size={16} />
                                    <span>Download JSON</span>
                                </button>
                            )}
                        </div>
                        <div className="card-body flex-1 overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
                            {showThinking && logs.length > 0 && (
                                <div className="thinking-viewer mb-4">
                                    <div className="thinking-header">
                                        <AlertCircle size={14} className="thinking-icon" />
                                        <span>Agent Logs</span>
                                    </div>
                                    <div className="thinking-content">
                                        {logs.map((log, idx) => (
                                            <div key={idx} className="log-entry">
                                                <span className="log-indicator">&gt;</span> {log}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isLoading && !tailoredResume ? (
                                <div className="loading-state">
                                    <div className="spinner large"></div>
                                    <p>AI is analyzing the inputs and optimizing your resume. This usually takes 10-30 seconds depending on input sizes...</p>
                                </div>
                            ) : tailoredResume ? (
                                <div className="result-container">
                                    <div className="success-banner">
                                        <Check size={18} />
                                        <span>Resume tailored successfully! The AI has optimized it into the standard JSON structure.</span>
                                    </div>
                                    <div className="code-viewer">
                                        <pre><code>{JSON.stringify(tailoredResume, null, 2)}</code></pre>
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <FileText className="icon-muted mb-4" size={48} />
                                    <h3>No Resume Generated Yet</h3>
                                    <p>Upload your inputs and click generate to see the structured, tailored result here.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            <style jsx="true">{`
                .two-column-layout {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    margin-top: 24px;
                }
                
                @media (max-width: 1024px) {
                    .two-column-layout {
                        grid-template-columns: 1fr;
                    }
                }
                
                .h-full { height: 100%; }
                .flex { display: flex; }
                .flex-col { flex-direction: column; }
                .flex-1 { flex: 1; }
                .overflow-hidden { overflow: hidden; }
                .justify-between { justify-content: space-between; }
                .items-center { align-items: center; }
                .mb-4 { margin-bottom: 16px; }
                .w-full { width: 100%; justify-content: center; }
                
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .tab-group {
                    display: flex;
                    background-color: var(--bg-secondary);
                    border-radius: 6px;
                    overflow: hidden;
                    border: 1px solid var(--border);
                }
                
                .tab-btn {
                    padding: 6px 12px;
                    font-size: 0.8rem;
                    border: none;
                    background: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .tab-btn.active {
                    background-color: var(--primary);
                    color: white;
                }
                
                .tab-btn:hover:not(.active) {
                    background-color: rgba(0, 0, 0, 0.05);
                }
                
                .upload-container {
                    border: 2px dashed var(--border);
                    border-radius: 8px;
                    padding: 32px;
                    text-align: center;
                    transition: all 0.2s;
                    background-color: var(--bg-secondary);
                }
                
                .upload-container:hover {
                    border-color: var(--primary);
                    background-color: var(--primary-light);
                }
                
                .upload-label {
                    cursor: pointer;
                    display: block;
                    width: 100%;
                }
                
                .hidden-input {
                    display: none;
                }
                
                .upload-area {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                }
                
                .upload-text {
                    font-weight: 500;
                    color: var(--text-primary);
                }
                
                .upload-hint {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                }
                
                .icon-muted { color: var(--text-muted); }
                .icon-success { color: var(--success); }
                
                .input-textarea {
                    width: 100%;
                    padding: 16px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background-color: var(--bg-secondary);
                    color: var(--text-primary);
                    font-family: inherit;
                    font-size: 0.95rem;
                    line-height: 1.5;
                    resize: vertical;
                    outline: none;
                    transition: border-color 0.2s;
                }
                
                .input-textarea:focus {
                    border-color: var(--primary);
                }
                
                .btn-sm {
                    padding: 6px 12px;
                    font-size: 0.85rem;
                }
                
                .loading-state, .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    text-align: center;
                    color: var(--text-muted);
                    padding: 48px 24px;
                }
                
                .loading-state p, .empty-state p {
                    margin-top: 16px;
                    max-width: 400px;
                }
                
                .empty-state h3 {
                    color: var(--text-primary);
                    margin-bottom: 8px;
                }
                
                .result-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    gap: 16px;
                }
                
                .success-banner {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background-color: rgba(16, 185, 129, 0.1);
                    color: var(--success);
                    padding: 12px 16px;
                    border-radius: 8px;
                    font-weight: 500;
                    font-size: 0.9rem;
                }
                
                .code-viewer {
                    flex: 1;
                    background-color: #1e1e1e;
                    border-radius: 8px;
                    overflow: auto;
                    padding: 16px;
                }
                
                .code-viewer pre {
                    margin: 0;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                
                .code-viewer code {
                    color: #d4d4d4;
                    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
                    font-size: 0.85rem;
                    line-height: 1.5;
                }
                
                .mb-0 { margin-bottom: 0; }
                .gap-4 { gap: 16px; }
                .gap-2 { gap: 8px; }
                .text-sm { font-size: 0.875rem; }
                .text-gray-400 { color: #9ca3af; }
                .cursor-pointer { cursor: pointer; }

                .thinking-viewer {
                    background-color: #1a1a1a;
                    border: 1px solid #333;
                    border-radius: 6px;
                    display: flex;
                    flex-direction: column;
                    flex-shrink: 0;
                    max-height: 150px;
                }
                .thinking-header {
                    background-color: #2d2d2d;
                    padding: 6px 12px;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #aaa;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    border-top-left-radius: 6px;
                    border-top-right-radius: 6px;
                }
                .thinking-content {
                    padding: 8px 12px;
                    overflow-y: auto;
                    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
                    font-size: 0.8rem;
                    color: #4ade80;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .log-entry {
                    word-break: break-all;
                }
                .log-indicator {
                    color: #3b82f6;
                    margin-right: 6px;
                }
            `}</style>
        </div>
    );
}
