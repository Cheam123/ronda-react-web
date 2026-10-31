import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import DocumentList from '@/Components/documents/DocumentList';
import Field from '@/Components/form/Field';
import TextArea from '@/Components/form/TextArea';
import { FormFoot, FormSection } from '@/Components/surface/FormSection';
import SurfacePage from '@/Components/surface/SurfacePage';
import TaskLeadDetails from '@/Components/tasks/TaskLeadDetails';
import TaskActions from '@/Components/tasks/TaskActions';
import { taskPeopleNames } from '@/Components/tasks/taskPeople';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import AppLayout from '@/Layouts/AppLayout';
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

const REASON_MAX = 500;

/** Change a task's people, schedule, sales and remark. Every save says why, in the field above Save. */
export default function EditTask({ task, actions, people, canChangeSubscriber, filters }: EditTaskProps) {
    const { data, setData, post, transform, processing, errors, isDirty, setError, clearErrors } = useForm({
        ...taskFormData(task),
        special_remark: '',
    });
    const listHref = route('tasks.index2', filters);

    useUnsavedChanges(isDirty, task.title);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (data.special_remark.trim() === '') {
            setError('special_remark', 'Give a reason for the change.');
            return;
        }

        // The list's filters ride along so the update lands back on the same list.
        transform((current) => ({ ...filters, ...current, task_id: task.id }));
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
                    actions={
                        <TaskActions
                            taskId={task.id}
                            actions={actions}
                            names={taskPeopleNames(task)}
                            filters={filters}
                        />
                    }
                />

                <ErrorSummary errors={errors} />

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
                        <FormSection title="Why" intro="Every change to a task is saved with its reason.">
                            <Field
                                label="Reason for the change"
                                htmlFor="special_remark"
                                required
                                error={errors.special_remark}
                            >
                                <TextArea
                                    id="special_remark"
                                    rows={3}
                                    maxLength={REASON_MAX}
                                    value={data.special_remark}
                                    onChange={(event) => {
                                        setData('special_remark', event.target.value);
                                        clearErrors('special_remark');
                                    }}
                                />
                                <span className="rd-form__counter">
                                    {data.special_remark.length} / {REASON_MAX}
                                </span>
                            </Field>
                        </FormSection>
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
