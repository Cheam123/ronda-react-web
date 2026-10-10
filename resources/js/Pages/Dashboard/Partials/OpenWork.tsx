import { Link } from '@inertiajs/react';
import { useAuth } from '@/hooks/useAuth';
import type { DashboardSummary } from '../types';

interface OpenWorkProps {
    tasks: DashboardSummary['tasks'];
    /** Forms from the last 7 days still waiting for a decision. */
    formsPending: number;
}

/** The team's open tasks split by risk, beside today's other counts. */
export default function OpenWork({ tasks, formsPending }: OpenWorkProps) {
    const { can } = useAuth();
    const reviewHref = can('form_admin') ? route('form.records.all', { status: 'pending' }) : route('form.tasks');

    const levels = [
        { key: 'overdue', count: tasks.overdue, label: 'overdue', color: 'var(--rd-critical)' },
        { key: 'at_risk', count: tasks.at_risk, label: 'at risk', color: 'var(--rd-warning)' },
        {
            key: 'on_track',
            count: Math.max(0, tasks.open - tasks.overdue - tasks.at_risk),
            label: 'on track',
            color: 'var(--rd-brand-soft)',
        },
    ];

    return (
        <section className="dash-strip" aria-label="Open work">
            <div className="dash-strip__cell dash-strip__cell--wide">
                <p className="dash-strip__lead">
                    <span className="dash-strip__value">{tasks.open}</span>
                    open {tasks.open === 1 ? 'task' : 'tasks'} across the team
                </p>
                {tasks.open > 0 && (
                    <span className="rd-stack dash-strip__bar" aria-hidden="true">
                        {levels
                            .filter((level) => level.count > 0)
                            .map((level) => (
                                <span key={level.key} style={{ flexGrow: level.count, background: level.color }} />
                            ))}
                    </span>
                )}
                <div className="rd-legend dash-strip__legend">
                    {levels.map((level) => (
                        <span key={level.key}>
                            <span className="rd-swatch" style={{ background: level.color }} />
                            <strong>{level.count}</strong> {level.label}
                        </span>
                    ))}
                </div>
            </div>

            <div className="dash-strip__cell">
                <span className="dash-strip__label">Due today</span>
                <span className="dash-strip__figure">{tasks.due_today}</span>
                <span className="dash-strip__note">Open tasks due before midnight</span>
            </div>

            <div className="dash-strip__cell">
                <span className="dash-strip__label">Done, last 7 days</span>
                <span className="dash-strip__figure">{tasks.done_7d}</span>
                <span className="dash-strip__note">{tasks.created_7d} created in the same days</span>
            </div>

            <Link href={reviewHref} className="dash-strip__cell dash-strip__cell--link">
                <span className="dash-strip__label">
                    Forms to review
                    <i className="mdi mdi-chevron-right" aria-hidden="true" />
                </span>
                <span className="dash-strip__figure">{formsPending}</span>
                <span className="dash-strip__note">Sent in the last 7 days</span>
            </Link>
        </section>
    );
}
