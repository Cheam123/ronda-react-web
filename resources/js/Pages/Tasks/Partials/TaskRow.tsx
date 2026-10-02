import { Link, router } from '@inertiajs/react';
import clsx from 'clsx';
import Dropdown from 'react-bootstrap/Dropdown';
import Initials from '@/Components/surface/Initials';
import { useAuth } from '@/hooks/useAuth';
import { confirm } from '@/lib/dialogs';
import { plainText, pluralize } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import type { AgingTone, TaskFilters, TaskListItem } from '@/types/tasks';

/** The Last contact chip for each aging tone (TaskListItemResource::aging). */
export const AGING_CHIP: Record<AgingTone, string> = {
    good: 'rd-chip rd-chip--good',
    warn: 'rd-chip rd-chip--serious',
    danger: 'rd-chip rd-chip--critical',
};

interface TaskRowProps {
    task: TaskListItem;
    /** The list's query string, carried to the view and edit pages. */
    filters: TaskFilters;
    /** Its activity panel is open. */
    open: boolean;
    onActivity: () => void;
    onAppointments: () => void;
}

/** One task in the list. */
export default function TaskRow({ task, filters, open, onActivity, onAppointments }: TaskRowProps) {
    const { can } = useAuth();
    const latest = task.activities[0];
    const count = task.activities.length;
    const linkParams = { ...filters, id: task.id };
    const outlet = task.lead.business_name || task.lead.name || 'Unnamed outlet';
    const subscribers = task.sub_subscribers.length;

    // A follow-up can be only files (a photo, the IFE report's pictures).
    const preview = latest
        ? plainText(latest.message) ||
          (latest.attachments.length + latest.report_photos.length > 0 ? 'Attached files' : '')
        : '';

    const deleteTask = async () => {
        if (await confirm({ title: 'Delete this task?', text: task.title, confirmText: 'Delete', danger: true })) {
            router.post(route('tasks.delete'), { id: task.id }, { preserveScroll: true });
        }
    };

    const reactivate = async () => {
        if (await confirm({ title: 'Reactivate this task?', text: task.title, confirmText: 'Reactivate' })) {
            router.post(route('tasks.reactivate'), { id: task.id }, { preserveScroll: true });
        }
    };

    return (
        <tr className={clsx(open && 'is-selected')}>
            <td className="task-table__task">
                <Link href={route('tasks.view', linkParams)} className="task-table__title">
                    {task.title}
                </Link>
                <span className="task-table__ref">
                    <span className="rd-mono">{task.reference}</span>
                    {task.flagged && (
                        <span className="rd-status rd-status--critical">
                            <i className="mdi mdi-flag-outline" aria-hidden="true" />
                            Flagged
                        </span>
                    )}
                </span>
            </td>

            <td className="task-table__outlet">
                {can('view_lead') && task.lead.id ? (
                    <Link href={route('lead.view', task.lead.id)} className="task-table__name">
                        {outlet}
                    </Link>
                ) : (
                    <span className="task-table__name">{outlet}</span>
                )}
                <span className="task-table__sub rd-num">{task.lead.mobile ? formatPhone(task.lead.mobile) : '—'}</span>
            </td>

            <td className="task-table__contact">
                <span className="task-table__aging">
                    <span className={AGING_CHIP[task.aging.tone]}>
                        <span className="rd-dot" />
                        {task.aging.label}
                    </span>
                    {count > 0 && <span className="rd-muted">{pluralize(count, 'follow-up')}</span>}
                </span>
                {latest ? (
                    <button type="button" className="task-table__preview" onClick={onActivity}>
                        <strong>{latest.author}:</strong> {preview}
                    </button>
                ) : (
                    <button type="button" className="task-table__first" onClick={onActivity}>
                        Log the first follow-up
                    </button>
                )}
            </td>

            <td className={clsx('task-table__due', !task.due && 'is-empty')}>
                {task.due ? (
                    <span className={clsx('task-due', task.due.overdue && 'is-overdue')}>
                        {/* Phones show rows as cards, without the column headings. */}
                        <span className="task-due__label">Due</span>
                        <span className="task-due__date">{task.due.date}</span>
                        {(task.due.overdue || task.due.time) && (
                            <span className="task-due__time">
                                {task.due.overdue
                                    ? ['Overdue', task.due.time].filter(Boolean).join(' · ')
                                    : task.due.time}
                            </span>
                        )}
                    </span>
                ) : (
                    <span className="rd-muted" aria-label="No due date">
                        —
                    </span>
                )}
            </td>

            <td className="task-table__people">
                {task.subscriber ? (
                    <button type="button" className="task-sub" title="Open appointments" onClick={onAppointments}>
                        <Initials name={task.subscriber.name} colorKey={task.subscriber.id} size="sm" />
                        <span className="task-sub__text">
                            <span className="task-sub__name">
                                {task.subscriber.name}
                                {subscribers > 0 && (
                                    <span
                                        className="rd-count"
                                        title={`Sub-subscribers: ${task.sub_subscribers.join(', ')}`}
                                    >
                                        +{subscribers}
                                    </span>
                                )}
                            </span>
                            <span className="task-sub__appts">
                                {task.subscriber.appointments.length > 0
                                    ? pluralize(task.subscriber.appointments.length, 'open appointment')
                                    : 'No open appointments'}
                            </span>
                        </span>
                    </button>
                ) : (
                    <span className="rd-muted">—</span>
                )}
            </td>

            <td className="rd-col-actions task-table__actions">
                <div className="rd-actions">
                    <button
                        type="button"
                        className="rd-btn rd-btn--icon task-table__activity"
                        aria-label={`Activity on ${task.title}`}
                        title="Activity"
                        onClick={onActivity}
                    >
                        <i className="mdi mdi-message-text-outline" aria-hidden="true" />
                    </button>
                    {task.can.edit && (
                        <Link
                            href={route('tasks.edit', linkParams)}
                            className="rd-btn rd-btn--icon"
                            aria-label={`Edit ${task.title}`}
                            title="Edit"
                        >
                            <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                        </Link>
                    )}
                    <Dropdown align="end">
                        <Dropdown.Toggle
                            as="button"
                            type="button"
                            bsPrefix="rd-btn rd-btn--icon"
                            aria-label={`More for ${task.title}`}
                            title="More"
                        >
                            <i className="mdi mdi-dots-horizontal" aria-hidden="true" />
                        </Dropdown.Toggle>
                        <Dropdown.Menu className="rd-menu rd-menu--fixed" popperConfig={{ strategy: 'fixed' }}>
                            <Link href={route('tasks.view', linkParams)} className="dropdown-item">
                                <i className="mdi mdi-eye-outline" aria-hidden="true" />
                                View task
                            </Link>
                            <a
                                download
                                href={route('tasks.export_single_task', { id: task.id })}
                                className="dropdown-item"
                            >
                                <i className="mdi mdi-download" aria-hidden="true" />
                                Export to Excel
                            </a>
                            {/* A Keep-In-View task comes back through its edit page; an On Hold one in place. */}
                            {task.can.recycle && (
                                <Link href={route('tasks.edit', linkParams)} className="dropdown-item">
                                    <i className="mdi mdi-recycle-variant" aria-hidden="true" />
                                    Reactivate
                                </Link>
                            )}
                            {task.can.reactivate && (
                                <Dropdown.Item as="button" type="button" onClick={reactivate}>
                                    <i className="mdi mdi-recycle-variant" aria-hidden="true" />
                                    Reactivate
                                </Dropdown.Item>
                            )}
                            {task.can.delete && (
                                <>
                                    <Dropdown.Divider />
                                    <Dropdown.Item as="button" type="button" className="is-danger" onClick={deleteTask}>
                                        <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
                                        Delete task
                                    </Dropdown.Item>
                                </>
                            )}
                        </Dropdown.Menu>
                    </Dropdown>
                </div>
            </td>
        </tr>
    );
}
