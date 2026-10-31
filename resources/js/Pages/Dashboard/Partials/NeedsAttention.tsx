import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import Initials from '@/Components/surface/Initials';
import Segmented from '@/Components/surface/Segmented';
import type { AttentionItem, RiskLevel as Level } from '../types';
import { dueText } from './due';
import RiskLevel from './RiskLevel';

type AttentionFilter = 'all' | Level;

interface NeedsAttentionProps {
    items: AttentionItem[];
    /** Every overdue / at-risk task, not just the ones in the list. */
    counts: { overdue: number; at_risk: number };
    /** When the figures were taken (ISO). */
    now: string;
    /** The team's list: who each task is assigned to, and the open work split by risk above it. */
    team?: { open: number } | null;
    /** Rows shown before "Show N more". */
    limit?: number;
    /** "At risk means due within 24 h, or 75% of its time used." */
    riskRule: string;
    /** Under the list, on the left: "1 due today · 4 open in all". */
    note?: ReactNode;
    /** Under the list, on the right: the task list. */
    listLink?: { href: string; label: string } | null;
    className?: string;
}

/** Overdue first, then at risk; soonest due first. The rep's own list, or the team's. */
export default function NeedsAttention({
    items,
    counts,
    now,
    team = null,
    limit,
    riskRule,
    note,
    listLink,
    className,
}: NeedsAttentionProps) {
    const [filter, setFilter] = useState<AttentionFilter>('all');
    const [expanded, setExpanded] = useState(false);
    const total = counts.overdue + counts.at_risk;
    const shown = filter === 'all' ? items : items.filter((item) => item.level === filter);
    const hidden = limit && !expanded ? Math.max(0, shown.length - limit) : 0;
    const rows = hidden > 0 ? shown.slice(0, limit) : shown;

    const levels = team
        ? [
              { key: 'overdue', count: counts.overdue, label: 'overdue', color: 'var(--rd-critical)' },
              { key: 'at_risk', count: counts.at_risk, label: 'at risk', color: 'var(--rd-at-risk)' },
              { key: 'on_track', count: Math.max(0, team.open - total), label: 'on track', color: 'var(--rd-control)' },
          ]
        : [];

    return (
        <section
            className={clsx('rd-panel dash-attention', !team && 'dash-attention--mine', className)}
            aria-labelledby="attention-title"
        >
            <div className="rd-panel__head">
                <div>
                    <h2 id="attention-title" className="rd-panel__title">
                        Needs attention
                    </h2>
                    <p className="rd-panel__sub">
                        {team
                            ? 'Across the team, overdue first.'
                            : 'Overdue first, then the tasks closest to their due time.'}{' '}
                        {riskRule}
                    </p>
                </div>
                {total > 0 && (
                    <Segmented
                        label="Show"
                        value={filter}
                        onChange={setFilter}
                        options={[
                            { value: 'all', label: `All ${total}` },
                            { value: 'overdue', label: `Overdue ${counts.overdue}` },
                            { value: 'at_risk', label: `At risk ${counts.at_risk}` },
                        ]}
                    />
                )}
            </div>

            {team && team.open > 0 && (
                <div className="dash-attention__summary">
                    <span className="rd-stack" aria-hidden="true">
                        {levels
                            .filter((level) => level.count > 0)
                            .map((level) => (
                                <span key={level.key} style={{ flexGrow: level.count, background: level.color }} />
                            ))}
                    </span>
                    <span className="rd-legend">
                        <strong>{team.open} open</strong>
                        {levels.map((level) => (
                            <span key={level.key}>
                                <span className="rd-swatch" style={{ background: level.color }} />
                                {level.count} {level.label}
                            </span>
                        ))}
                    </span>
                </div>
            )}

            {rows.length === 0 ? (
                <p className="rd-empty">
                    <i className="mdi mdi-check-circle-outline" aria-hidden="true" />
                    {total === 0 ? 'Nothing is overdue or at risk.' : 'No tasks in this group.'}
                </p>
            ) : (
                <div>
                    <div className="dash-attention__row dash-attention__row--head" aria-hidden="true">
                        <span>Level</span>
                        <span>Task and outlet</span>
                        {team && <span>Assigned to</span>}
                        <span style={{ textAlign: 'right' }}>Due</span>
                    </div>
                    <ul className="list-unstyled mb-0">
                        {rows.map((item) => {
                            const due = dueText(item, now);

                            return (
                                <li key={item.id} className="dash-attention__row">
                                    <span className="dash-attention__level">
                                        <RiskLevel level={item.level} />
                                    </span>
                                    <div className="dash-attention__task">
                                        <Link href={route('tasks.view', item.id)}>{item.title}</Link>
                                        <span className="dash-attention__meta">
                                            <span className="rd-mono">{item.reference}</span>
                                            {item.lead && <> &middot; {item.lead}</>}
                                        </span>
                                    </div>
                                    {team && (
                                        <span className="dash-attention__owner">
                                            {item.subscriber ? (
                                                <>
                                                    <Initials name={item.subscriber} size="sm" />
                                                    {item.subscriber}
                                                </>
                                            ) : (
                                                <span className="rd-muted">Not assigned</span>
                                            )}
                                        </span>
                                    )}
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

            {(hidden > 0 || expanded || note || listLink || items.length < total) && (
                <div className="dash-attention__foot">
                    <span className="dash-attention__note">
                        {hidden > 0 && (
                            <button type="button" className="dash-attention__more" onClick={() => setExpanded(true)}>
                                Show {hidden} more
                            </button>
                        )}
                        {expanded && limit && shown.length > limit && (
                            <button type="button" className="dash-attention__more" onClick={() => setExpanded(false)}>
                                Show fewer
                            </button>
                        )}
                        {items.length < total && <span>The {items.length} most urgent are listed.</span>}
                        {note}
                    </span>
                    {listLink && (
                        <Link href={listLink.href} className="rd-more">
                            {listLink.label}
                            <i className="mdi mdi-arrow-right" aria-hidden="true" />
                        </Link>
                    )}
                </div>
            )}
        </section>
    );
}
