import { ButtonLink } from '@/Components/ui/Button';
import AppLayout from '@/Layouts/AppLayout';
import type { Answers, CaseLink, FormSchema, Person } from '@/types/forms';
import SubmissionForm from './Partials/SubmissionForm';

interface FillFormProps {
    form: { id: number; name: string; description: string | null };
    schema: FormSchema;
    /** Answers carried over from a cloned entry, or restored after a refusal. */
    answers: Answers;
    /** Fields a later Handler step fills in. */
    deferredIds: string[];
    people: Person[];
    parentOptions: CaseLink[];
    parentId: number | null;
}

/** Start a new case from a form. */
export default function FillForm({ form, parentOptions, parentId, ...props }: FillFormProps) {
    return (
        <AppLayout title="Fill Form" breadcrumb={['Forms', form.name]}>
            <div className="page-title-box d-flex align-items-center justify-content-between">
                <h4 className="mb-0">{form.name}</h4>
                <ButtonLink href={route('form.entry')} variant="secondary" icon="mdi mdi-arrow-left">
                    Back to Start
                </ButtonLink>
            </div>

            <SubmissionForm
                {...props}
                form={form}
                action={route('form.submit')}
                extra={{ form_id: form.id }}
                parentOptions={parentOptions}
                parentId={parentId}
                submitLabel="Submit Form"
                onCancel={() => window.history.back()}
            />
        </AppLayout>
    );
}
