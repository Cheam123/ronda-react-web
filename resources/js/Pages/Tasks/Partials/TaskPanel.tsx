import { Link, router } from '@inertiajs/react';
import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import Offcanvas from 'react-bootstrap/Offcanvas';
import ActivityComposer from '@/Components/tasks/ActivityComposer';
import ActivityTimeline from '@/Components/tasks/ActivityTimeline';
import { useAuth } from '@/hooks/useAuth';
import { formatPhone, phoneHref } from '@/lib/phone';
import { taskStatusChip } from '@/lib/taskStatus';
import type { TaskFilters, TaskListItem } from '@/types/tasks';

type Tab = 'activity' | 'details';

interface TaskPanelProps {
    /** The task whose panel is open, or null when it is closed. */
    task: TaskListItem | null;
    /** The list's query string, carried to the task page. */
    filters: TaskFilters;
    onHide: () => void;
    onImageClick: (src: string) => void;
}

/** A task's follow-ups and details, opened beside the list. */
export default function TaskPanel({ task, filters, onHide, onImageClick }: TaskPanelProps) {
    const [tab, setTab] = useState<Tab>('activity');
    // Keep the last task on screen while the panel slides out.
    const [shown, setShown] = useState(task);
    const taskId = task?.id;

    useEffect(() => {
        if (task) {
            setShown(task);
        }
    }, [task]);

    // Each task opens on its activity.
    useEffect(() => {
        if (taskId) {
            setTab('activity');
        }
    }, [taskId]);

    // Only the list is reloaded; the panel stays open on the fresh row.
    const reload = () => router.reload({ only: ['tasks'] });

    const tabs: { key: Tab; label: string; count?: number }[] = [
        { key: 'activity', label: 'Activity', count: shown?.activities.length },
        { key: 'details', label: 'Details' },
    ];

    return (
        <Offcanvas
            show={task !== null}
            onHide={onHide}
            placement="end"
            className="rd-drawer"
            backdropClassName="rd-drawer-backdrop"
            aria-labelledby="task-panel-title"
        >
            {shown && (
                <>
                    <div className="rd-drawer__head">
                        <div className="rd-drawer__meta">
                            <span className={taskStatusChip(shown.status)}>
                                <span className="rd-dot" />
                                {shown.status_label}
                            </span>
                            <span className="rd-mono">{shown.reference}</span>
                            {shown.flagged && (
                                <span className="rd-status rd-status--critical">
                                    <i className="mdi mdi-flag-outline" aria-hidden="true" />
                                    Flagged
                                </span>
                            )}
                        </div>
                        <h2 id="task-panel-title" className="rd-drawer__title">
                            {shown.title}
                        </h2>
                        <p className="rd-drawer__lede">
                            {shown.lead.business_name || shown.lead.name || 'Unnamed outlet'}
                            {shown.lead.mobile && (
                                <>
                                    {' · '}
                                    <span className="rd-num">{formatPhone(shown.lead.mobile)}</span>
                                </>
                            )}
                        </p>
                        <button
                            type="button"
                            className="rd-btn rd-btn--icon rd-drawer__close"
                            aria-label="Close"
                            title="Close"
                            onClick={onHide}
                        >
                            <i className="mdi mdi-close" aria-hidden="true" />
                        </button>
                        <nav className="rd-tabs rd-drawer__tabs" aria-label="Task panel">
                            {tabs.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    className={clsx('rd-tabs__tab', tab === item.key && 'is-active')}
                                    aria-pressed={tab === item.key}
                                    onClick={() => setTab(item.key)}
                                >
                                    {item.label}
                                    {item.count !== undefined && <span className="rd-count">{item.count}</span>}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="rd-drawer__body">
                        {tab === 'activity' ? (
                            <>
                                <Upcoming task={shown} />
                                <ActivityComposer taskId={shown.id} onSaved={reload} />
                                <section className="task-panel__timeline" aria-labelledby="task-panel-timeline">
                                    <h3 id="task-panel-timeline" className="task-panel__label">
                                        Timeline
                                    </h3>
                                    <ActivityTimeline
                                        activities={shown.activities}
                                        onChanged={reload}
                                        onImageClick={onImageClick}
                                    />
                                </section>
                            </>
                        ) : (
                            <Details task={shown} />
                        )}
                    </div>

                    <div className="rd-drawer__foot">
                        <a
                            download
                            href={route('tasks.export_single_task', { id: shown.id })}
                            className="rd-btn rd-btn--quiet"
                        >
                            <i className="mdi mdi-download" aria-hidden="true" />
                            Export to Excel
                        </a>
                        <Link href={route('tasks.view', { ...filters, id: shown.id })} className="rd-btn">
                            Open task page
                            <i className="mdi mdi-arrow-right" aria-hidden="true" />
                        </Link>
                    </div>
                </>
            )}
        </Offcanvas>
    );
}

/** "3 Oct 2026, 10:00 am" -> ["3 Oct 2026", "10:00 am"]. */
function split(when: string | null): [string, string] | null {
    if (!when) return null;
    const [date, time = ''] = when.split(', ');

    return [date, time];
}

/** The appointment, the user's own reminder and the due date, side by side. */
function Upcoming({ task }: { task: TaskListItem }) {
    const due = task.due
        ? ([
              task.due.date,
              task.due.overdue ? ['Overdue', task.due.time].filter(Boolean).join(' · ') : (task.due.time ?? ''),
          ] as [string, string])
        : null;

    const cells: { label: string; when: [string, string] | null; overdue?: boolean }[] = [
        { label: 'Appointment', when: split(task.appointment) },
        { label: 'Your reminder', when: split(task.reminder) },
        { label: 'Due', when: due, overdue: task.due?.overdue },
    ];

    return (
        <dl className="task-panel__upcoming">
            {cells.map((cell) => (
                <div key={cell.label} className={clsx('task-panel__when', cell.overdue && 'is-overdue')}>
                    <dt>{cell.label}</dt>
                    {cell.when ? (
                        <dd>
                            <span className="task-panel__date">{cell.when[0]}</span>
                            {cell.when[1] && <span className="task-panel__time">{cell.when[1]}</span>}
                        </dd>
                    ) : (
                        <dd className="rd-muted">None set</dd>
                    )}
                </div>
            ))}
        </dl>
    );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <>
            <dt>{label}</dt>
            <dd>{children || <span className="rd-muted">—</span>}</dd>
        </>
    );
}

