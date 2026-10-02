import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import DocumentList from '@/Components/documents/DocumentList';
import PendingFiles from '@/Components/documents/PendingFiles';
import { useToast } from '@/Components/feedback/ToastProvider';
import FileDropzone from '@/Components/form/FileDropzone';
import { FormFoot, FormSection } from '@/Components/surface/FormSection';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import TaskLeadDetails from '@/Components/tasks/TaskLeadDetails';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import AppLayout from '@/Layouts/AppLayout';
import { DOCUMENT_FILE_TYPES } from '@/lib/files';
import type { SelectOption } from '@/types';
import type { DocumentFile } from '@/types/documents';
import type { TaskLead } from '@/types/tasks';
import TaskFields, { type TaskFormData } from './Partials/TaskFields';
import { blankTaskFormData } from './Partials/taskFormData';

const MAX_FILE_MB = 20;

interface CreateTaskProps {
    lead: TaskLead;
    documents: DocumentFile[];
    people: SelectOption<number>[];
    /** create_task: assign the task to others. Without it the task is the user's own. */
    canAssign: boolean;
    today: string;
}

type CreateTaskForm = TaskFormData & { lead_id: number; file: File[] };

/** A new task on a lead. */
export default function CreateTask({ lead, documents, people, canAssign, today }: CreateTaskProps) {
    const toast = useToast();
    const { data, setData, post, processing, errors } = useForm<CreateTaskForm>({
        ...blankTaskFormData(today),
        lead_id: lead.id,
        file: [],
    });
    const outlet = lead.business_name || lead.name || 'Unnamed outlet';

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('tasks.store'), { forceFormData: true });
    };

    return (
        <AppLayout title="Add a task">
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Lead/Customer', href: route('lead.index') },
                        { label: outlet, href: route('lead.view', lead.id) },
                        { label: 'Add a task' },
                    ]}
                    title="Add a task"
                    lede={canAssign ? `On ${outlet}.` : `On ${outlet}. You will start this task yourself.`}
                />

                <ErrorSummary />

                <div className="rd-form-page">
                    <form className="rd-form" onSubmit={submit} noValidate>
                        <TaskFields
                            mode="create"
                            data={data}
                            setData={setData}
                            errors={errors}
                            people={people}
                            showPeople={canAssign}
                        />

                        <FormSection title="Documents" intro="Photos, quotes, voice notes for the task.">
                            <FileDropzone
                                onFiles={(files) => setData('file', [...data.file, ...files])}
                                accept={DOCUMENT_FILE_TYPES}
                                maxSizeMb={MAX_FILE_MB}
                                maxFiles={25}
                                hint={`PNG, JPG, PDF, Word, Excel, PowerPoint or audio · up to ${MAX_FILE_MB} MB each`}
                                onReject={(message) => toast(message, 'error')}
                            />
                            <PendingFiles
                                files={data.file}
                                onRemove={(index) =>
                                    setData(
                                        'file',
                                        data.file.filter((_, other) => other !== index),
                                    )
                                }
                            />
                        </FormSection>

                        <FormFoot
                            cancelHref={route('lead.view', lead.id)}
                            submitLabel="Add task"
                            processing={processing}
                        />
                    </form>

                    <aside className="rd-form-page__aside">
                        <TaskLeadDetails lead={lead} />
                        {documents.length > 0 && (
                            <section className="rd-panel lead-card" aria-labelledby="outlet-docs-title">
                                <h2 id="outlet-docs-title" className="rd-panel__title">
                                    Outlet documents <span className="rd-count">{documents.length}</span>
                                </h2>
                                <DocumentList documents={documents} />
                            </section>
                        )}
                    </aside>
                </div>
            </SurfacePage>
        </AppLayout>
    );
}
