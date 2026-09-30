import { useEffect, useState, type FormEvent } from 'react';
import TextInput from '@/Components/form/TextInput';
import Button from '@/Components/ui/Button';
import Modal from '@/Components/ui/Modal';
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
            setError('A group name is required.');
            return;
        }

        setSaving(true);
        try {
            const reply = await postJson<GroupReply>(action, { name: name.trim() });
            onSaved({ message: reply.message, group: reply.group });
        } catch (reason) {
            setError(errorMessage(reason, 'Could not save the group.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            title={title}
            footer={
                <>
                    <Button variant="light" onClick={onHide}>
                        Cancel
                    </Button>
                    <Button loading={saving} onClick={() => submit()}>
                        {submitLabel}
                    </Button>
                </>
            }
        >
            <form onSubmit={submit}>
                <label className="form-label small fw-semibold" htmlFor="group-name">
                    Group name <span className="text-danger">*</span>
                </label>
                <TextInput
                    id="group-name"
                    large
                    maxLength={120}
                    placeholder="e.g. Reports, Sales, Claims"
                    invalid={!!error}
                    autoFocus
                    value={name}
                    onChange={(event) => {
                        setName(event.target.value);
                        setError(null);
                    }}
                />
                {error && <div className="invalid-feedback d-block">{error}</div>}
                {hint && <div className="form-text">{hint}</div>}
            </form>
            {existing.length > 0 && (
                <div className="group-chips">
                    <div className="group-chips__label">Already in use</div>
                    <div className="group-chips__list">
                        {existing.map((existingName) => (
                            <span key={existingName} className="group-chips__chip">
                                {existingName}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </Modal>
    );
}
