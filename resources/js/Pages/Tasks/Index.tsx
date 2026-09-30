import { useEffect, useState } from 'react';
import Card from '@/Components/ui/Card';
import ImageLightbox from '@/Components/ui/ImageLightbox';
import Pagination from '@/Components/ui/Pagination';
import { useFilters } from '@/hooks/useFilters';
import AppLayout from '@/Layouts/AppLayout';
import type { Paginated, SelectOption } from '@/types';
import type { IfeAreaOption } from '@/types/leads';
import type { TaskFilters, TaskListItem } from '@/types/tasks';
import ActivityModal from './Partials/ActivityModal';
import AppointmentsModal from './Partials/AppointmentsModal';
import StatusTabs from './Partials/StatusTabs';
import TaskDetailsModal from './Partials/TaskDetailsModal';
import TaskFilterForm, { taskFilterValues } from './Partials/TaskFilterForm';
import TaskRow from './Partials/TaskRow';

interface TasksIndexProps {
    tasks: Paginated<TaskListItem>;
    statusCounts: Record<string, number | string>;
    users: SelectOption<number>[];
    leadNames: string[];
    ifeAreas: IfeAreaOption[];
    sources: SelectOption[];
    businessCategories: SelectOption[];
    /** The query string, with the status and sort the controller defaulted. */
    filters: TaskFilters;
}

/** The task triage list: filters, a tab per status, and each task's follow-ups. */
export default function TasksIndex({ tasks, statusCounts, filters, ...options }: TasksIndexProps) {
    const { values, set, apply, reset } = useFilters(route('tasks.index2'), taskFilterValues(filters));
    const [detailsId, setDetailsId] = useState<number | null>(null);
    const [activityTask, setActivityTask] = useState<TaskListItem | null>(null);
    const [appointmentsOf, setAppointmentsOf] = useState<TaskListItem['subscriber']>(null);
    const [photo, setPhoto] = useState<string | null>(null);

    // Keep the open activity dialog on the fresh row after a reload. A row
    // that sorted off this page stays as it was until the dialog closes.
    useEffect(() => {
        setActivityTask((open) => (open && tasks.data.find((task) => task.id === open.id)) || open);
    }, [tasks]);

    const firstRow = tasks.from ?? 1;
    const detailsTask = tasks.data.find((task) => task.id === detailsId) ?? null;

    return (
        <AppLayout title="Task">
            <Card variant="plain">
                <TaskFilterForm values={values} set={set} onSearch={() => apply()} onReset={reset} options={options} />
                <hr />
                <StatusTabs
                    status={values.status}
                    counts={statusCounts}
                    sortBy={values.sortby}
                    sortMode={values.sortmode}
                    onStatus={(status) => {
                        set('status', status);
                        apply({ status });
                    }}
                    onSort={(sortby, sortmode) => {
                        set('sortby', sortby);
                        set('sortmode', sortmode);
                        apply({ sortby, sortmode });
                    }}
                />

                <div className="triage-scroll">
                    <div className="triage-card">
                        <table className="triage-table">
                            <thead>
                                <tr>
                                    <th className="triage-strip" />
                                    <th className="triage-num">#</th>
                                    <th className="col-lead">Lead</th>
                                    <th className="col-task">Task</th>
                                    <th className="col-activity">Last Activity</th>
                                    <th className="col-subscriber">Subscriber</th>
                                    <th className="actions-cell">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.data.map((task, index) => (
                                    <TaskRow
                                        key={task.id}
                                        task={task}
                                        number={firstRow + index}
                                        filters={filters}
                                        onDetails={() => setDetailsId(task.id)}
                                        onActivity={() => setActivityTask(task)}
                                        onAppointments={() => setAppointmentsOf(task.subscriber)}
                                    />
                                ))}
                                {tasks.data.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center text-muted py-4">
                                            No tasks found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <Pagination links={tasks.links} className="mt-2" />
            </Card>

            <TaskDetailsModal task={detailsTask} onHide={() => setDetailsId(null)} />
            <ActivityModal task={activityTask} onHide={() => setActivityTask(null)} onImageClick={setPhoto} />
            <AppointmentsModal subscriber={appointmentsOf} onHide={() => setAppointmentsOf(null)} />
            <ImageLightbox src={photo} onClose={() => setPhoto(null)} />
        </AppLayout>
    );
}
