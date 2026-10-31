import { router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import AssigneePicker from '@/Components/forms/AssigneePicker';
import FormRenderer from '@/Components/forms/FormRenderer';
import Field from '@/Components/form/Field';
import SearchSelect from '@/Components/form/SearchSelect';
import TextInput from '@/Components/form/TextInput';
import { FormSection } from '@/Components/surface/FormSection';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import ImageLightbox from '@/Components/ui/ImageLightbox';
import { useFormFill } from '@/hooks/useFormFill';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { clearDraft, draftTime, readDraft, writeDraft, type FormDraft } from '@/lib/drafts';
import { focusField } from '@/lib/focus';
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
    /** Keep the answers as a draft in this browser under this key (lib/drafts.ts), and offer them back. */
    draftKey?: string;
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
    draftKey,
    aside,
}: SubmissionFormProps) {
    const { component, props } = usePage<PageProps>();
    const serverErrors = props.errors;
    const fill = useFormFill({ schema, initial: answers, deferredIds });
    const tree = useMemo(() => renderTree(schema), [schema]);
    const [title, setTitle] = useState(recordTitle ?? '');
    const [parent, setParent] = useState(parentId ? String(parentId) : '');
    const [sending, setSending] = useState(false);
    const [photo, setPhoto] = useState<string | null>(null);
    // A draft left from an earlier visit, offered until it is restored or discarded.
    const [offered, setOffered] = useState<FormDraft | null>(() => (draftKey ? readDraft(draftKey) : null));

    const started = useRef(JSON.stringify([answers, recordTitle ?? '', parentId ? String(parentId) : '']));
    const pickedFiles = Object.values(fill.files).some((picked) => picked.length > 0);
    const dirty = pickedFiles || JSON.stringify([fill.answers, title, parent]) !== started.current;

    useUnsavedChanges(dirty, undefined, { keptAsDraft: Boolean(draftKey) });

    // Keep what is typed as a draft (not the files) once it differs from the start,
    // but leave an offered draft alone until the user decides about it.
    useEffect(() => {
        if (!draftKey || offered || !dirty) return;
        writeDraft(draftKey, { answers: fill.answers, title, parent, savedAt: Date.now() });
    }, [draftKey, offered, dirty, fill.answers, title, parent]);

    const restore = (draft: FormDraft) => {
        Object.entries(draft.answers).forEach(([id, value]) => fill.setAnswer(id, value));
        setTitle(draft.title);
        setParent(draft.parent);
        setOffered(null);
    };

    const discard = () => {
        if (draftKey) clearDraft(draftKey);
        setOffered(null);
    };

    // Server errors are keyed by the field's element id; its control's id is "field-<id>".
    const fieldId = (key: string) =>
        schema.elements.some((element) => element.id === key) ? `field-${key}` : key.replace(/\./g, '-');

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const firstProblem = fill.validate();
        if (firstProblem) {
            focusField(`field-${firstProblem}`);
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
                // Sent once the response is another page; a refusal (a handler to pick) comes back here.
                onSuccess: (page) => {
                    if (draftKey && page.component !== component) clearDraft(draftKey);
                },
            },
        );
    };

    return (
        <>
            <ErrorSummary fieldId={fieldId} />

            {offered && (
                <div className="rd-notice form-fill__draft" role="status">
                    <i className="mdi mdi-content-save-outline" aria-hidden="true" />
                    <span className="form-fill__draft-text">
                        You have an unsent draft of this form from {draftTime(offered.savedAt)} on this device.
                    </span>
                    <span className="form-fill__draft-actions">
                        <button type="button" className="rd-btn rd-btn--quiet rd-btn--sm" onClick={discard}>
                            Discard
                        </button>
                        <button type="button" className="rd-btn rd-btn--sm" onClick={() => restore(offered)}>
                            Restore the draft
                        </button>
                    </span>
                </div>
            )}

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
