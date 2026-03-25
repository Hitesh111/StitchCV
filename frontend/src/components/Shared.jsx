import { Briefcase, FileText, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

// Shared Components for StichCV v2

export function NudgeBar({ text, buttonText, onClick }) {
    return (
        <div className="nudge-bar">
            <span className="nudge-text">{text}</span>
            <button className="nudge-btn" onClick={onClick}>
                {buttonText} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </button>
        </div>
    );
}

export function EmptyState({ icon: Icon, title, subtitle, actionText, onAction }) {
    return (
        <div className="empty-state">
            {Icon && <Icon strokeWidth={1.5} />}
            <h3>{title}</h3>
            <p>{subtitle}</p>
            {actionText && onAction && (
                <button className="btn btn-primary" onClick={onAction}>
                    {actionText}
                </button>
            )}
        </div>
    );
}

// Color constants for pipelines
export const ST_COLORS = {
    new: '#3b82f6', // blue
    analyzed: '#a78bfa', // purple
    matched: '#EAB308', // yellow!
    applied: '#16A34A', // green
    submitted: '#16A34A', // green
    draft: '#FBBF24', // amber
    pending_review: '#FBBF24', // amber
    failed: '#DC2626', // red
    rejected: '#DC2626', // red
    ignored: '#A8A29E', // gray
};

export function PipelineDot({ status }) {
    const color = ST_COLORS[status] || '#A8A29E';
    return (
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
    );
}

export function StatusIcon({ status, size = 16 }) {
    const s = { width: size, height: size };
    switch (status) {
        case 'new': return <Briefcase style={{ ...s, color: ST_COLORS.new }} />;
        case 'analyzed': return <TrendingUp style={{ ...s, color: ST_COLORS.analyzed }} />;
        case 'matched': return <CheckCircle style={{ ...s, color: ST_COLORS.matched }} />;
        case 'applied':
        case 'submitted': return <CheckCircle style={{ ...s, color: ST_COLORS.applied }} />;
        case 'pending_review':
        case 'draft': return <AlertCircle style={{ ...s, color: ST_COLORS.pending_review }} />;
        case 'failed':
        case 'rejected': return <AlertCircle style={{ ...s, color: ST_COLORS.failed }} />;
        default: return <FileText style={{ ...s, color: ST_COLORS.ignored }} />;
    }
}
