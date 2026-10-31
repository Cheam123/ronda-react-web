import { router } from '@inertiajs/react';
import { useEffect, useState, type ReactNode } from 'react';
import DocumentList from '@/Components/documents/DocumentList';
import Field from '@/Components/form/Field';
import TextInput from '@/Components/form/TextInput';
import SurfacePage from '@/Components/surface/SurfacePage';
import ActivityComposer from '@/Components/tasks/ActivityComposer';
import ActivityTimeline from '@/Components/tasks/ActivityTimeline';
import TaskActions from '@/Components/tasks/TaskActions';
import TaskLeadDetails from '@/Components/tasks/TaskLeadDetails';
import TaskProgress from '@/Components/tasks/TaskProgress';
import { taskPeopleNames } from '@/Components/tasks/taskPeople';
import ImageLightbox from '@/Components/ui/ImageLightbox';
import SafeHtml from '@/Components/ui/SafeHtml';
import AppLayout from '@/Layouts/AppLayout';
import { formatMoney } from '@/lib/format';
import { markActivitiesRead } from '@/lib/taskActivity';
import type { TaskActionFlags, TaskActivity, TaskDetail, TaskFilters } from '@/types/tasks';
import TaskHeader from './Partials/TaskHeader';

interface ShowTaskProps {
    task: TaskDetail;
    /** Newest first. */
    activities: TaskActivity[];
    actions: TaskActionFlags;
    /** "comment" (the outlet's "Open the chat" link) puts the cursor in the follow-up box. */
    mode: string;
    filters: TaskFilters;
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

/** "27 Oct 2026, 5:00 pm" from a date and an optional time; null when there is no date. */
function when(date: string | null, time: string | null): string | null {
    if (!date) return null;
    const day = new Date(`${date.slice(0, 10)}T${time ? time.slice(0, 8) : '00:00:00'}`);
    if (Number.isNaN(day.getTime())) return date;
    return time
        ? `${DAY.format(day)}, ${TIME.format(day).replace(/\s?([AP]M)$/i, (_, half: string) => ` ${half.toLowerCase()}`)}`
        : DAY.format(day);
}

/**
 * A task: where it is and who moves it on, its follow-ups (the thing done
 * most here) beside its details, read as facts rather than a disabled form.
 */
export default function ShowTask({ task, activities, actions, mode, filters }: ShowTaskProps) {
    const [photo, setPhoto] = useState<string | null>(null);
    const names = taskPeopleNames(task);

    // The follow-ups are on view as soon as the page opens.
    useEffect(() => {
        markActivitiesRead(task.id).catch(() => undefined);
    }, [task.id]);

    return (
        <AppLayout title={task.reference}>
            <SurfacePage>
                <TaskHeader
                    task={task}
                    listHref={route('tasks.index2', filters)}
                    trail={[{ label: task.reference }]}
                    actions={<TaskActions taskId={task.id} actions={actions} names={names} filters={filters} />}
                />

                <TaskProgress status={task.status} actions={actions} names={names} />

                <div className="lead-page">
                    <section className="rd-panel task-follow-ups" aria-labelledby="task-follow-ups-title">
                        <h2 id="task-follow-ups-title" className="rd-panel__title">
                            Follow-ups <span className="rd-count">{activities.length}</span>
                        </h2>
                        <ActivityPane
                            task={task}
                            activities={activities}
                            focusComposer={mode === 'comment'}
                            onImageClick={setPhoto}
                        />
                    </section>

                    <aside className="lead-page__aside">
                        <section className="rd-panel lead-card" aria-labelledby="task-details-title">
                            <h2 id="task-details-title" className="rd-panel__title">
                                Details
                            </h2>
                            <dl className="rd-facts">
                                <Fact label="Assigned to">{task.people.subscriber_name}</Fact>
                                <Fact label="Helping">{task.people.sub_subscriber_names.join(', ')}</Fact>
                                <Fact label="Owners">{task.people.owner_names.join(', ')}</Fact>
                                <Fact label="Checker">{task.people.checker}</Fact>
                                <Fact label="Can see it">{task.people.viewer_names.join(', ')}</Fact>
                                <Fact label="Created by">{task.people.creator}</Fact>
                            </dl>
                            <dl className="rd-facts task-details__when">
                                <Fact label="Starts">{when(task.start_date, task.start_time)}</Fact>
                                <Fact label="Due">{when(task.due_date, task.due_time)}</Fact>
                                <Fact label="Appointment">{when(task.appointment_date, task.appointment_time)}</Fact>
                                <Fact label="Invoice no.">
                                    {task.invoice_no && <span className="rd-mono">{task.invoice_no}</span>}
                                </Fact>
                                <Fact label="Sales">{Number(task.sales) > 0 && `RM ${formatMoney(task.sales)}`}</Fact>
                                {task.alert === 2 && (
                                    <Fact label="Alerts">
                                        <span className="rd-status rd-status--critical">
                                            <i className="mdi mdi-flag-outline" aria-hidden="true" />
                                            Flagged: everyone on it is alerted
                                        </span>
                                    </Fact>
                                )}
                            </dl>
                        </section>

                        {task.remark && (
                            <section className="rd-panel lead-card" aria-labelledby="task-remark-title">
                                <h2 id="task-remark-title" className="rd-panel__title">
                                    Remark
                                </h2>
                                <SafeHtml html={task.remark} className="task-details__remark" />
                            </section>
                        )}

                        <TaskLeadDetails lead={task.lead} />

                        <section className="rd-panel lead-card" aria-labelledby="task-docs-title">
                            <h2 id="task-docs-title" className="rd-panel__title">
                                Documents <span className="rd-count">{task.documents.length}</span>
                            </h2>
                            <DocumentList documents={task.documents} empty="No documents on this task." />
                        </section>
                    </aside>
                </div>
            </SurfacePage>

            <ImageLightbox src={photo} onClose={() => setPhoto(null)} />
        </AppLayout>
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

interface ActivityPaneProps {
    task: TaskDetail;
    activities: TaskActivity[];
    focusComposer: boolean;
    onImageClick: (src: string) => void;
}

/** Log a follow-up (and, while In Progress, move the due date) and read the timeline. */
function ActivityPane({ task, activities, focusComposer, onImageClick }: ActivityPaneProps) {
    const [dueDate, setDueDate] = useState('');
    const [dueTime, setDueTime] = useState('');
    const canMoveDue = task.status === 2;

    const reload = () => router.reload({ only: ['task', 'activities'] });

    const saved = () => {
        setDueDate('');
        setDueTime('');
        reload();
    };

    useEffect(() => {
        if (focusComposer) {
            document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus();
        }
    }, [focusComposer]);

    return (
        <div className="activity-pane">
            <ActivityComposer
                taskId={task.id}
                onSaved={saved}
                extra={canMoveDue ? { task_due_date: dueDate, task_due_time: dueTime } : undefined}
            >
                {canMoveDue && (
                    <Field label="New due date" htmlFor="new_due_date" className="composer-due">
                        <div className="task-when">
                            <TextInput
                                id="new_due_date"
                                type="date"
                                min={new Date().toLocaleDateString('en-CA')}
                                value={dueDate}
                                onChange={(event) => setDueDate(event.target.value)}
                            />
                            <TextInput
                                type="time"
                                aria-label="New due time"
                                value={dueTime}
                                onChange={(event) => setDueTime(event.target.value)}
                            />
                        </div>
                    </Field>
                )}
            </ActivityComposer>

            <div className="timeline-label">Timeline</div>
            {activities.length === 0 ? (
                <p className="rd-muted mb-0">No follow-ups yet. Log the first one above.</p>
            ) : (
                <div className="timeline-scroll">
                    <ActivityTimeline activities={activities} onChanged={reload} onImageClick={onImageClick} />
                </div>
            )}
        </div>
    );
}
