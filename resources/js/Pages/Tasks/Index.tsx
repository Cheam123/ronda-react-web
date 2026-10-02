import { useEffect, useMemo, useState, type FormEvent } from 'react';
import IfeAreaListButton from '@/Components/areas/IfeAreaListButton';
import SearchSelect from '@/Components/form/SearchSelect';
import DateRangeMenu from '@/Components/surface/DateRangeMenu';
import PageHeader from '@/Components/surface/PageHeader';
import Pager from '@/Components/surface/Pager';
import SurfacePage from '@/Components/surface/SurfacePage';
import ImageLightbox from '@/Components/ui/ImageLightbox';
import { useFilters } from '@/hooks/useFilters';
import AppLayout from '@/Layouts/AppLayout';
import { formatNumber } from '@/lib/format';
import type { Paginated } from '@/types';
import type { TaskFilters, TaskListItem } from '@/types/tasks';
import AppointmentsModal from './Partials/AppointmentsModal';
import MoreFilters from './Partials/MoreFilters';
import StatusTabs from './Partials/StatusTabs';
import TaskPanel from './Partials/TaskPanel';
import TaskRow from './Partials/TaskRow';
import {
    NO_FILTERS,
    filterChips,
    moreFilterValues,
    taskFilterValues,
    type TaskFilterOptions,
} from './Partials/taskFilters';

const SORT_BY = [
    { value: 'last_follow_up', label: 'Last updated' },
    { value: 'reminder_date', label: 'Reminder date' },
    { value: 'due_date', label: 'Due date' },
    { value: 'created_at', label: 'Created date' },
    { value: 'inprogress_date', label: 'In progress date' },
    { value: 'complete_date', label: 'Completed date' },
    { value: 'kiv_date', label: 'Keep in view date' },
    { value: 'reject_date', label: 'Rejected date' },
];

/** Dates that are still to come read soonest first; the rest newest first. */
const AHEAD = ['due_date', 'reminder_date'];

interface TasksIndexProps extends TaskFilterOptions {
    tasks: Paginated<TaskListItem>;
    statusCounts: Record<string, number | string>;
    /** The query string, with the status and sort the controller defaulted. */
    filters: TaskFilters;
}

