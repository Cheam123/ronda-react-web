import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import Initials from '@/Components/surface/Initials';
import Segmented from '@/Components/surface/Segmented';
import type { AttentionItem, RiskLevel as Level } from '../types';
import RiskLevel from './RiskLevel';

export type AttentionFilter = 'all' | Level;

/** "45 min", "5 h", "3 days" */
function span(hours: number): string {
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
    if (hours < 48) return `${Math.round(hours)} h`;
    return `${Math.round(hours / 24)} days`;
}

/** How far past or ahead of its due time a task is, relative to when the figures were taken. */
function dueText(item: AttentionItem, now: string): { main: string; sub: string | null } {
    if (!item.due_at) {
        return { main: item.reason ?? '', sub: null };
    }

    const hours = (Date.parse(item.due_at) - Date.parse(now)) / 3_600_000;
    if (hours < 0) {
        return { main: `${span(-hours)} overdue`, sub: item.due_label };
    }

    // At risk because most of its time is used up: say so rather than repeat the date.
    const byElapsed = item.reason && item.reason.includes('%') ? item.reason : null;

    return { main: `In ${span(hours)}`, sub: byElapsed ?? item.due_label };
}

interface NeedsAttentionProps {
    id: string;
    items: AttentionItem[];
    /** Every overdue / at-risk task, not just the ones in the list. */
    counts: { overdue: number; at_risk: number };
    /** When the figures were taken (ISO). */
    now: string;
    filter: AttentionFilter;
    onFilterChange: (filter: AttentionFilter) => void;
    className?: string;
}

/** Overdue first, then at risk; soonest due first. */
export default function NeedsAttention({
    id,
    items,
    counts,
    now,
    filter,
    onFilterChange,
    className,
}: NeedsAttentionProps) {
    const total = counts.overdue + counts.at_risk;
    const shown = filter === 'all' ? items : items.filter((item) => item.level === filter);

    return (
        <section id={id} className={clsx('rd-panel', className)} aria-labelledby={`${id}-title`} tabIndex={-1}>
            <div className="rd-panel__head">
                <div>
                    <h2 id={`${id}-title`} className="rd-panel__title">
                        Needs attention
                    </h2>
                    <p className="rd-panel__sub">Overdue first, then the tasks closest to their due time</p>
                </div>
                {total > 0 && (
                    <Segmented
                        label="Show"
                        value={filter}
                        onChange={onFilterChange}
                        options={[
                            { value: 'all', label: `All ${total}` },
                            { value: 'overdue', label: `Overdue ${counts.overdue}` },
                            { value: 'at_risk', label: `At risk ${counts.at_risk}` },
                        ]}
                    />
                )}
            </div>

            {shown.length === 0 ? (
                <p className="rd-empty">
                    <i className="mdi mdi-check-circle-outline" aria-hidden="true" />
                    {total === 0 ? 'Nothing is overdue or at risk.' : 'No tasks in this group.'}
                </p>
            ) : (
                <div className="dash-attention">
                    <div className="dash-attention__row dash-attention__row--head" aria-hidden="true">
                        <span>Level</span>
                        <span>Task and outlet</span>
                        <span>Subscriber</span>
                        <span style={{ textAlign: 'right' }}>Due</span>
                    </div>
                    <ul className="list-unstyled mb-0">
                        {shown.map((item) => {
                            const due = dueText(item, now);

                            return (
                                <li key={item.id} className="dash-attention__row">
                                    <span>
                                        <RiskLevel level={item.level} />
                                    </span>
                                    <div className="dash-attention__task">
                                        <Link href={route('tasks.view', item.id)}>{item.title}</Link>
                                        <span className="dash-attention__meta">
                                            <span className="rd-mono">{item.reference}</span>
                                            {item.lead && <> &middot; {item.lead}</>}
                                        </span>
                                    </div>
                                    <span className="dash-attention__owner">
                                        {item.subscriber ? (
                                            <>
                                                <Initials name={item.subscriber} size="sm" />
                                                {item.subscriber}
                                            </>
                                        ) : (
                                            <span className="rd-muted">No subscriber</span>
                                        )}
                                    </span>
                                    <span className={clsx('dash-attention__due', `dash-attention__due--${item.level}`)}>
                                        {due.main}
                                        {due.sub && <small>{due.sub}</small>}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {items.length < total && (
                <p className="rd-panel__sub">
                    Showing the {items.length} most urgent of {total}.{' '}
                    <Link href={route('tasks.index2', { status: 1 })}>All open tasks</Link>
                </p>
            )}
        </section>
    );
}
