import { router } from '@inertiajs/react';
import { ButtonLink } from '@/Components/ui/Button';
import AppLayout from '@/Layouts/AppLayout';
import type { Answers, CaseLink, FormSchema, Person } from '@/types/forms';
import SubmissionForm from './Partials/SubmissionForm';

interface SubmissionEditProps {
    submission: { id: number; record_title: string | null };
    form: { id: number; name: string; description: string | null };
    schema: FormSchema;
    answers: Answers;
    deferredIds: string[];
    people: Person[];
    /** Set once when the case was opened; not changed here. */
    parentCase: CaseLink | null;
}

/** Change a submission's answers while nobody has acted on it yet. */
export default function SubmissionEdit({ submission, form, parentCase, ...props }: SubmissionEditProps) {
    return (
        <AppLayout title="Edit Submission" breadcrumb={['Records', form.name]}>
            <div className="page-title-box d-flex align-items-center justify-content-between">
                <h4 className="mb-0">Edit Submission – {form.name}</h4>
                <ButtonLink href={route('form.records.index')} variant="secondary" icon="mdi mdi-arrow-left">
                    Back to Records
                </ButtonLink>
            </div>

            <SubmissionForm
                {...props}
                form={form}
                action={route('form.submission.update', submission.id)}
                recordTitle={submission.record_title}
                parentCase={parentCase}
                submitLabel="Save Changes"
                onCancel={() => router.get(route('form.records.index'))}
            />
        </AppLayout>
    );
}
