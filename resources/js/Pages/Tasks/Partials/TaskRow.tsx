import { Link, router } from '@inertiajs/react';
import clsx from 'clsx';
import { confirm } from '@/lib/dialogs';
import { plainText, pluralize, truncate } from '@/lib/format';
import type { TaskFilters, TaskListItem } from '@/types/tasks';

interface TaskRowProps {
    task: TaskListItem;
    number: number;
    /** The list's query string, carried to the view and edit pages. */
    filters: TaskFilters;
    onDetails: () => void;
    onActivity: () => void;
    onAppointments: () => void;
}

/** One task in the triage list. */
export default function TaskRow({ task, number, filters, onDetails, onActivity, onAppointments }: TaskRowProps) {
    const latest = task.activities[0];
    const preview = latest ? truncate(plainText(latest.message), 80) : '';
    const count = task.activities.length;
    const linkParams = { ...filters, id: task.id };

    const deleteTask = async () => {
        if (await confirm({ title: 'Please confirm to proceed on the deletion!', danger: true })) {
            router.post(route('tasks.delete'), { id: task.id });
        }
    };

    const reactivate = async () => {
        if (await confirm({ title: 'Please confirm to reactivate this task!' })) {
            router.post(route('tasks.reactivate'), { id: task.id });
        }
    };

    return (
        <tr className={clsx(task.flagged && 'is-flagged')}>
            <td className={clsx('triage-strip', task.aging.tone !== 'good' && task.aging.tone)} />
            <td className="triage-num">{String(number).padStart(2, '0')}</td>

            <td>
                <div className="lead-name">
                    <span>{task.lead.name}</span>
                    {task.flagged && (
                        <span className="alert-flag" title="Flagged for attention">
                            ⚠
                        </span>
                    )}
                </div>
                <div className="lead-mobile">{task.lead.mobile}</div>
                <button type="button" className="lead-link" onClick={onDetails}>
                    <i className="mdi mdi-information-outline" /> Lead details
                </button>
            </td>

            <td>
                <div className="task-title">{task.title}</div>
                {task.due ? (
                    <div className="due-row">
                        <span className="due-label">Due</span>
                        <span className="pill-due">{task.due}</span>
                    </div>
                ) : (
                    <div className="no-date">No due date</div>
                )}
                <button type="button" className="task-link" onClick={onDetails}>
                    <i className="mdi mdi-information-outline" /> Task details
                </button>
            </td>

            <td>
                <div className="aging-row">
                    <span className={clsx('aging-badge', task.aging.tone)}>{task.aging.label}</span>
                    {count > 0 && <span className="aging-count">{pluralize(count, 'activity', 'activities')}</span>}
                </div>
                {latest ? (
                    <button type="button" className="activity-preview" onClick={onActivity}>
                        <span className="activity-bullet note">
                            <i className="mdi mdi-comment-text-outline" />
                        </span>
                        <span className="activity-preview__body">
                            <span className="activity-text">
                                <span className="label">{latest.author}</span>
                                {preview && ` — ${preview}`}
                            </span>
                            <span className="activity-meta">{latest.created_at}</span>
                        </span>
                    </button>
                ) : (
                    <div className="activity-empty">No follow-up yet — log first activity</div>
                )}
            </td>

            <td>
                {task.subscriber && (
                    <button
                        type="button"
                        className="subscriber-cell"
                        title="Open appointments"
                        onClick={onAppointments}
                    >
                        <span className="subscriber-avatar">{task.subscriber.initials}</span>
                        <span className="subscriber-cell__text">
                            <span className="subscriber-name">
                                {task.subscriber.name}
                                {task.subscriber.rate !== null && ` (${task.subscriber.rate})`}
                            </span>
                            {task.sub_subscribers.length > 0 && (
                                <span className="subscriber-sub">+{task.sub_subscribers.length} sub</span>
                            )}
                        </span>
                    </button>
                )}
            </td>

            <td className="actions-cell">
                <div className="actions-row">
                    {task.can.edit && (
                        <Link href={route('tasks.edit', linkParams)} className="qa-icon" title="Edit">
                            <i className="mdi mdi-square-edit-outline" />
                        </Link>
                    )}
                    <Link href={route('tasks.view', linkParams)} className="qa-icon" title="View">
                        <i className="mdi mdi-clipboard-outline" />
                    </Link>
                    {task.can.delete && (
                        <button type="button" className="qa-btn delete" title="Delete" onClick={deleteTask}>
                            <i className="mdi mdi-trash-can" />
                        </button>
                    )}
                    {task.can.recycle && (
                        <Link href={route('tasks.edit', linkParams)} className="qa-recycle" title="Reactivate">
                            <i className="mdi mdi-recycle-variant" />
                        </Link>
                    )}
                    {task.can.reactivate && (
                        <button type="button" className="qa-recycle" title="Reactivate" onClick={reactivate}>
                            <i className="mdi mdi-recycle-variant" />
                        </button>
                    )}
                    <a
                        download
                        href={route('tasks.export_single_task', { id: task.id })}
                        className="qa-excel"
                        title="Export Excel"
                    >
                        <i className="mdi mdi-download" /> Excel
                    </a>
                </div>
                <button type="button" className="open-activity" onClick={onActivity}>
                    Open Activity <span>→</span>
                </button>
            </td>
        </tr>
    );
}
