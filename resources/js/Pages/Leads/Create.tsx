import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import PendingFiles from '@/Components/documents/PendingFiles';
import { useToast } from '@/Components/feedback/ToastProvider';
import FileDropzone from '@/Components/form/FileDropzone';
import { FormFoot, FormSection } from '@/Components/surface/FormSection';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import AppLayout from '@/Layouts/AppLayout';
import { DOCUMENT_FILE_TYPES } from '@/lib/files';
import type { LeadFormOptions } from '@/types/leads';
import LeadFields, { type LeadFormData } from './Partials/LeadFields';
import LeadFormAside from './Partials/LeadFormAside';
import { leadFormData } from './Partials/leadFormData';

/** Largest attachment the form accepts, in MB. */
const MAX_FILE_MB = 20;

interface CreateLeadProps extends LeadFormOptions {
    today: string;
}

export default function CreateLead({ today, ...options }: CreateLeadProps) {
    const toast = useToast();
    const { data, setData, post, processing, errors } = useForm<LeadFormData & { file: File[] }>({
        ...leadFormData(null, today),
        file: [],
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('lead.store'), { forceFormData: data.file.length > 0 });
    };

    return (
        <AppLayout title="Add a lead">
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Lead/Customer', href: route('lead.index') },
                        { label: 'Add a lead' },
                    ]}
                    title="Add a lead"
                    lede="Save them as a prospect, and add their Customer ID once they buy."
                />

                <ErrorSummary />

                <div className="rd-form-page">
                    <form className="rd-form" onSubmit={submit} noValidate>
                        <LeadFields data={data} setData={setData} errors={errors} options={options} />

                        <FormSection title="Documents" intro="Agreements, photos, voice notes. Saved with the lead.">
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

                        <FormFoot cancelHref={route('lead.index')} submitLabel="Save lead" processing={processing} />
                    </form>

                    <LeadFormAside customerId={data.customer_id} />
                </div>
            </SurfacePage>
        </AppLayout>
    );
}
