import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import DocumentTable from '@/Components/documents/DocumentTable';
import FormActions from '@/Components/form/FormActions';
import TaskLeadDetails from '@/Components/tasks/TaskLeadDetails';
import TaskStatusMenu from '@/Components/tasks/TaskStatusMenu';
import TaskSummary from '@/Components/tasks/TaskSummary';
import { ButtonLink } from '@/Components/ui/Button';
import Card from '@/Components/ui/Card';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import SectionHeader from '@/Components/ui/SectionHeader';
import AppLayout from '@/Layouts/AppLayout';
import { promptText } from '@/lib/dialogs';
import type { SelectOption } from '@/types';
import type { TaskActionFlags, TaskDetail, TaskFilters } from '@/types/tasks';
import TaskFields from './Partials/TaskFields';
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
        <AppLayout title="Task" breadcrumb={['Task', task.reference]}>
            <Card variant="plain">
                <div className="d-flex gap-2 mb-2">
                    <ButtonLink href={route('tasks.index2', filters)} variant="dark" className="action-button">
                        Back
                    </ButtonLink>
                    <TaskStatusMenu taskId={task.id} actions={actions} filters={filters} />
                </div>

                <TaskSummary task={task} />
                <ErrorSummary />

                <form onSubmit={submit} className="mt-2">
                    <SectionHeader title="Task Detail" />
                    <div className="m-2">
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
                    </div>

                    <TaskLeadDetails lead={task.lead} />
                    <div className="m-2">
                        <div className="custom-font-xsmall mb-2">
                            <b>Document(s)</b>
                        </div>
                        <DocumentTable documents={task.documents} previews />
                    </div>

                    <FormActions backHref={route('tasks.index2', filters)} submitLabel="Save" processing={processing} />
                </form>
            </Card>
        </AppLayout>
    );
}
