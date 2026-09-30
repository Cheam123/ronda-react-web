import { router } from '@inertiajs/react';
import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import DocumentTable from '@/Components/documents/DocumentTable';
import Field from '@/Components/form/Field';
import TextInput from '@/Components/form/TextInput';
import ActivityComposer from '@/Components/tasks/ActivityComposer';
import ActivityTimeline from '@/Components/tasks/ActivityTimeline';
import TaskLeadDetails from '@/Components/tasks/TaskLeadDetails';
import TaskStatusMenu from '@/Components/tasks/TaskStatusMenu';
import TaskSummary from '@/Components/tasks/TaskSummary';
import { ButtonLink } from '@/Components/ui/Button';
import Card from '@/Components/ui/Card';
import ImageLightbox from '@/Components/ui/ImageLightbox';
import SectionHeader from '@/Components/ui/SectionHeader';
import AppLayout from '@/Layouts/AppLayout';
import { markActivitiesRead } from '@/lib/taskActivity';
import type { SelectOption } from '@/types';
import type { TaskActionFlags, TaskActivity, TaskDetail, TaskFilters } from '@/types/tasks';
import TaskFields from './Partials/TaskFields';
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

    return (
        <AppLayout title="Task" breadcrumb={['Task', task.reference]}>
            <Card variant="plain">
                <div className="d-flex gap-2 mb-2">
                    <ButtonLink href={route('tasks.index2', filters)} variant="dark" className="action-button">
                        Back
                    </ButtonLink>
                    <TaskStatusMenu taskId={task.id} actions={actions} filters={filters} />
                </div>

                <TaskSummary task={task} />

                <ul className="nav nav-tabs nav-tabs-custom nav-justified mt-1" role="tablist">
                    <TabLink tab="task" current={tab} onSelect={setTab}>
                        Task Information
                    </TabLink>
                    <TabLink tab="activity" current={tab} onSelect={setTab}>
                        Activity ({activities.length})
                    </TabLink>
                </ul>

                <div className="pt-2">
                    {tab === 'task' ? (
                        <>
                            <SectionHeader title="Task Detail" />
                            <div className="m-2">
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
                            <TaskLeadDetails lead={task.lead} />
                            <div className="m-2">
                                <div className="custom-font-xsmall mb-2">
                                    <b>Document(s)</b>
                                </div>
                                <DocumentTable documents={task.documents} previews />
                            </div>
                        </>
                    ) : (
                        <ActivityPane task={task} activities={activities} onImageClick={setPhoto} />
                    )}
                </div>
            </Card>

            <ImageLightbox src={photo} onClose={() => setPhoto(null)} />
        </AppLayout>
    );
}

interface TabLinkProps {
    tab: Tab;
    current: Tab;
    onSelect: (tab: Tab) => void;
    children: ReactNode;
}

function TabLink({ tab, current, onSelect, children }: TabLinkProps) {
    return (
        <li className="nav-item" role="presentation">
            <button
                type="button"
                role="tab"
                aria-selected={tab === current}
                className={clsx('nav-link', tab === current && 'active')}
                onClick={() => onSelect(tab)}
            >
                {children}
            </button>
        </li>
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
                    <Field label="New Due Date" htmlFor="new_due_date" className="composer-due">
                        <div className="d-flex gap-1">
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

            <div className="timeline-label">Activity Timeline ({activities.length})</div>
            <div className="timeline-scroll">
                <ActivityTimeline activities={activities} onChanged={reload} onImageClick={onImageClick} />
            </div>
        </div>
    );
}
