import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { DashboardSummary } from '../types';

interface RowProps {
    label: string;
    note: string;
    value: number;
    /** Where the count is listed; a plain row when there is nowhere to go. */
    href: string | null;
}

function Row({ label, note, value, href }: RowProps) {
    const body: ReactNode = (
        <>
            <span className="dash-today__text">
                <span className="dash-today__label">{label}</span>
                <span className="dash-today__note">{note}</span>
            </span>
            <span className="dash-today__value">{value}</span>
            {href && <i className="mdi mdi-chevron-right dash-today__go" aria-hidden="true" />}
        </>
    );

    return (
        <li>
            {href ? (
                <Link href={href} className="dash-today__row dash-today__row--link">
                    {body}
                </Link>
            ) : (
                <div className="dash-today__row">{body}</div>
            )}
        </li>
    );
}

interface TodayPanelProps {
    tasks: DashboardSummary['tasks'];
    /** Forms from the last 7 days still waiting for a decision. */
    formsPending: number;
    className?: string;
}

/** Beside the team's Needs attention list: what else is due, waiting or done. */
export default function TodayPanel({ tasks, formsPending, className }: TodayPanelProps) {
    const { can } = useAuth();
    const reviewHref = can('form_admin') ? route('form.records.all', { status: 'pending' }) : route('form.tasks');

    return (
        <section className={clsx('rd-panel dash-today', className)} aria-labelledby="today-title">
            <h2 id="today-title" className="rd-panel__title">
                Today and this week
            </h2>
            <ul className="list-unstyled mb-0">
                <Row
                    label="Due today"
                    note="Open tasks due before midnight"
                    value={tasks.due_today}
                    href={can('manage_task') ? route('tasks.index2', { status: 'open', due: 'today' }) : null}
                />
                <Row
                    label="Forms to review"
                    note="Sent in the last 7 days, waiting for a decision"
                    value={formsPending}
                    href={reviewHref}
                />
                <Row
                    label="Done in the last 7 days"
                    note={`Of ${tasks.created_7d} created in the same days`}
                    value={tasks.done_7d}
                    href={null}
                />
            </ul>
        </section>
    );
}
