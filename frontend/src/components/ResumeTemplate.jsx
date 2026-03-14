import React from 'react';

/**
 * Parses inline markdown: **bold**, *italic*, removes standalone asterisks
 * Returns an array of React elements.
 */
function renderInlineMarkdown(text) {
    if (!text) return null;
    const parts = [];
    const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        if (match[1] !== undefined) {
            parts.push(<strong key={match.index} style={{ fontWeight: 700, color: '#1C1917' }}>{match[1]}</strong>);
        } else if (match[2] !== undefined) {
            parts.push(<em key={match.index}>{match[2]}</em>);
        }
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
}

const SECTION_STYLE = { marginBottom: '20px' };
const SECTION_HEADING = {
    fontFamily: "'Inter', sans-serif",
    fontSize: '11px',
    fontWeight: '800',
    color: '#A8A29E', // text-muted
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    borderBottom: '1px solid #E7E5E4',
    paddingBottom: '6px',
    marginBottom: '12px',
};

const ResumeTemplate = React.forwardRef(({ data }, ref) => {
    if (!data) return null;

    const {
        personal_info = {},
        summary = '',
        skills = [],
        experience = [],
        education = [],
        projects = [],
    } = data;

    return (
        <div
            ref={ref}
            style={{
                fontFamily: "'Inter', sans-serif",
                color: '#1C1917',
                padding: '48px 56px',
                background: '#FFFFFF', // Pure white back per spec
                margin: '0 auto',
                lineHeight: '1.5',
                fontSize: '13px', // Base size
                boxSizing: 'border-box'
            }}
        >
            {/* ── Header ── */}
            <header style={{ marginBottom: '32px' }}>
                <h1 style={{
                    fontSize: '17px',
                    fontWeight: '800',
                    color: '#1C1917',
                    margin: '0 0 4px 0',
                    letterSpacing: '-1px',
                    lineHeight: '1.1'
                }}>
                    {personal_info.name || 'Candidate Name'}
                </h1>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: '#78716C', fontWeight: 600 }}>
                    {personal_info.email && (
                        <span>{personal_info.email}</span>
                    )}
                    {personal_info.phone && (
                        <>
                            <span style={{ color: '#E7E5E4' }}>•</span>
                            <span>{personal_info.phone}</span>
                        </>
                    )}
                    {personal_info.links && personal_info.links.filter(Boolean).map((link, idx) => {
                        const cleanLink = link.replace(/^https?:\/\/(www\.)?/, '');
                        return (
                        <React.Fragment key={idx}>
                            <span style={{ color: '#E7E5E4' }}>•</span>
                            <a
                                href={link.startsWith('http') ? link : `https://${link}`}
                                style={{ color: '#1C1917', textDecoration: 'none', borderBottom: '1px solid var(--yellow)' }}
                            >
                                {cleanLink}
                            </a>
                        </React.Fragment>
                    )})}
                </div>
            </header>

            {/* ── Professional Summary ── */}
            {summary && (
                <section style={SECTION_STYLE}>
                    <p style={{ margin: 0, color: '#3f3d3a', lineHeight: '1.6', fontSize: '13.5px' }}>
                        {renderInlineMarkdown(summary)}
                    </p>
                </section>
            )}

            {/* ── Skills ── */}
            {skills && skills.length > 0 && (
                <section style={{...SECTION_STYLE, marginTop: '28px'}}>
                    <h2 style={SECTION_HEADING}>Skills</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {skills.map((skill, i) => (
                            <span key={i} style={{
                                backgroundColor: '#F5F5F4', // bg-surface
                                color: '#78716C',
                                padding: '3px 10px',
                                borderRadius: '99px',
                                fontSize: '11.5px',
                                fontWeight: '600',
                                border: '1px solid #E7E5E4'
                            }}>
                                {skill}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Professional Experience ── */}
            {experience && experience.length > 0 && (
                <section style={SECTION_STYLE}>
                    <h2 style={SECTION_HEADING}>Experience</h2>
                    {experience.map((exp, idx) => (
                        <div key={idx} style={{ marginBottom: '18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: '#1C1917' }}>
                                    {exp.title} <span style={{ fontWeight: 400, color: '#78716C' }}>at {exp.company}</span>
                                </h3>
                                <span style={{ fontSize: '12px', color: '#A8A29E', whiteSpace: 'nowrap', marginLeft: '12px', fontWeight: 600 }}>{exp.date}</span>
                            </div>
                            <ul style={{ margin: 0, paddingLeft: '18px', color: '#3f3d3a', lineHeight: '1.6' }}>
                                {exp.description && exp.description.map((desc, dIdx) => (
                                    <li key={dIdx} style={{ marginBottom: '6px' }}>
                                        {renderInlineMarkdown(desc)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </section>
            )}

            {/* ── Projects ── */}
            {projects && projects.length > 0 && (
                <section style={SECTION_STYLE}>
                    <h2 style={SECTION_HEADING}>Projects</h2>
                    {projects.map((proj, idx) => (
                        <div key={idx} style={{ marginBottom: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: '#1C1917' }}>
                                    {proj.name}
                                </h3>
                                {proj.date && <span style={{ fontSize: '12px', color: '#A8A29E', fontWeight: 600 }}>{proj.date}</span>}
                            </div>
                            <p style={{ fontSize: '13px', margin: '0 0 0 0', color: '#3f3d3a', lineHeight: '1.6' }}>
                                {renderInlineMarkdown(proj.description)}
                            </p>
                        </div>
                    ))}
                </section>
            )}

            {/* ── Education ── */}
            {education && education.length > 0 && (
                <section style={SECTION_STYLE}>
                    <h2 style={SECTION_HEADING}>Education</h2>
                    {education.map((edu, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: '#1C1917' }}>
                                    {edu.degree}
                                </h3>
                                <div style={{ fontSize: '13px', color: '#78716C', marginTop: '2px' }}>{edu.institution}</div>
                            </div>
                            <span style={{ fontSize: '12px', color: '#A8A29E', whiteSpace: 'nowrap', marginLeft: '12px', fontWeight: 600 }}>{edu.date}</span>
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
});

ResumeTemplate.displayName = 'ResumeTemplate';
export default ResumeTemplate;
