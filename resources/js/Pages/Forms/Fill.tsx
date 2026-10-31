import { router } from '@inertiajs/react';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/Layouts/AppLayout';
import { draftKey } from '@/lib/drafts';
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

/** Start a new record from a form. The answers are kept as a draft on this device until it is sent. */
export default function FillForm({ form, parentOptions, parentId, process, processNames, ...props }: FillFormProps) {
    const { user } = useAuth();

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
                    // Back to the list of forms, not back in history: a link from Telegram has no history here.
                    onCancel={() => router.visit(route('form.entry'))}
                    draftKey={user ? draftKey(user.id, form.id) : undefined}
                    aside={<AfterSubmit process={process} names={processNames} schema={props.schema} />}
                />
            </SurfacePage>
        </AppLayout>
    );
}
