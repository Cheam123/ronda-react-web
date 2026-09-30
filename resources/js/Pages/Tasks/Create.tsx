import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { useToast } from '@/Components/feedback/ToastProvider';
import DocumentTable from '@/Components/documents/DocumentTable';
import Field from '@/Components/form/Field';
import FormActions from '@/Components/form/FormActions';
import TaskLeadDetails from '@/Components/tasks/TaskLeadDetails';
import Card from '@/Components/ui/Card';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import SectionHeader from '@/Components/ui/SectionHeader';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import type { BreadcrumbProps, SelectOption } from '@/types';
import type { DocumentFile } from '@/types/documents';
import type { TaskLead } from '@/types/tasks';
import TaskFields, { type TaskFormData } from './Partials/TaskFields';
import { blankTaskFormData } from './Partials/taskFormData';

const MAX_FILE_MB = 20;
const ACCEPTED_FILES =
    '.jpeg,.jpg,.png,.pdf,audio/*,.ppt,.pptx,.xls,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';

interface CreateTaskProps extends BreadcrumbProps {
    lead: TaskLead;
    documents: DocumentFile[];
    people: SelectOption<number>[];
    /** create_task: assign the task to others. Without it the task is the user's own. */
    canAssign: boolean;
    today: string;
}

type CreateTaskForm = TaskFormData & { lead_id: number; file: File[] };

/** A new task on a lead. */
export default function CreateTask({ lead, documents, people, canAssign, today, ...breadcrumb }: CreateTaskProps) {
    const toast = useToast();
    const { data, setData, post, processing, errors } = useForm<CreateTaskForm>({
        ...blankTaskFormData(today),
        lead_id: lead.id,
        file: [],
    });

    const pickFiles = (input: HTMLInputElement) => {
        const picked = Array.from(input.files ?? []);
        const tooLarge = picked.find((file) => file.size >= MAX_FILE_MB * 1024 * 1024);
        if (tooLarge) {
            toast(`${tooLarge.name} is too large (over ${MAX_FILE_MB}MB).`, 'error');
            input.value = '';
            setData('file', []);
            return;
        }
        setData('file', picked);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('tasks.store'), { forceFormData: true });
    };

    return (
        <AppLayout title="Task" breadcrumb={breadcrumbFrom(breadcrumb)}>
            <Card variant="plain">
                <ErrorSummary />
                <form onSubmit={submit}>
                    <SectionHeader title="Task Detail" />
                    <div className="m-2">
                        {!canAssign && (
                            <div className="alert alert-info py-2 px-3 custom-font-small mb-2">
                                <i className="fas fa-user-check me-1" /> You will start this task.
                            </div>
                        )}
                        <TaskFields
                            mode="create"
                            data={data}
                            setData={setData}
                            errors={errors}
                            people={people}
                            showPeople={canAssign}
                        />
                    </div>

                    <TaskLeadDetails lead={lead} />

                    <div className="m-2">
                        <Field
                            label="Document"
                            htmlFor="file"
                            error={errors.file}
                            hint="Supported File: png, jpg, pdf, word, excel, wav, mp4 & other audio format"
                        >
                            <input
                                id="file"
                                type="file"
                                multiple
                                accept={ACCEPTED_FILES}
                                className="form-control form-control-sm custom-font-small"
                                onChange={(event) => pickFiles(event.target)}
                            />
                        </Field>
                        <div className="mt-2">
                            <DocumentTable documents={documents} previews />
                        </div>
                    </div>

                    <FormActions backHref={route('lead.index')} submitLabel="Submit" processing={processing} />
                </form>
            </Card>
        </AppLayout>
    );
}
