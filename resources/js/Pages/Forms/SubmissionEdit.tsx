import { router } from '@inertiajs/react';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import type { Answers, CaseLink, FormSchema, Person, ProcessDefinition } from '@/types/forms';
import AfterSubmit from './Partials/AfterSubmit';
import SubmissionForm from './Partials/SubmissionForm';

interface SubmissionEditProps {
    submission: { id: number; record_title: string | null };
    form: { id: number; name: string; description: string | null };
    schema: FormSchema;
    answers: Answers;
    deferredIds: string[];
    process: ProcessDefinition;
    processNames: Record<string, string>;
    people: Person[];
    /** Set once when the record was opened; not changed here. */
    parentCase: CaseLink | null;
}

/** Change a submission's answers while nobody has acted on it yet. */
export default function SubmissionEdit({
    submission,
    form,
    parentCase,
    process,
    processNames,
    ...props
}: SubmissionEditProps) {
    const back = route('form.records.show', submission.id);

    return (
        <AppLayout title={`Edit answers: ${form.name}`}>
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'My records', href: route('form.records.index') },
                        { label: submission.record_title || form.name, href: back },
                        { label: 'Edit answers' },
                    ]}
                    title="Edit answers"
                    lede={form.name}
                />

                <SubmissionForm
                    {...props}
                    action={route('form.submission.update', submission.id)}
                    recordTitle={submission.record_title}
                    parentCase={parentCase}
                    submitLabel="Save changes"
                    onCancel={() => router.get(back)}
                    aside={
                        <AfterSubmit
                            process={process}
                            names={processNames}
                            schema={props.schema}
                            title="After you save"
                            note="Saving works the steps out again from your new answers."
                        />
                    }
                />
            </SurfacePage>
        </AppLayout>
    );
}
