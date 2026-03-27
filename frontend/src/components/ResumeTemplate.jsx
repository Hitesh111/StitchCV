import React from 'react';

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
            parts.push(
                <strong key={match.index} style={{ fontWeight: 700 }}>
                    {match[1]}
                </strong>
            );
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

const rootStyle = {
    width: '8.5in',
    minHeight: '11in',
    padding: '0.48in 0.58in',
    background: '#FFFFFF',
    color: '#000000',
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    fontSize: '11px',
    lineHeight: 1.32,
    boxSizing: 'border-box',
};

const sectionHeadingStyle = {
    fontSize: '11.5px',
    fontWeight: 700,
    margin: '0 0 8px 0',
    paddingBottom: '4px',
    borderBottom: '1px solid #CFCFCF',
    letterSpacing: '0.01em',
    color: '#000000',
};

const sectionStyle = {
    marginBottom: '12px',
    breakInside: 'avoid',
    pageBreakInside: 'avoid',
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

    const contactItems = [
        personal_info.email,
        personal_info.phone,
        personal_info.location,
        ...(personal_info.links || []),
    ].filter(Boolean);

    return (
        <table ref={ref} style={{ ...rootStyle, borderCollapse: 'collapse', borderSpacing: 0, padding: 0 }}>
            <thead style={{ height: '0.48in' }}>
                <tr><td><div style={{ height: '0.48in' }}></div></td></tr>
            </thead>
            <tfoot style={{ height: '0.58in' }}>
                <tr><td><div style={{ height: '0.58in' }}></div></td></tr>
            </tfoot>
            <tbody>
                <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <td style={{ padding: '0 0.58in' }}>
                        <header style={{ marginBottom: '12px' }}>
                            <h1 style={{ margin: 0, fontSize: '23px', fontWeight: 700, letterSpacing: '0.01em', color: '#000000' }}>
                                {personal_info.name || 'Candidate Name'}
                            </h1>
                            {contactItems.length > 0 && (
                                <div style={{ marginTop: '4px', fontSize: '10.5px', color: '#000000', borderBottom: '1px solid #BFBFBF', paddingBottom: '7px' }}>
                                    {contactItems.map((item, index) => (
                                        <React.Fragment key={`${item}-${index}`}>
                                            {index > 0 && <span>{' • '}</span>}
                                            <span>{String(item).replace(/^https?:\/\/(www\.)?/, '')}</span>
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </header>
                    </td>
                </tr>

                {summary && (
                    <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        <td style={{ padding: '0 0.58in' }}>
                            <section style={sectionStyle}>
                                <h2 style={sectionHeadingStyle}>SUMMARY</h2>
                                <p style={{ margin: 0, textAlign: 'left' }}>{renderInlineMarkdown(summary)}</p>
                            </section>
                        </td>
                    </tr>
                )}

                {skills.length > 0 && (
                    <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        <td style={{ padding: '0 0.58in' }}>
                            <section style={sectionStyle}>
                                <h2 style={sectionHeadingStyle}>SKILLS</h2>
                                <p style={{ margin: 0 }}>
                                    {skills.map((skill, index) => (
                                        <React.Fragment key={`${skill}-${index}`}>
                                            {index > 0 && <span>{' • '}</span>}
                                            <span>{skill}</span>
                                        </React.Fragment>
                                    ))}
                                </p>
                            </section>
                        </td>
                    </tr>
                )}

                {experience.length > 0 && (
                    <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                         <td style={{ padding: '0 0.58in' }}>
                             <h2 style={sectionHeadingStyle}>EXPERIENCE</h2>
                         </td>
                    </tr>
                )}
                {experience.map((exp, idx) => (
                    <tr key={`${exp.company}-${exp.title}-${idx}`} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        <td style={{ padding: '0 0.58in' }}>
                            <div style={{ marginBottom: idx === experience.length - 1 ? '12px' : '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                                    <div style={{ fontSize: '12px', minWidth: 0 }}>
                                        <span style={{ fontStyle: 'italic' }}>{exp.company}</span>
                                        {exp.company && exp.title && <span>{', '}</span>}
                                        <span style={{ fontWeight: 700 }}>{exp.title}</span>
                                    </div>
                                    {exp.date && <div style={{ fontSize: '10.5px', whiteSpace: 'nowrap' }}>{exp.date}</div>}
                                </div>
                                {exp.location && <div style={{ fontSize: '10.5px', color: '#000000', marginTop: '1px' }}>{exp.location}</div>}
                                {Array.isArray(exp.description) && exp.description.length > 0 && (
                                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                        {exp.description.map((desc, dIdx) => (
                                            <li key={dIdx} style={{ marginBottom: '2px' }}>{renderInlineMarkdown(desc)}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </td>
                    </tr>
                ))}

                {projects.length > 0 && (
                    <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                         <td style={{ padding: '0 0.58in' }}>
                             <h2 style={sectionHeadingStyle}>PROJECTS</h2>
                         </td>
                    </tr>
                )}
                {projects.map((proj, idx) => (
                    <tr key={`${proj.name}-${idx}`} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        <td style={{ padding: '0 0.58in' }}>
                            <div style={{ marginBottom: idx === projects.length - 1 ? '12px' : '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '12px' }}>{proj.name}</div>
                                    {proj.date && <div style={{ fontSize: '10.5px', whiteSpace: 'nowrap' }}>{proj.date}</div>}
                                </div>
                                {proj.description && <p style={{ margin: '2px 0 0 0' }}>{renderInlineMarkdown(proj.description)}</p>}
                            </div>
                        </td>
                    </tr>
                ))}

                {education.length > 0 && (
                    <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                         <td style={{ padding: '0 0.58in' }}>
                             <h2 style={sectionHeadingStyle}>EDUCATION</h2>
                         </td>
                    </tr>
                )}
                {education.map((edu, idx) => (
                    <tr key={`${edu.institution}-${edu.degree}-${idx}`} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        <td style={{ padding: '0 0.58in' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: idx === education.length - 1 ? '12px' : '6px' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '12px' }}>{edu.institution}</div>
                                    <div>{edu.degree}</div>
                                </div>
                                {edu.date && <div style={{ fontSize: '10.5px', whiteSpace: 'nowrap' }}>{edu.date}</div>}
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
});

ResumeTemplate.displayName = 'ResumeTemplate';

export default ResumeTemplate;
