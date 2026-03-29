import React, { useState, useEffect, useRef } from 'react';
import { User, Briefcase, GraduationCap, Code, FileText, Save, Plus, Trash2, Award, Upload, Loader2 } from 'lucide-react';
import api from '../services/api';

export default function Profile({ addToast }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const fileInputRef = useRef(null);
    
    // Core state structure matches master_resume.json
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
                    setProfile({
                        personal_info: data.personal_info || { name: '', email: '', phone: '', linkedin: '', github: '', portfolio: '' },
                        summary: data.summary || '',
                        skills: data.skills || [],
                        experience: data.experience || [],
                        education: data.education || [],
                        projects: data.projects || [],
                        certifications: data.certifications || []
                    });
                }
            })
            .catch(err => addToast('Failed to load profile details: ' + err.message, 'error'))
            .finally(() => setIsLoading(false));
    }, [addToast]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.updateProfile(profile);
            addToast('Profile saved successfully! Ready for AI tailoring.', 'success');
        } catch (e) {
            addToast('Failed to save profile: ' + e.message, 'error');
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
                setProfile(prev => ({
                    personal_info: { ...prev.personal_info, ...(parsedData.personal_info || {}) },
                    summary: parsedData.summary || prev.summary,
                    skills: parsedData.skills || prev.skills,
                    experience: parsedData.experience?.length ? parsedData.experience : prev.experience,
                    education: parsedData.education?.length ? parsedData.education : prev.education,
                    projects: parsedData.projects?.length ? parsedData.projects : prev.projects,
                    certifications: parsedData.certifications?.length ? parsedData.certifications : prev.certifications
                }));
                addToast('Resume impressively parsed! Please review your profile data below.', 'success');
            }
        } catch (e) {
            addToast('Failed to parse resume: ' + e.message, 'error');
        } finally {
            setIsParsing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handlePersonalInfoChange = (field, value) => {
        setProfile(prev => ({
            ...prev,
            personal_info: { ...prev.personal_info, [field]: value }
        }));
    };

    const updateArrayItem = (arrayName, index, field, value) => {
        setProfile(prev => {
            const newArray = [...prev[arrayName]];
            newArray[index] = { ...newArray[index], [field]: value };
            return { ...prev, [arrayName]: newArray };
        });
    };

    const addArrayItem = (arrayName, emptyItem) => {
        setProfile(prev => ({
            ...prev,
            [arrayName]: [...prev[arrayName], emptyItem]
        }));
    };

    const removeArrayItem = (arrayName, index) => {
        setProfile(prev => ({
            ...prev,
            [arrayName]: prev[arrayName].filter((_, i) => i !== index)
        }));
    };

    const handleBulletsChange = (arrayName, index, field, text) => {
        const bullets = text.split('\n').filter(line => line.trim().length > 0);
        updateArrayItem(arrayName, index, field, bullets);
    };

    if (isLoading) {
        return (
            <div style={{ paddingBottom: 64 }}>
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading your profile data...</div>
            </div>
        );
    }

    const tabs = [
        { id: 'personal', label: 'Personal & Summary', icon: <User size={16} /> },
        { id: 'experience', label: 'Experience', icon: <Briefcase size={16} /> },
        { id: 'education', label: 'Education', icon: <GraduationCap size={16} /> },
        { id: 'projects', label: 'Projects', icon: <Code size={16} /> },
        { id: 'skills', label: 'Skills & Certs', icon: <Award size={16} /> }
    ];

    return (
        <div style={{ paddingBottom: 64 }}>
            <div className="hero-split app-hero tailor-hero" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div className="hero-split-copy">
                    <div className="page-kicker">Master Record</div>
                    <h2 className="page-title hero-title">Profile Builder</h2>
                    <p className="page-subtitle hero-subtitle">Manage your comprehensive background. AI agents will draw from this to tailor applications.</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <input 
                        type="file" 
                        accept=".pdf,.docx,.doc,.txt" 
                        style={{ display: 'none' }} 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={isParsing}>
                        {isParsing ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} 
                        {isParsing ? 'Parsing AI...' : 'Import Resume'}
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || isParsing}>
                        <Save size={16} /> {isSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>

            <div className="layout-grid" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 32 }}>
                
                {/* Vertical Navigation Tabs */}
                <div className="profile-sidebar" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: 12, height: 'fit-content', position: 'sticky', top: 32 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {tabs.map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8,
                                    border: 'none', background: activeTab === tab.id ? 'var(--blue-bg)' : 'transparent',
                                    color: activeTab === tab.id ? 'var(--blue)' : 'var(--text-secondary)',
                                    fontWeight: activeTab === tab.id ? 600 : 500,
                                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', fontSize: 14
                                }}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Form Content Area */}
                <div className="profile-content" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: 32 }}>
                    
                    {/* Personal & Summary */}
                    {activeTab === 'personal' && (
                        <div className="form-section fade-in">
                            <h3 style={{ marginTop: 0, marginBottom: 24, fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <User size={20} color="var(--blue)" /> Personal Information
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Full Name</label>
                                    <input className="form-input" value={profile.personal_info.name || ''} onChange={e => handlePersonalInfoChange('name', e.target.value)} placeholder="Jane Doe" />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Email Address</label>
                                    <input className="form-input" value={profile.personal_info.email || ''} onChange={e => handlePersonalInfoChange('email', e.target.value)} placeholder="jane@example.com" />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Phone Number</label>
                                    <input className="form-input" value={profile.personal_info.phone || ''} onChange={e => handlePersonalInfoChange('phone', e.target.value)} placeholder="+1 (555) 123-4567" />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">LinkedIn URL</label>
                                    <input className="form-input" value={profile.personal_info.linkedin || ''} onChange={e => handlePersonalInfoChange('linkedin', e.target.value)} placeholder="linkedin.com/in/janedoe" />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">GitHub URL</label>
                                    <input className="form-input" value={profile.personal_info.github || ''} onChange={e => handlePersonalInfoChange('github', e.target.value)} placeholder="github.com/janedoe" />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Portfolio / Website</label>
                                    <input className="form-input" value={profile.personal_info.portfolio || ''} onChange={e => handlePersonalInfoChange('portfolio', e.target.value)} placeholder="janedoe.com" />
                                </div>
                            </div>
                            
                            <h3 style={{ marginTop: 0, marginBottom: 24, fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FileText size={20} color="var(--blue)" /> Professional Summary
                            </h3>
                            <div className="form-group" style={{ margin: 0 }}>
                                <textarea 
                                    className="form-input" 
                                    rows={5} 
                                    style={{ resize: 'vertical' }}
                                    value={profile.summary || ''} 
                                    onChange={e => setProfile(prev => ({...prev, summary: e.target.value}))} 
                                    placeholder="Write a comprehensive executive summary detailing your global trajectory, main value propositions, and overarching career themes. Our agent will distill this to tailor it to specific roles."
                                />
                            </div>
                        </div>
                    )}

                    {/* Experience */}
                    {activeTab === 'experience' && (
                        <div className="form-section fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Briefcase size={20} color="var(--blue)" /> Work Experience
                                </h3>
                                <button className="btn btn-sm btn-secondary" onClick={() => addArrayItem('experience', { company: '', role: '', duration: '', location: '', responsibilities: [] })}>
                                    <Plus size={14} /> Add Role
                                </button>
                            </div>
                            
                            {profile.experience.length === 0 ? (
                                <div className="empty-state" style={{ padding: '40px 20px', backgroundColor: 'var(--bg-surface)' }}>
                                    <p>No experience entries. Add your work history here.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                                    {profile.experience.map((exp, idx) => (
                                        <div key={idx} style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', position: 'relative', backgroundColor: 'var(--bg-surface)' }}>
                                            <button 
                                                style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                                                onClick={() => removeArrayItem('experience', idx)}
                                                className="hover-bg"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20, paddingRight: 40 }}>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Company</label>
                                                    <input className="form-input" value={exp.company || ''} onChange={e => updateArrayItem('experience', idx, 'company', e.target.value)} placeholder="Acme Inc." />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Role Title</label>
                                                    <input className="form-input" value={exp.role || ''} onChange={e => updateArrayItem('experience', idx, 'role', e.target.value)} placeholder="Senior Software Engineer" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Duration</label>
                                                    <input className="form-input" value={exp.duration || ''} onChange={e => updateArrayItem('experience', idx, 'duration', e.target.value)} placeholder="Jan 2020 - Present" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Location</label>
                                                    <input className="form-input" value={exp.location || ''} onChange={e => updateArrayItem('experience', idx, 'location', e.target.value)} placeholder="San Francisco, CA" />
                                                </div>
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Responsibilities (One per line)</label>
                                                <textarea 
                                                    className="form-input" 
                                                    rows={5}
                                                    placeholder="Developed microservices...&#10;Lead a team of 4 engineers...&#10;Increased revenue by 15%..."
                                                    value={(exp.responsibilities || []).join('\n')}
                                                    onChange={e => handleBulletsChange('experience', idx, 'responsibilities', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Education */}
                    {activeTab === 'education' && (
                        <div className="form-section fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <GraduationCap size={20} color="var(--blue)" /> Education
                                </h3>
                                <button className="btn btn-sm btn-secondary" onClick={() => addArrayItem('education', { institution: '', degree: '', duration: '', location: '', gpa: '', details: [] })}>
                                    <Plus size={14} /> Add Education
                                </button>
                            </div>
                            
                            {profile.education.length === 0 ? (
                                <div className="empty-state" style={{ padding: '40px 20px', backgroundColor: 'var(--bg-surface)' }}>
                                    <p>No educational background added.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                                    {profile.education.map((edu, idx) => (
                                        <div key={idx} style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', position: 'relative', backgroundColor: 'var(--bg-surface)' }}>
                                            <button 
                                                style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                                                onClick={() => removeArrayItem('education', idx)}
                                                className="hover-bg"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20, paddingRight: 40 }}>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Institution</label>
                                                    <input className="form-input" value={edu.institution || ''} onChange={e => updateArrayItem('education', idx, 'institution', e.target.value)} placeholder="University of Technology" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Degree / Major</label>
                                                    <input className="form-input" value={edu.degree || ''} onChange={e => updateArrayItem('education', idx, 'degree', e.target.value)} placeholder="B.S. in Computer Science" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Duration</label>
                                                    <input className="form-input" value={edu.duration || ''} onChange={e => updateArrayItem('education', idx, 'duration', e.target.value)} placeholder="Aug 2016 - May 2020" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">GPA (Optional)</label>
                                                    <input className="form-input" value={edu.gpa || ''} onChange={e => updateArrayItem('education', idx, 'gpa', e.target.value)} placeholder="3.8 / 4.0" />
                                                </div>
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Additional Details (One per line, e.g. coursework, honors)</label>
                                                <textarea 
                                                    className="form-input" 
                                                    rows={3}
                                                    value={(edu.details || []).join('\n')}
                                                    onChange={e => handleBulletsChange('education', idx, 'details', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Projects */}
                    {activeTab === 'projects' && (
                        <div className="form-section fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Code size={20} color="var(--blue)" /> Portfolio Projects
                                </h3>
                                <button className="btn btn-sm btn-secondary" onClick={() => addArrayItem('projects', { name: '', description: '', link: '', technologies: [], highlights: [] })}>
                                    <Plus size={14} /> Add Project
                                </button>
                            </div>
                            
                            {profile.projects.length === 0 ? (
                                <div className="empty-state" style={{ padding: '40px 20px', backgroundColor: 'var(--bg-surface)' }}>
                                    <p>No projects added.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                                    {profile.projects.map((proj, idx) => (
                                        <div key={idx} style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', position: 'relative', backgroundColor: 'var(--bg-surface)' }}>
                                            <button 
                                                style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                                                onClick={() => removeArrayItem('projects', idx)}
                                                className="hover-bg"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20, paddingRight: 40 }}>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Project Name</label>
                                                    <input className="form-input" value={proj.name || ''} onChange={e => updateArrayItem('projects', idx, 'name', e.target.value)} placeholder="E-commerce Analytics Platform" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label">Link (Optional)</label>
                                                    <input className="form-input" value={proj.link || ''} onChange={e => updateArrayItem('projects', idx, 'link', e.target.value)} placeholder="github.com/my/project" />
                                                </div>
                                                <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                                                    <label className="form-label">Technologies (Comma separated)</label>
                                                    <input 
                                                        className="form-input" 
                                                        value={(proj.technologies || []).join(', ')} 
                                                        onChange={e => updateArrayItem('projects', idx, 'technologies', e.target.value.split(',').map(s => s.trim()).filter(s => s))} 
                                                        placeholder="React, Node.js, PostgreSQL" 
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Highlights / Description (One bullet per line)</label>
                                                <textarea 
                                                    className="form-input" 
                                                    rows={4}
                                                    value={(proj.highlights || [proj.description].filter(Boolean)).join('\n')}
                                                    onChange={e => {
                                                        const bullets = e.target.value.split('\n').filter(line => line.trim().length > 0);
                                                        const newArray = [...profile.projects];
                                                        newArray[idx] = { ...newArray[idx], highlights: bullets, description: bullets[0] || '' };
                                                        setProfile(prev => ({ ...prev, projects: newArray }));
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Skills & Certs */}
                    {activeTab === 'skills' && (
                        <div className="form-section fade-in">
                            <h3 style={{ marginTop: 0, marginBottom: 24, fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Award size={20} color="var(--blue)" /> Skills & Certifications
                            </h3>
                            
                            <div className="form-group" style={{ marginBottom: 32 }}>
                                <label className="form-label">Skills (Comma separated)</label>
                                <textarea 
                                    className="form-input" 
                                    rows={4}
                                    style={{ lineHeight: 1.6 }}
                                    value={(profile.skills || []).join(', ')}
                                    onChange={e => setProfile(prev => ({
                                        ...prev, 
                                        skills: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                                    }))}
                                    placeholder="Python, React, AWS, Kubernetes, Distributed Systems..."
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h4 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>Certifications</h4>
                                <button className="btn btn-sm btn-secondary" onClick={() => addArrayItem('certifications', { name: '', issuer: '', year: '' })}>
                                    <Plus size={14} /> Add Cert
                                </button>
                            </div>

                            {(!profile.certifications || profile.certifications.length === 0) ? (
                                <div className="empty-state" style={{ padding: '24px', backgroundColor: 'var(--bg-surface)' }}>
                                    <p style={{ margin: 0 }}>No certifications added.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {profile.certifications.map((cert, idx) => (
                                        <div key={idx} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) minmax(150px, 1fr) 100px 40px', gap: 16, alignItems: 'end', backgroundColor: 'var(--bg-surface)' }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: 12 }}>Certification Name</label>
                                                <input className="form-input" value={cert.name || ''} onChange={e => updateArrayItem('certifications', idx, 'name', e.target.value)} placeholder="AWS Solutions Architect" />
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: 12 }}>Issuer</label>
                                                <input className="form-input" value={cert.issuer || ''} onChange={e => updateArrayItem('certifications', idx, 'issuer', e.target.value)} placeholder="Amazon Web Services" />
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: 12 }}>Year</label>
                                                <input className="form-input" value={cert.year || ''} onChange={e => updateArrayItem('certifications', idx, 'year', e.target.value)} placeholder="2024" />
                                            </div>
                                            <button 
                                                style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 10, borderRadius: 8, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                onClick={() => removeArrayItem('certifications', idx)}
                                                className="hover-bg"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>
            
            <style jsx="true">{`
                .hover-bg:hover {
                    background-color: var(--error-bg) !important;
                }
                .fade-in {
                    animation: fadeIn 0.2s ease-in-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .profile-sidebar {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.02);
                }
                .profile-content {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.02);
                    min-height: 500px;
                }
            `}</style>
        </div>
    );
}