/** The task list: a tab per status, the filters, and each task's follow-ups beside it. */
export default function TasksIndex({ tasks, statusCounts, filters, ...options }: TasksIndexProps) {
    const { values, set, apply, choose } = useFilters(route('tasks.index2'), taskFilterValues(filters));
    const [panelTask, setPanelTask] = useState<TaskListItem | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [appointmentsOf, setAppointmentsOf] = useState<TaskListItem['subscriber']>(null);
    const [photo, setPhoto] = useState<string | null>(null);

    // Keep the open panel on the fresh row after a reload. A row that
    // sorted off this page stays as it was until the panel closes.
    useEffect(() => {
        setPanelTask((open) => (open && tasks.data.find((task) => task.id === open.id)) || open);
    }, [tasks]);

    const more = useMemo(() => moreFilterValues(values), [values]);
    const chips = filterChips(values, options);
    const filtered =
        chips.length > 0 || Boolean(values.search || values.filter_subscriber || values.updated_date_start);

    const search = (event: FormEvent) => {
        event.preventDefault();
        apply();
    };

    const ahead = AHEAD.includes(values.sortby);
    const descending = values.sortmode !== 'asc';
    const orderText = descending ? (ahead ? 'Latest first' : 'Newest first') : ahead ? 'Soonest first' : 'Oldest first';

    return (
        <AppLayout title="Tasks">
            <SurfacePage>
                <PageHeader
                    crumbs={[{ label: 'Home', href: '/index' }, { label: 'Task' }]}
                    title="Tasks"
                    actions={<IfeAreaListButton areas={options.ifeAreas} label="IFE area codes" surface />}
                />

                <section className="rd-panel rd-list task-list" aria-label="Tasks">
                    <StatusTabs
                        status={values.status}
                        counts={statusCounts}
                        onStatus={(status) => choose({ status })}
                    />

                    <div className="task-list__toolbar">
                        <div className="task-list__filters">
                            <form role="search" onSubmit={search}>
                                <label className="rd-search">
                                    <i className="mdi mdi-magnify" aria-hidden="true" />
                                    <input
                                        type="search"
                                        className="rd-input"
                                        aria-label="Search tasks"
                                        placeholder="Search task title or reference"
                                        maxLength={500}
                                        value={values.search}
                                        onChange={(event) => set('search', event.target.value)}
                                    />
                                </label>
                            </form>
                            <SearchSelect
                                compact
                                className="task-list__subscriber"
                                ariaLabel="Subscriber"
                                options={[{ value: '', label: 'All subscribers' }, ...options.users]}
                                clearable={false}
                                value={values.filter_subscriber}
                                onChange={(value) => choose({ filter_subscriber: value })}
                            />
                            <DateRangeMenu
                                label="Last updated"
                                start={values.updated_date_start}
                                end={values.updated_date_end}
                                onApply={(start, end) => choose({ updated_date_start: start, updated_date_end: end })}
                            />
                            <button
                                type="button"
                                className="rd-btn"
                                aria-expanded={filtersOpen}
                                onClick={() => setFiltersOpen(true)}
                            >
                                <i className="mdi mdi-tune-variant" aria-hidden="true" />
                                More filters
                                {chips.length > 0 && (
                                    <span className="task-list__badge" aria-label={`${chips.length} in use`}>
                                        {chips.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        <div className="task-list__sort">
                            <label htmlFor="task-sort">Sort by</label>
                            <SearchSelect
                                id="task-sort"
                                compact
                                className="task-list__sortby"
                                options={SORT_BY}
                                clearable={false}
                                searchable={false}
                                value={values.sortby}
                                // Due dates read soonest first, so that sort starts ascending.
                                onChange={(value) =>
                                    choose({ sortby: value, sortmode: value === 'due_date' ? 'asc' : values.sortmode })
                                }
                            />
                            <button
                                type="button"
                                className="rd-btn"
                                title="Change the order"
                                onClick={() => choose({ sortmode: descending ? 'asc' : 'desc' })}
                            >
                                <i className={`mdi mdi-arrow-${descending ? 'down' : 'up'}`} aria-hidden="true" />
                                {orderText}
                            </button>
                        </div>
                    </div>

                    {chips.length > 0 && (
                        <div className="task-list__chips">
                            <span className="rd-muted">Filtered by</span>
                            {chips.map((chip) => (
                                <button
                                    key={chip.key}
                                    type="button"
                                    className="task-list__chip"
                                    aria-label={`Remove the filter ${chip.label}`}
                                    title="Remove"
                                    onClick={() => choose(chip.clear)}
                                >
                                    {chip.label}
                                    <i className="mdi mdi-close" aria-hidden="true" />
                                </button>
                            ))}
                            <button type="button" className="task-list__clear" onClick={() => choose(NO_FILTERS)}>
                                Clear all
                            </button>
                        </div>
                    )}

                    <div className="rd-scroll">
                        <table className="rd-table rd-table--band task-table">
                            <thead>
                                <tr>
                                    <th scope="col">Task</th>
                                    <th scope="col">Outlet</th>
                                    <th
                                        scope="col"
                                        aria-sort={
                                            values.sortby === 'last_follow_up' ? sortWord(descending) : undefined
                                        }
                                    >
                                        <SortedHead active={values.sortby === 'last_follow_up'} descending={descending}>
                                            Last contact
                                        </SortedHead>
                                    </th>
                                    <th
                                        scope="col"
                                        aria-sort={values.sortby === 'due_date' ? sortWord(descending) : undefined}
                                    >
                                        <SortedHead active={values.sortby === 'due_date'} descending={descending}>
                                            Due
                                        </SortedHead>
                                    </th>
                                    <th scope="col">Subscriber</th>
                                    <th scope="col" className="rd-col-actions text-end">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.data.map((task) => (
                                    <TaskRow
                                        key={task.id}
                                        task={task}
                                        filters={filters}
                                        open={panelTask?.id === task.id}
                                        onActivity={() => setPanelTask(task)}
                                        onAppointments={() => setAppointmentsOf(task.subscriber)}
                                    />
                                ))}
                                {tasks.data.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="rd-list__empty">
                                            No tasks match.{' '}
                                            {filtered && (
                                                <button
                                                    type="button"
                                                    className="btn btn-link p-0 align-baseline"
                                                    onClick={() => choose(NO_FILTERS)}
                                                >
                                                    Clear the filters
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="rd-list__foot">
                        <span>
                            {tasks.total > 0 ? (
                                <>
                                    Showing{' '}
                                    <strong>
                                        {tasks.from}–{tasks.to}
                                    </strong>{' '}
                                    of <strong>{formatNumber(tasks.total)}</strong>{' '}
                                    {tasks.total === 1 ? 'task' : 'tasks'}
                                </>
                            ) : (
                                'No tasks'
                            )}
                        </span>
                        <Pager links={tasks.links} />
                    </div>
                </section>

                <TaskPanel
                    task={panelTask}
                    filters={filters}
                    onHide={() => setPanelTask(null)}
                    onImageClick={setPhoto}
                />
                <MoreFilters
                    show={filtersOpen}
                    onHide={() => setFiltersOpen(false)}
                    values={more}
                    options={options}
                    onApply={(changes) => {
                        setFiltersOpen(false);
                        choose(changes);
                    }}
                />
                <AppointmentsModal subscriber={appointmentsOf} onHide={() => setAppointmentsOf(null)} />
                <ImageLightbox src={photo} onClose={() => setPhoto(null)} />
            </SurfacePage>
        </AppLayout>
    );
}

const sortWord = (descending: boolean) => (descending ? 'descending' : 'ascending');

function SortedHead({ active, descending, children }: { active: boolean; descending: boolean; children: string }) {
    if (!active) {
        return <>{children}</>;
    }

    return (
        <span className="rd-sorted">
            {children}
            <i className={`mdi mdi-arrow-${descending ? 'down' : 'up'}`} aria-hidden="true" />
        </span>
    );
}
