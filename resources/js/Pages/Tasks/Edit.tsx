import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import DocumentList from '@/Components/documents/DocumentList';
import { FormFoot } from '@/Components/surface/FormSection';
import SurfacePage from '@/Components/surface/SurfacePage';
import TaskLeadDetails from '@/Components/tasks/TaskLeadDetails';
import TaskStatusMenu from '@/Components/tasks/TaskStatusMenu';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import AppLayout from '@/Layouts/AppLayout';
import { promptText } from '@/lib/dialogs';
import type { SelectOption } from '@/types';
import type { TaskActionFlags, TaskDetail, TaskFilters } from '@/types/tasks';
import TaskFields from './Partials/TaskFields';
import TaskHeader from './Partials/TaskHeader';
import { taskFormData } from './Partials/taskFormData';

interface EditTaskProps {
    task: TaskDetail;
    actions: TaskActionFlags;
    people: SelectOption<number>[];
    /** Only an owner (or an Admin) moves the task to another subscriber. */
    canChangeSubscriber: boolean;
    filters: TaskFilters;
}

/** Change a task's people, schedule, sales and remark. Every save asks why. */
export default function EditTask({ task, actions, people, canChangeSubscriber, filters }: EditTaskProps) {
    const { data, setData, post, transform, processing, errors } = useForm(taskFormData(task));
    const listHref = route('tasks.index2', filters);

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        const reason = await promptText({
            title: 'Please enter the reason of updating this changes.',
            inputType: 'textarea',
            confirmText: 'Send',
            required: 'Please enter your reason to proceed the update.',
        });
        if (reason === null) return;

        // The list's filters ride along so the update lands back on the same list.
        transform((current) => ({ ...filters, ...current, task_id: task.id, special_remark: reason }));
        post(route('tasks.update'));
    };

    return (
        <AppLayout title={`Edit ${task.reference}`}>
            <SurfacePage>
                <TaskHeader
                    task={task}
                    listHref={listHref}
                    trail={[{ label: task.reference, href: route('tasks.view', task.id) }, { label: 'Edit' }]}
                    title={`Edit: ${task.title}`}
                    actions={<TaskStatusMenu taskId={task.id} actions={actions} filters={filters} />}
                />

                <ErrorSummary />

                <div className="rd-form-page">
                    <form className="rd-form" onSubmit={submit} noValidate>
                        <TaskFields
                            mode="edit"
                            data={data}
                            setData={setData}
                            errors={errors}
                            people={people}
                            subscriberEditable={canChangeSubscriber}
                            names={{
                                subscriber: task.people.subscriber_name,
                                creator: task.people.creator,
                                checker: task.people.checker,
                            }}
                        />
                        <FormFoot cancelHref={listHref} submitLabel="Save changes" processing={processing} />
                    </form>

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
            </SurfacePage>
        </AppLayout>
    );
}
