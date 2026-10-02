import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import type { Answers, CaseLink, FormSchema, Person, ProcessDefinition } from '@/types/forms';
import AfterSubmit from './Partials/AfterSubmit';
import SubmissionForm from './Partials/SubmissionForm';

interface FillFormProps {
    form: { id: number; name: string; description: string | null };
    schema: FormSchema;
    /** Answers carried over from a cloned entry, or restored after a refusal. */
    answers: Answers;
    /** Fields a later fill-in step fills in. */
    deferredIds: string[];
    /** The steps after submitting, for "After you submit". */
    process: ProcessDefinition;
    processNames: Record<string, string>;
    people: Person[];
    parentOptions: CaseLink[];
    parentId: number | null;
}

/** Start a new record from a form. */
export default function FillForm({ form, parentOptions, parentId, process, processNames, ...props }: FillFormProps) {
    return (
        <AppLayout title={form.name}>
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Start a form', href: route('form.entry') },
                        { label: form.name },
                    ]}
                    title={form.name}
                    lede={form.description}
                />

                <SubmissionForm
                    {...props}
                    action={route('form.submit')}
                    extra={{ form_id: form.id }}
                    parentOptions={parentOptions}
                    parentId={parentId}
                    submitLabel="Submit"
                    onCancel={() => window.history.back()}
                    aside={<AfterSubmit process={process} names={processNames} schema={props.schema} />}
                />
            </SurfacePage>
        </AppLayout>
    );
}
