import { router } from '@inertiajs/react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import DocumentList from '@/Components/documents/DocumentList';
import Field from '@/Components/form/Field';
import TextInput from '@/Components/form/TextInput';
import SurfacePage from '@/Components/surface/SurfacePage';
import ActivityComposer from '@/Components/tasks/ActivityComposer';
import ActivityTimeline from '@/Components/tasks/ActivityTimeline';
import TaskLeadDetails from '@/Components/tasks/TaskLeadDetails';
import TaskStatusMenu from '@/Components/tasks/TaskStatusMenu';
import ImageLightbox from '@/Components/ui/ImageLightbox';
import AppLayout from '@/Layouts/AppLayout';
import { markActivitiesRead } from '@/lib/taskActivity';
import type { SelectOption } from '@/types';
import type { TaskActionFlags, TaskActivity, TaskDetail, TaskFilters } from '@/types/tasks';
import TaskFields from './Partials/TaskFields';
import TaskHeader from './Partials/TaskHeader';
import { taskFormData } from './Partials/taskFormData';

type Tab = 'task' | 'activity';

interface ShowTaskProps {
    task: TaskDetail;
    /** Newest first. */
    activities: TaskActivity[];
    actions: TaskActionFlags;
    people: SelectOption<number>[];
    /** "comment" opens on the Activity tab (the lead's "Open chat" link). */
    mode: string;
    filters: TaskFilters;
}

/** A task, read-only, with its status actions and follow-up log. */
export default function ShowTask({ task, activities, actions, people, mode, filters }: ShowTaskProps) {
    const [tab, setTab] = useState<Tab>(mode === 'comment' ? 'activity' : 'task');
    const [photo, setPhoto] = useState<string | null>(null);

    useEffect(() => {
        if (tab === 'activity') {
            markActivitiesRead(task.id).catch(() => undefined);
        }
    }, [tab, task.id]);

    const tabs: { key: Tab; label: string; count?: number }[] = [
        { key: 'task', label: 'Task' },
        { key: 'activity', label: 'Activity', count: activities.length },
    ];

    return (
        <AppLayout title={task.reference}>
            <SurfacePage>
                <TaskHeader
                    task={task}
                    listHref={route('tasks.index2', filters)}
                    trail={[{ label: task.reference }]}
                    actions={<TaskStatusMenu taskId={task.id} actions={actions} filters={filters} />}
                />

                <nav className="rd-tabs" aria-label="Task">
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

                {tab === 'task' ? (
                    <div className="rd-form-page">
                        <div className="rd-form">
                            <TaskFields
                                mode="view"
                                data={taskFormData(task)}
                                people={people}
                                names={{
                                    subscriber: task.people.subscriber_name,
                                    creator: task.people.creator,
                                    checker: task.people.checker,
                                }}
                            />
                        </div>
                        <aside className="rd-form-page__aside">
                            <TaskLeadDetails lead={task.lead} />
                            <section className="rd-panel lead-card" aria-labelledby="task-docs-title">
                                <h2 id="task-docs-title" className="rd-panel__title">
                                    Documents <span className="rd-count">{task.documents.length}</span>
                                </h2>
                                <DocumentList documents={task.documents} empty="No documents on this task." />
                            </section>
                        </aside>
                    </div>
                ) : (
                    <section className="rd-panel" aria-label="Activity">
                        <ActivityPane task={task} activities={activities} onImageClick={setPhoto} />
                    </section>
                )}
            </SurfacePage>

            <ImageLightbox src={photo} onClose={() => setPhoto(null)} />
        </AppLayout>
    );
}

interface ActivityPaneProps {
    task: TaskDetail;
    activities: TaskActivity[];
    onImageClick: (src: string) => void;
}

/** Log a follow-up (and, while In Progress, move the due date) and read the timeline. */
function ActivityPane({ task, activities, onImageClick }: ActivityPaneProps) {
    const [dueDate, setDueDate] = useState('');
    const [dueTime, setDueTime] = useState('');
    const canMoveDue = task.status === 2;

    const reload = () => router.reload({ only: ['task', 'activities'] });

    const saved = () => {
        setDueDate('');
        setDueTime('');
        reload();
    };

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

            <div className="timeline-label">Activity timeline ({activities.length})</div>
            <div className="timeline-scroll">
                <ActivityTimeline activities={activities} onChanged={reload} onImageClick={onImageClick} />
            </div>
        </div>
    );
}
