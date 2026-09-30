import { router, usePage } from '@inertiajs/react';
import { useMemo, useState, type FormEvent } from 'react';
import AssigneePicker from '@/Components/forms/AssigneePicker';
import FormRenderer from '@/Components/forms/FormRenderer';
import SearchSelect from '@/Components/form/SearchSelect';
import TextInput from '@/Components/form/TextInput';
import Button from '@/Components/ui/Button';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import ImageLightbox from '@/Components/ui/ImageLightbox';
import { useFormFill } from '@/hooks/useFormFill';
import { renderTree } from '@/lib/forms/schema';
import type { PageProps } from '@/types';
import type { Answers, CaseLink, FormSchema, Person } from '@/types/forms';

interface SubmissionFormProps {
    form: { id: number; name: string; description: string | null };
    schema: FormSchema;
    answers: Answers;
    deferredIds: string[];
    people: Person[];
    /** Where the answers are posted. */
    action: string;
    /** Fields posted alongside the answers (form_id on a new submission). */
    extra?: Record<string, string | number>;
    recordTitle?: string | null;
    /** Cases this one may follow up on; empty hides the picker. */
    parentOptions?: CaseLink[];
    parentId?: number | null;
    /** The case this follows up on, fixed (when editing). */
    parentCase?: CaseLink | null;
    submitLabel: string;
    onCancel: () => void;
}

/** Fill in a form: case title, follow-up link, and the fields, posted with attachments. */
export default function SubmissionForm({
    form,
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
        <div className="card">
            <div className="card-body p-3 p-md-4">
                {form.description && <p className="text-muted mb-4">{form.description}</p>}

                {deferredIds.length > 0 && (
                    <div className="alert alert-info py-2 px-3 small">
                        <i className="mdi mdi-account-multiple-outline me-1" />
                        Some sections of this form are completed by other participants after you submit.
                    </div>
                )}

                <ErrorSummary />

                <form onSubmit={submit} noValidate>
                    <div className="row g-3 mb-3">
                        <div className="col-12 col-md-6">
                            <label className="form-label fw-bold" htmlFor="record_title">
                                Case title
                            </label>
                            <TextInput
                                id="record_title"
                                large
                                maxLength={255}
                                placeholder="e.g. Acme Sdn Bhd – CNC-220 coolant leak"
                                invalid={!!serverErrors.record_title}
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                            />
                            <div className="form-text small">Optional — how people will find this case later.</div>
                        </div>

                        {parentOptions.length > 0 && (
                            <div className="col-12 col-md-6">
                                <label className="form-label fw-bold" htmlFor="parent_submission_id">
                                    Follows up on
                                </label>
                                <SearchSelect
                                    id="parent_submission_id"
                                    placeholder="Not a follow-up"
                                    invalid={!!serverErrors.parent_submission_id}
                                    options={parentOptions.map((option) => ({
                                        value: option.id,
                                        label: `${option.reference} — ${option.title}${option.open ? '' : ' (closed)'}`,
                                    }))}
                                    value={parent}
                                    onChange={setParent}
                                />
                                {serverErrors.parent_submission_id && (
                                    <div className="invalid-feedback d-block">{serverErrors.parent_submission_id}</div>
                                )}
                                <div className="form-text small">
                                    Leave empty unless this is a return visit on an earlier case.
                                </div>
                            </div>
                        )}

                        {parentCase && (
                            <div className="col-12 col-md-6">
                                <div className="form-label fw-bold">Follows up on</div>
                                <div className="small">
                                    <i className="mdi mdi-subdirectory-arrow-right me-1" />
                                    {parentCase.reference} — {parentCase.title}
                                </div>
                            </div>
                        )}
                    </div>

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

                    <div className="text-center mt-4">
                        <Button variant="secondary" className="me-2 mb-2 mb-sm-0" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button type="submit" className="mb-2 mb-sm-0" loading={sending}>
                            {submitLabel}
                        </Button>
                    </div>
                </form>
            </div>

            <AssigneePicker people={people} />
            <ImageLightbox src={photo} onClose={() => setPhoto(null)} />
        </div>
    );
}