/** What the old "Lead & Task Details" dialog showed. */
function Details({ task }: { task: TaskListItem }) {
    const { can } = useAuth();
    const { lead } = task;
    const tel = phoneHref(lead.mobile);
    const outlet = lead.business_name || lead.name;

    return (
        <>
            <section className="task-panel__section" aria-labelledby="task-panel-outlet">
                <h3 id="task-panel-outlet" className="task-panel__label">
                    Outlet
                </h3>
                <dl className="rd-facts task-panel__facts">
                    <Fact label="Shop">
                        {outlet && can('view_lead') && lead.id ? (
                            <Link href={route('lead.view', lead.id)}>{outlet}</Link>
                        ) : (
                            outlet
                        )}
                    </Fact>
                    <Fact label="Company">{lead.business_name ? lead.name : null}</Fact>
                    <Fact label="Customer ID">
                        {lead.customer_id && <span className="rd-mono">{lead.customer_id}</span>}
                    </Fact>
                    <Fact label="IFE area">{lead.ife_area}</Fact>
                    <Fact label="Mobile">
                        {tel && (
                            <a href={tel} className="rd-num">
                                {formatPhone(lead.mobile)}
                            </a>
                        )}
                    </Fact>
                    <Fact label="Source">{lead.source}</Fact>
                    <Fact label="Sales">{task.sales}</Fact>
                </dl>
            </section>

            <section className="task-panel__section" aria-labelledby="task-panel-task">
                <h3 id="task-panel-task" className="task-panel__label">
                    Task
                </h3>
                <dl className="rd-facts task-panel__facts">
                    <Fact label="Reference">
                        <span className="rd-mono">{task.reference}</span>
                    </Fact>
                    <Fact label="Created">{task.created_at}</Fact>
                    <Fact label="Last updated">{task.last_updated}</Fact>
                    <Fact label="Due">{task.due && [task.due.date, task.due.time].filter(Boolean).join(', ')}</Fact>
                    <Fact label="Appointment">{task.appointment}</Fact>
                    <Fact label="Your reminder">{task.reminder}</Fact>
                </dl>
            </section>

            <section className="task-panel__section" aria-labelledby="task-panel-people">
                <h3 id="task-panel-people" className="task-panel__label">
                    People
                </h3>
                <dl className="rd-facts task-panel__facts">
                    <Fact label="Subscriber">
                        {task.subscriber?.name &&
                            `${task.subscriber.name}${task.subscriber.rate !== null ? ` (rated ${task.subscriber.rate})` : ''}`}
                    </Fact>
                    <Fact label="Sub-subscribers">{task.sub_subscribers.join(', ')}</Fact>
                    <Fact label="Owners">{task.owners.join(', ')}</Fact>
                </dl>
            </section>
        </>
    );
}
