import React, { useState, useEffect, useRef } from 'react';
import { User, Briefcase, GraduationCap, Code, Save, Plus, Trash2, Award, Upload, Loader2, Check } from 'lucide-react';
import api from '../services/api';

// Compute a simple profile strength 0-100
function computeStrength(profile) {
    let score = 0;
    const p = profile.personal_info;
    if (p.name) score += 10;
    if (p.email) score += 10;
    if (p.phone) score += 5;
    if (p.linkedin) score += 5;
    if (p.github) score += 5;
    if (p.portfolio) score += 5;
    if (profile.summary && profile.summary.length > 50) score += 15;
    if (profile.experience.length > 0) score += 15;
    if (profile.experience.length > 1) score += 10;
    if (profile.education.length > 0) score += 5;
    if (profile.skills.length > 3) score += 5;
    if (profile.projects.length > 0) score += 10;
    return Math.min(score, 100);
}

// Section completion indicators
function sectionStatus(profile, id) {
    switch (id) {
        case 'personal': {
            const p = profile.personal_info;
            const filled = [p.name, p.email, p.phone, p.linkedin].filter(Boolean).length;
            if (filled === 4 && profile.summary?.length > 50) return 'done';
            if (filled >= 2) return 'partial';
            return 'empty';
        }
        case 'experience': return profile.experience.length > 1 ? 'done' : profile.experience.length === 1 ? 'partial' : 'empty';
        case 'education': return profile.education.length > 0 ? 'done' : 'empty';
        case 'projects': return profile.projects.length > 1 ? 'done' : profile.projects.length === 1 ? 'partial' : 'empty';
        case 'skills': return profile.skills.length > 5 ? 'done' : profile.skills.length > 0 ? 'partial' : 'empty';
        default: return 'empty';
    }
}

function StatusDot({ status }) {
    if (status === 'done') return <Check size={10} style={{ color: 'var(--success)', flexShrink: 0 }} />;
    if (status === 'partial') return (
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D4A017', flexShrink: 0 }} />
    );
    return <span style={{ width: 8, height: 8, borderRadius: '50%', border: '0.5px solid var(--border)', flexShrink: 0 }} />;
}

function SectionDivider({ label }) {
    return (
        <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 20, marginTop: 28, marginBottom: 18 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
        </div>
    );
}

