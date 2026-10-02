import { router, usePage } from '@inertiajs/react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import AssigneePicker from '@/Components/forms/AssigneePicker';
import FormRenderer from '@/Components/forms/FormRenderer';
import Field from '@/Components/form/Field';
import SearchSelect from '@/Components/form/SearchSelect';
import TextInput from '@/Components/form/TextInput';
import { FormSection } from '@/Components/surface/FormSection';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import ImageLightbox from '@/Components/ui/ImageLightbox';
import { useFormFill } from '@/hooks/useFormFill';
import { renderTree } from '@/lib/forms/schema';
import type { PageProps } from '@/types';
import type { Answers, CaseLink, FormSchema, Person } from '@/types/forms';

interface SubmissionFormProps {
    schema: FormSchema;
    answers: Answers;
    deferredIds: string[];
    people: Person[];
    /** Where the answers are posted. */
    action: string;
    /** Fields posted alongside the answers (form_id on a new submission). */
    extra?: Record<string, string | number>;
    recordTitle?: string | null;
    /** Records this one may follow up on; empty hides the picker. */
    parentOptions?: CaseLink[];
    parentId?: number | null;
    /** The record this follows up on, fixed (when editing). */
    parentCase?: CaseLink | null;
    submitLabel: string;
    onCancel: () => void;
    /** Beside the form on wide screens: what happens after submitting. */
    aside?: ReactNode;
}

/** Fill in a form: a title, the record it follows up on, and the fields, posted with attachments. */
export default function SubmissionForm({
    schema,
    answers,
    deferredIds,
    people,
    action,
    extra = {},
    recordTitle,
    parentOptions = [],
    parentId,
    parentCase,
    submitLabel,
    onCancel,
    aside,
}: SubmissionFormProps) {
    const serverErrors = usePage<PageProps>().props.errors;
    const fill = useFormFill({ schema, initial: answers, deferredIds });
    const tree = useMemo(() => renderTree(schema), [schema]);
    const [title, setTitle] = useState(recordTitle ?? '');
    const [parent, setParent] = useState(parentId ? String(parentId) : '');
    const [sending, setSending] = useState(false);
    const [photo, setPhoto] = useState<string | null>(null);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const firstProblem = fill.validate();
        if (firstProblem) {
            document.getElementById(`field-${firstProblem}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        router.post(
            action,
            {
                ...extra,
                form_data: JSON.stringify(fill.entries()),
                record_title: title,
                parent_submission_id: parent,
                files: fill.attachments(),
            },
            {
                forceFormData: true,
                preserveScroll: true,
                // A refusal comes back to this page: keep what was typed.
                preserveState: 'errors',
                onStart: () => setSending(true),
                onFinish: () => setSending(false),
            },
        );
    };

    return (
        <>
            <ErrorSummary />

            <div className="rd-form-page">
                <form className="rd-form" onSubmit={submit} noValidate>
                    {deferredIds.length > 0 && (
                        <p className="form-fill__note">
                            <i className="mdi mdi-account-multiple-outline" aria-hidden="true" />
                            Some parts of this form are filled in by other people after you submit.
                        </p>
                    )}

                    <FormSection title="This record" intro="A title so you can find it again in My records.">
                        <Field
                            label="Title"
                            htmlFor="record_title"
                            hint="Optional, but it makes the record easy to spot."
                            error={serverErrors.record_title}
                        >
                            <TextInput
                                id="record_title"
                                large
                                maxLength={255}
                                placeholder="e.g. Kopi Kita Bangsar, October price"
                                invalid={!!serverErrors.record_title}
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                            />
                        </Field>

                        {parentOptions.length > 0 && (
                            <Field
                                label="Follows up on"
                                htmlFor="parent_submission_id"
                                hint="Only if this continues an earlier record. Leave it empty otherwise."
                                error={serverErrors.parent_submission_id}
                            >
                                <SearchSelect
                                    id="parent_submission_id"
                                    placeholder="Not a follow-up"
                                    invalid={!!serverErrors.parent_submission_id}
                                    options={parentOptions.map((option) => ({
                                        value: option.id,
                                        label: `${option.reference} · ${option.title}${option.open ? '' : ' (closed)'}`,
                                    }))}
                                    value={parent}
                                    onChange={setParent}
                                />
                            </Field>
                        )}

                        {parentCase && (
                            <div className="rd-field">
                                <span className="rd-field__label">Follows up on</span>
                                <span className="form-fill__parent">
                                    <span className="rd-mono">{parentCase.reference}</span>
                                    {parentCase.title}
                                </span>
                            </div>
                        )}
                    </FormSection>

                    <FormRenderer
                        items={tree}
                        answers={fill.answers}
                        visibility={fill.visibility}
                        errors={{ ...serverErrors, ...fill.errors }}
                        files={fill.files}
                        onChange={fill.setAnswer}
                        onFiles={fill.setFiles}
                        people={people}
                        onImageClick={setPhoto}
                    />

                    <div className="rd-form__foot">
                        <button type="button" className="rd-btn rd-btn--quiet rd-btn--lg" onClick={onCancel}>
                            Cancel
                        </button>
                        <button type="submit" className="rd-btn rd-btn--primary rd-btn--lg" disabled={sending}>
                            {sending && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                            {submitLabel}
                        </button>
                    </div>
                </form>

                {aside && <aside className="rd-form-page__aside">{aside}</aside>}
            </div>

            <AssigneePicker people={people} />
            <ImageLightbox src={photo} onClose={() => setPhoto(null)} />
        </>
    );
}
