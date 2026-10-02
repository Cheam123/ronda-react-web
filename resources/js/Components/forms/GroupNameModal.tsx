import { useEffect, useState, type FormEvent } from 'react';
import Field from '@/Components/form/Field';
import TextInput from '@/Components/form/TextInput';
import Dialog from '@/Components/surface/Dialog';
import { errorMessage, postJson } from '@/lib/http';
import type { FormGroupOption } from '@/types/forms';

interface GroupReply {
    status: 'ok' | 'error';
    message: string;
    group?: FormGroupOption;
}

interface GroupNameModalProps {
    show: boolean;
    onHide: () => void;
    /** Where the name is posted: form.groups.store or form.groups.update. */
    action: string;
    title: string;
    submitLabel: string;
    initialName?: string;
    /** Help text under the input. */
    hint?: string;
    /** Names already taken, shown so a near-duplicate is easy to spot. */
    existing?: string[];
    onSaved: (reply: { message: string; group?: FormGroupOption }) => void;
}

/**
 * Name a form group, to create or rename it. A duplicate name keeps the
 * dialog open with the text intact, so it can be edited rather than retyped.
 */
export default function GroupNameModal({
    show,
    onHide,
    action,
    title,
    submitLabel,
    initialName = '',
    hint,
    existing = [],
    onSaved,
}: GroupNameModalProps) {
    const [name, setName] = useState(initialName);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (show) {
            setName(initialName);
            setError(null);
        }
    }, [show, initialName]);

    const submit = async (event?: FormEvent) => {
        event?.preventDefault();
        if (!name.trim()) {
            setError('Give the group a name.');
            return;
        }

        setSaving(true);
        try {
            const reply = await postJson<GroupReply>(action, { name: name.trim() });
            onSaved({ message: reply.message, group: reply.group });
        } catch (reason) {
            setError(errorMessage(reason, 'The group could not be saved.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            show={show}
            onHide={onHide}
            title={title}
            icon="mdi-folder-outline"
            tone="neutral"
            footer={
                <>
                    <button type="button" className="rd-btn rd-btn--lg" onClick={onHide}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="rd-btn rd-btn--primary rd-btn--lg"
                        disabled={saving}
                        onClick={() => submit()}
                    >
                        {saving && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                        {submitLabel}
                    </button>
                </>
            }
        >
            <form onSubmit={submit}>
                <Field label="Group name" htmlFor="group-name" required error={error ?? undefined} hint={hint}>
                    <TextInput
                        id="group-name"
                        large
                        maxLength={120}
                        placeholder="e.g. Outlet visits, Requests, Staff"
                        invalid={!!error}
                        autoFocus
                        value={name}
                        onChange={(event) => {
                            setName(event.target.value);
                            setError(null);
                        }}
                    />
                </Field>
            </form>
            {existing.length > 0 && (
                <div className="rd-dialog__box">
                    <span className="rd-label">Already in use</span>
                    <div className="rd-choices">
                        {existing.map((existingName) => (
                            <span key={existingName} className="rd-chip">
                                {existingName}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </Dialog>
    );
}