export default function Profile({ addToast }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const fileInputRef = useRef(null);

    const [profile, setProfile] = useState({
        personal_info: { name: '', email: '', phone: '', linkedin: '', github: '', portfolio: '' },
        summary: '',
        skills: [],
        experience: [],
        education: [],
        projects: [],
        certifications: []
    });

    const [activeTab, setActiveTab] = useState('personal');

    useEffect(() => {
        api.getProfile()
            .then(data => {
                if (data && Object.keys(data).length > 0) {
                    const links = data.personal_info?.links || [];
                    setProfile({
                        personal_info: {
                            name: data.personal_info?.name || '',
                            email: data.personal_info?.email || '',
                            phone: data.personal_info?.phone || '',
                            linkedin: links.find(l => l.includes('linkedin')) || '',
                            github: links.find(l => l.includes('github')) || '',
                            portfolio: links.find(l => !l.includes('linkedin') && !l.includes('github')) || '',
                            links
                        },
                        summary: data.summary || '',
                        skills: data.skills || [],
                        experience: data.experience || [],
                        education: data.education || [],
                        projects: data.projects || [],
                        certifications: data.certifications || []
                    });
                }
            })
            .catch(err => addToast('Failed to load profile: ' + err.message, 'error'))
            .finally(() => setIsLoading(false));
    }, [addToast]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const profileToSave = {
                ...profile,
                personal_info: {
                    ...profile.personal_info,
                    links: [profile.personal_info.linkedin, profile.personal_info.github, profile.personal_info.portfolio].filter(Boolean)
                }
            };
            await api.updateProfile(profileToSave);
            addToast('Profile saved', 'success');
        } catch (e) {
            addToast('Failed to save: ' + e.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setIsParsing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const parsedData = await api.parseProfile(formData);
            if (parsedData) {
                const links = parsedData.personal_info?.links || [];
                setProfile(prev => ({
                    personal_info: {
                        ...prev.personal_info, ...parsedData.personal_info,
                        linkedin: links.find(l => l.includes('linkedin')) || prev.personal_info.linkedin,
                        github: links.find(l => l.includes('github')) || prev.personal_info.github,
                        portfolio: links.find(l => !l.includes('linkedin') && !l.includes('github')) || prev.personal_info.portfolio,
                        links
                    },
                    summary: parsedData.summary || prev.summary,
                    skills: parsedData.skills || prev.skills,
                    experience: parsedData.experience?.length ? parsedData.experience : prev.experience,
                    education: parsedData.education?.length ? parsedData.education : prev.education,
                    projects: parsedData.projects?.length ? parsedData.projects : prev.projects,
                    certifications: parsedData.certifications?.length ? parsedData.certifications : prev.certifications
                }));
                addToast('Resume imported — review below', 'success');
            }
        } catch (e) {
            addToast('Failed to import: ' + e.message, 'error');
        } finally {
            setIsParsing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handlePersonalInfoChange = (field, value) => {
        setProfile(prev => ({ ...prev, personal_info: { ...prev.personal_info, [field]: value } }));
    };

    const updateArrayItem = (arrayName, index, field, value) => {
        setProfile(prev => {
            const newArray = [...prev[arrayName]];
            newArray[index] = { ...newArray[index], [field]: value };
            return { ...prev, [arrayName]: newArray };
        });
    };

    const addArrayItem = (arrayName, emptyItem) => {
        setProfile(prev => ({ ...prev, [arrayName]: [...prev[arrayName], emptyItem] }));
    };

    const removeArrayItem = (arrayName, index) => {
        setProfile(prev => ({ ...prev, [arrayName]: prev[arrayName].filter((_, i) => i !== index) }));
    };

    const handleBulletsChange = (arrayName, index, field, text) => {
        updateArrayItem(arrayName, index, field, text.split('\n').filter(l => l.trim().length > 0));
    };

    if (isLoading) {
        return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>;
    }

    const strength = computeStrength(profile);

    const tabs = [
        { id: 'personal', label: 'Personal & Summary', icon: <User size={14} /> },
        { id: 'experience', label: 'Experience', icon: <Briefcase size={14} /> },
        { id: 'education', label: 'Education', icon: <GraduationCap size={14} /> },
        { id: 'projects', label: 'Projects', icon: <Code size={14} /> },
        { id: 'skills', label: 'Skills & Certs', icon: <Award size={14} /> }
    ];

    // Shared card styles for array items
    const entryCard = {
        padding: 18,
        border: '0.5px solid var(--border)',
        borderRadius: 8,
        position: 'relative',
        background: 'var(--bg-surface)'
    };

    return (
        <div style={{ paddingBottom: 72 }}>
            {/* Workspace page header */}
            <div className="ws-page-header">
                <span className="ws-page-title">Profile builder</span>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: 'none' }}
                        ref={fileInputRef} onChange={handleFileUpload} />
                    <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}
                        disabled={isParsing} style={{ fontSize: 12 }}>
                        {isParsing ? <Loader2 size={12} className="spin-icon" /> : <Upload size={12} />}
                        {isParsing ? 'Importing...' : 'Import resume'}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={handleSave}
                        disabled={isSaving || isParsing} style={{ fontSize: 12 }}>
                        <Save size={12} /> {isSaving ? 'Saving...' : 'Save profile'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16 }}>
                {/* Sidebar */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 10,
                    padding: 12,
                    height: 'fit-content',
                    position: 'sticky',
                    top: 28,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0
                }}>
                    {/* Profile strength */}
                    <div style={{ padding: '10px 8px 14px', borderBottom: '0.5px solid var(--border)', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Profile strength</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: strength >= 70 ? 'var(--success)' : '#D4A017' }}>{strength}%</span>
                        </div>
                        <div className="profile-strength-bar-track">
                            <div className="profile-strength-bar-fill" style={{ width: `${strength}%` }} />
                        </div>
                    </div>

                    {/* Nav items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
                        {tabs.map(tab => {
                            const status = sectionStatus(profile, tab.id);
                            const isActive = activeTab === tab.id;
                            return (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    gap: 8, padding: '9px 10px', borderRadius: 6, border: 'none',
                                    background: isActive ? 'rgba(212,160,23,0.1)' : 'transparent',
                                    color: isActive ? '#D4A017' : 'var(--text-secondary)',
                                    fontWeight: isActive ? 500 : 400, cursor: 'pointer', width: '100%',
                                    fontSize: 13, transition: 'all 100ms ease', textAlign: 'left'
                                }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {tab.icon} {tab.label}
                                    </span>
                                    <StatusDot status={status} />
                                </button>
                            );
                        })}
                    </div>

                    {/* Nudge card */}
                    {profile.projects.length === 0 && (
                        <div className="sidebar-nudge">
                            <strong>Add projects</strong>
                            Profiles with projects get 23% better match scores in tailoring.
                        </div>
                    )}
                </div>

                {/* Form content */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 10,
                    padding: 24,
                    minHeight: 480
                }}>
                    {/* Personal & Summary */}
                    {activeTab === 'personal' && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 0 }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Full name</label>
                                    <input className="form-input" value={profile.personal_info.name || ''} onChange={e => handlePersonalInfoChange('name', e.target.value)} placeholder="Jane Doe" />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Email address</label>
                                    <input className="form-input" type="email" value={profile.personal_info.email || ''} onChange={e => handlePersonalInfoChange('email', e.target.value)} placeholder="you@example.com" />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Phone number</label>
                                    <input className="form-input" value={profile.personal_info.phone || ''} onChange={e => handlePersonalInfoChange('phone', e.target.value)} placeholder="+1 555 000 0000" />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">LinkedIn URL</label>
                                    <input className="form-input" value={profile.personal_info.linkedin || ''} onChange={e => handlePersonalInfoChange('linkedin', e.target.value)} placeholder="linkedin.com/in/yourname" />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">GitHub URL</label>
                                    <input className="form-input" value={profile.personal_info.github || ''} onChange={e => handlePersonalInfoChange('github', e.target.value)} placeholder="Your GitHub URL" />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Portfolio / website</label>
                                    <input className="form-input" value={profile.personal_info.portfolio || ''} onChange={e => handlePersonalInfoChange('portfolio', e.target.value)} placeholder="yoursite.com" />
                                </div>
                            </div>

                            <SectionDivider label="Professional summary" />
                            <textarea className="form-textarea" rows={5} style={{ resize: 'vertical' }}
                                value={profile.summary || ''}
                                onChange={e => setProfile(prev => ({ ...prev, summary: e.target.value }))}
                                placeholder="Write a comprehensive summary of your career trajectory, strengths, and value propositions. The AI will distill this for each specific role." />
                        </div>
                    )}

                    {/* Experience */}
                    {activeTab === 'experience' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Work experience</span>
                                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                                    onClick={() => addArrayItem('experience', { company: '', title: '', date: '', location: '', description: [] })}>
                                    <Plus size={12} /> Add role
                                </button>
                            </div>
                            {profile.experience.length === 0 ? (
                                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-surface)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
                                    No experience entries. Add your work history.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {profile.experience.map((exp, idx) => (
                                        <div key={idx} style={entryCard}>
                                            <button style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 5, transition: 'color 100ms' }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                                onClick={() => removeArrayItem('experience', idx)}>
                                                <Trash2 size={13} />
                                            </button>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14, paddingRight: 32 }}>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Company</label>
                                                    <input className="form-input" value={exp.company || ''} onChange={e => updateArrayItem('experience', idx, 'company', e.target.value)} placeholder="Acme Inc." />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Role title</label>
                                                    <input className="form-input" value={exp.title || ''} onChange={e => updateArrayItem('experience', idx, 'title', e.target.value)} placeholder="Senior Software Engineer" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Duration</label>
                                                    <input className="form-input" value={exp.date || ''} onChange={e => updateArrayItem('experience', idx, 'date', e.target.value)} placeholder="Jan 2020 – Present" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Location</label>
                                                    <input className="form-input" value={exp.location || ''} onChange={e => updateArrayItem('experience', idx, 'location', e.target.value)} placeholder="San Francisco, CA" />
                                                </div>
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Responsibilities (one per line)</label>
                                                <textarea className="form-textarea" rows={4}
                                                    placeholder={"Developed microservices...\nLed a team of 4 engineers...\nIncreased revenue by 15%..."}
                                                    value={(exp.description || []).join('\n')}
                                                    onChange={e => handleBulletsChange('experience', idx, 'description', e.target.value)} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Education */}
                    {activeTab === 'education' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Education</span>
                                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                                    onClick={() => addArrayItem('education', { institution: '', degree: '', date: '', location: '', gpa: '', details: [] })}>
                                    <Plus size={12} /> Add entry
                                </button>
                            </div>
                            {profile.education.length === 0 ? (
                                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-surface)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
                                    No education entries.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {profile.education.map((edu, idx) => (
                                        <div key={idx} style={entryCard}>
                                            <button style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 5, transition: 'color 100ms' }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                                onClick={() => removeArrayItem('education', idx)}>
                                                <Trash2 size={13} />
                                            </button>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14, paddingRight: 32 }}>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Institution</label>
                                                    <input className="form-input" value={edu.institution || ''} onChange={e => updateArrayItem('education', idx, 'institution', e.target.value)} placeholder="MIT" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Degree / major</label>
                                                    <input className="form-input" value={edu.degree || ''} onChange={e => updateArrayItem('education', idx, 'degree', e.target.value)} placeholder="B.S. Computer Science" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Duration</label>
                                                    <input className="form-input" value={edu.date || ''} onChange={e => updateArrayItem('education', idx, 'date', e.target.value)} placeholder="Aug 2016 – May 2020" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">GPA (optional)</label>
                                                    <input className="form-input" value={edu.gpa || ''} onChange={e => updateArrayItem('education', idx, 'gpa', e.target.value)} placeholder="3.8 / 4.0" />
                                                </div>
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Additional details (one per line)</label>
                                                <textarea className="form-textarea" rows={3}
                                                    value={(edu.details || []).join('\n')}
                                                    onChange={e => handleBulletsChange('education', idx, 'details', e.target.value)} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Projects */}
                    {activeTab === 'projects' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Projects</span>
                                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                                    onClick={() => addArrayItem('projects', { name: '', description: '', link: '', technologies: [] })}>
                                    <Plus size={12} /> Add project
                                </button>
                            </div>
                            {profile.projects.length === 0 ? (
                                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-surface)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
                                    No projects added. Projects significantly improve tailoring quality.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {profile.projects.map((proj, idx) => (
                                        <div key={idx} style={entryCard}>
                                            <button style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 5, transition: 'color 100ms' }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                                onClick={() => removeArrayItem('projects', idx)}>
                                                <Trash2 size={13} />
                                            </button>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14, paddingRight: 32 }}>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Project name</label>
                                                    <input className="form-input" value={proj.name || ''} onChange={e => updateArrayItem('projects', idx, 'name', e.target.value)} placeholder="Analytics Platform" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Link (optional)</label>
                                                    <input className="form-input" value={proj.link || ''} onChange={e => updateArrayItem('projects', idx, 'link', e.target.value)} placeholder="github.com/you/project" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                                                    <label className="form-label">Technologies (comma-separated)</label>
                                                    <input className="form-input" value={(proj.technologies || []).join(', ')}
                                                        onChange={e => updateArrayItem('projects', idx, 'technologies', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                                                        placeholder="React, Node.js, PostgreSQL" />
                                                </div>
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Description</label>
                                                <textarea className="form-textarea" rows={4}
                                                    value={proj.description || ''}
                                                    onChange={e => updateArrayItem('projects', idx, 'description', e.target.value)} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Skills & Certs */}
                    {activeTab === 'skills' && (
                        <div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Skills & certifications</span>
                            <div className="form-group" style={{ margin: '16px 0 0' }}>
                                <label className="form-label">Skills (comma-separated)</label>
                                <textarea className="form-textarea" rows={4} style={{ lineHeight: 1.7 }}
                                    value={(profile.skills || []).join(', ')}
                                    onChange={e => setProfile(prev => ({ ...prev, skills: e.target.value.split(',').map(s => s.trim()).filter(s => s) }))}
                                    placeholder="Python, React, AWS, Kubernetes, Distributed Systems..." />
                            </div>

                            <SectionDivider label="Certifications" />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                                    onClick={() => addArrayItem('certifications', { name: '', issuer: '', year: '' })}>
                                    <Plus size={12} /> Add cert
                                </button>
                            </div>
                            {(!profile.certifications || profile.certifications.length === 0) ? (
                                <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-surface)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
                                    No certifications added.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {profile.certifications.map((cert, idx) => (
                                        <div key={idx} style={{ ...entryCard, display: 'grid', gridTemplateColumns: 'minmax(180px, 2fr) minmax(140px, 1fr) 90px 32px', gap: 12, alignItems: 'end' }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Name</label>
                                                <input className="form-input" value={cert.name || ''} onChange={e => updateArrayItem('certifications', idx, 'name', e.target.value)} placeholder="AWS Solutions Architect" />
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Issuer</label>
                                                <input className="form-input" value={cert.issuer || ''} onChange={e => updateArrayItem('certifications', idx, 'issuer', e.target.value)} placeholder="Amazon Web Services" />
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Year</label>
                                                <input className="form-input" value={cert.year || ''} onChange={e => updateArrayItem('certifications', idx, 'year', e.target.value)} placeholder="2024" />
                                            </div>
                                            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 5, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 100ms' }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                                onClick={() => removeArrayItem('certifications', idx)}>
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .spin-icon { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
