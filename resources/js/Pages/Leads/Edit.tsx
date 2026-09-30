import { router, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import FileDropzone from '@/Components/form/FileDropzone';
import FormActions from '@/Components/form/FormActions';
import Card from '@/Components/ui/Card';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import SectionHeader from '@/Components/ui/SectionHeader';
import { useToast } from '@/Components/feedback/ToastProvider';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import type { BreadcrumbProps } from '@/types';
import type { Lead, LeadDocument, LeadFormOptions } from '@/types/leads';
import LeadDocuments from './Partials/LeadDocuments';
import LeadFields from './Partials/LeadFields';
import { leadFormData } from './Partials/leadFormData';

const ACCEPTED_FILES = {
    'image/*': ['.png', '.jpg', '.jpeg'],
    'application/pdf': ['.pdf'],
    'audio/*': [],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

interface EditLeadProps extends BreadcrumbProps, LeadFormOptions {
    lead: Lead;
    documents: LeadDocument[];
    today: string;
}

export default function EditLead({ lead, documents, today, tmenu_part1, tmenu_part2, tmenu_part3, ...options }: EditLeadProps) {
    const toast = useToast();
    const [uploading, setUploading] = useState(false);
    const { data, setData, post, processing, errors } = useForm({ ...leadFormData(lead, today), id: lead.id });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('lead.update'));
    };

    // Files upload as soon as they are dropped, like the Dropzone this replaces.
    const upload = (files: File[]) => {
        router.post(
            route('lead.file.store'),
            { leadid: lead.id, file: files },
            {
                forceFormData: true,
                preserveScroll: true,
                onStart: () => setUploading(true),
                onFinish: () => setUploading(false),
            },
        );
    };

    return (
        <AppLayout title="Customer" breadcrumb={breadcrumbFrom({ tmenu_part1, tmenu_part2, tmenu_part3 })}>
            <Card variant="plain">
                <ErrorSummary />
                <form onSubmit={submit}>
                    <SectionHeader title="Lead/Customer Detail" />
                    <div className="m-2">
                        <LeadFields data={data} setData={setData} errors={errors} options={options} />
                    </div>

                    <FormActions backHref={route('lead.index')} submitLabel="Save" processing={processing} />
                </form>

                <div className="mt-3">
                    <h4>Document Upload</h4>
                    <FileDropzone
                        onFiles={upload}
                        busy={uploading}
                        accept={ACCEPTED_FILES}
                        maxSizeMb={10}
                        maxFiles={25}
                        hint="Supported File: png, jpg, pdf, excel, word, wav, mp4 & other audio format"
                        onReject={(message) => toast(message, 'error')}
                    />
                    <div className="mt-2">
                        <LeadDocuments documents={documents} deletable />
                    </div>
                </div>
            </Card>
        </AppLayout>
    );
}
