import { useForm } from '@inertiajs/react';
import type { ChangeEvent, FormEvent } from 'react';
import FormActions from '@/Components/form/FormActions';
import Card from '@/Components/ui/Card';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import SectionHeader from '@/Components/ui/SectionHeader';
import { useToast } from '@/Components/feedback/ToastProvider';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import type { BreadcrumbProps } from '@/types';
import type { LeadFormOptions } from '@/types/leads';
import LeadFields, { type LeadFormData } from './Partials/LeadFields';
import { leadFormData } from './Partials/leadFormData';

/** Largest attachment the form accepts, in KB (20 MB). */
const MAX_FILE_KB = 20480;

interface CreateLeadProps extends BreadcrumbProps, LeadFormOptions {
    today: string;
}

export default function CreateLead({ today, tmenu_part1, tmenu_part2, tmenu_part3, ...options }: CreateLeadProps) {
    const toast = useToast();
    const { data, setData, post, processing, errors } = useForm<LeadFormData & { file: File[] }>({
        ...leadFormData(null, today),
        file: [],
    });

    const pickFiles = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        if (files.some((file) => file.size / 1024 >= MAX_FILE_KB)) {
            toast('File is too large, > 20MB!', 'error');
            event.target.value = '';
            setData('file', []);
            return;
        }
        setData('file', files);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('lead.store'), { forceFormData: data.file.length > 0 });
    };

    return (
        <AppLayout title="Customer" breadcrumb={breadcrumbFrom({ tmenu_part1, tmenu_part2, tmenu_part3 })}>
            <Card variant="plain">
                <ErrorSummary />
                <form onSubmit={submit}>
                    <SectionHeader title="Lead/Customer Detail" />
                    <div className="m-2">
                        <LeadFields data={data} setData={setData} errors={errors} options={options} />

                        <label className="custom-font-xxsmall" htmlFor="file">
                            Supported File: png, jpg, pdf, excel, word, wav, mp4 &amp; other audio format
                        </label>
                        <input
                            id="file"
                            type="file"
                            className="form-control form-control-sm"
                            accept=".jpeg, .jpg, .png, .pdf, .ppt, .pptx, audio/*"
                            multiple
                            onChange={pickFiles}
                        />
                    </div>

                    <FormActions backHref={route('lead.index')} submitLabel="Save" processing={processing} />
                </form>
            </Card>
        </AppLayout>
    );
}
