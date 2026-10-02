import { router, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import DocumentList from '@/Components/documents/DocumentList';
import { useToast } from '@/Components/feedback/ToastProvider';
import FileDropzone from '@/Components/form/FileDropzone';
import { FormFoot, FormSection } from '@/Components/surface/FormSection';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import AppLayout from '@/Layouts/AppLayout';
import { DOCUMENT_FILE_TYPES } from '@/lib/files';
import type { DocumentFile } from '@/types/documents';
import type { Lead, LeadFormOptions } from '@/types/leads';
import LeadFields from './Partials/LeadFields';
import LeadFormAside from './Partials/LeadFormAside';
import { leadFormData } from './Partials/leadFormData';

interface EditLeadProps extends LeadFormOptions {
    lead: Lead;
    documents: DocumentFile[];
    today: string;
}

export default function EditLead({ lead, documents, today, ...options }: EditLeadProps) {
    const toast = useToast();
    const [uploading, setUploading] = useState(false);
    const { data, setData, post, processing, errors } = useForm({ ...leadFormData(lead, today), id: lead.id });
    const title = lead.business_name || lead.name || 'Unnamed outlet';

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('lead.update'));
    };

    // Files upload as soon as they are dropped; unsaved edits to the form stay.
    const upload = (files: File[]) => {
        router.post(
            route('lead.file.store'),
            { leadid: lead.id, file: files },
            {
                forceFormData: true,
                preserveScroll: true,
                preserveState: true,
                onStart: () => setUploading(true),
                onFinish: () => setUploading(false),
            },
        );
    };

    return (
        <AppLayout title={`Edit ${title}`}>
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Lead/Customer', href: route('lead.index') },
                        { label: title, href: route('lead.view', lead.id) },
                        { label: 'Edit' },
                    ]}
                    title={`Edit ${title}`}
                    lede="Changes to size, seats, segment or the location refresh this outlet’s suggested orders."
                />

                <ErrorSummary />

                <div className="rd-form-page">
                    <form className="rd-form" onSubmit={submit} noValidate>
                        <LeadFields data={data} setData={setData} errors={errors} options={options} />

                        <FormSection
                            title="Documents"
                            intro="Agreements, photos, voice notes. Files upload as soon as you drop them."
                        >
                            <FileDropzone
                                onFiles={upload}
                                busy={uploading}
                                accept={DOCUMENT_FILE_TYPES}
                                maxSizeMb={10}
                                maxFiles={25}
                                hint="PNG, JPG, PDF, Word, Excel, PowerPoint or audio · up to 10 MB each"
                                onReject={(message) => toast(message, 'error')}
                            />
                            <DocumentList documents={documents} deletable empty="No documents on this outlet yet." />
                        </FormSection>

                        <FormFoot
                            cancelHref={route('lead.view', lead.id)}
                            submitLabel="Save changes"
                            processing={processing}
                        />
                    </form>

                    <LeadFormAside customerId={data.customer_id} />
                </div>
            </SurfacePage>
        </AppLayout>
    );
}
