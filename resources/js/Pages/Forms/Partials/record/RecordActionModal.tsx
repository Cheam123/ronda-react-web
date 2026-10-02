import { router, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import Field from '@/Components/form/Field';
import TextArea from '@/Components/form/TextArea';
import Dialog from '@/Components/surface/Dialog';
import type { PageProps } from '@/types';

interface RecordActionModalProps {
    show: boolean;
    onHide: () => void;
    /** Where the action posts. */
    action: string;
    icon: string;
    tone: 'good' | 'critical' | 'neutral';
    title: string;
    children: ReactNode;
    /** Ask for a remark; `required` holds the message shown when it is missing. */
    remark?: { label: string; placeholder: string; required?: string };
    confirmLabel: string;
    /** The confirm button: the page's main action, or a destructive one. */
    danger?: boolean;
    cancelLabel?: string;
}

/** Confirm an action on a record (approve, reject, close, cancel), with an optional remark. */
export default function RecordActionModal({
    show,
    onHide,
    action,
    icon,
    tone,
    title,
    children,
    remark,
    confirmLabel,
    danger = false,
    cancelLabel = 'Cancel',
}: RecordActionModalProps) {
    const [text, setText] = useState('');
    const [invalid, setInvalid] = useState(false);
    const [sending, setSending] = useState(false);
    const serverError = usePage<PageProps>().props.errors.remark;

    useEffect(() => {
        if (show) {
            setText('');
            setInvalid(false);
        }
    }, [show]);

    const submit = () => {
        if (remark?.required && !text.trim()) {
            setInvalid(true);
            return;
        }
        router.post(action, remark ? { remark: text } : {}, {
            // A refused remark keeps the dialog open with what was typed.
            preserveState: 'errors',
            preserveScroll: true,
            onStart: () => setSending(true),
            onFinish: () => setSending(false),
            onSuccess: onHide,
        });
    };

    return (
        <Dialog
            show={show}
            onHide={onHide}
            title={title}
            text={children}
            icon={icon}
            tone={tone}
            footer={
                <>
                    <button type="button" className="rd-btn rd-btn--lg" onClick={onHide}>
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={clsx('rd-btn rd-btn--lg', danger ? 'rd-btn--danger' : 'rd-btn--primary')}
                        disabled={sending}
                        onClick={submit}
                    >
                        {sending && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                        {confirmLabel}
                    </button>
                </>
            }
        >
            {remark && (
                <Field
                    label={remark.label}
                    htmlFor="record-remark"
                    required={Boolean(remark.required)}
                    error={invalid ? remark.required : serverError}
                >
                    <TextArea
                        id="record-remark"
                        rows={3}
                        placeholder={remark.placeholder}
                        invalid={invalid || Boolean(serverError)}
                        value={text}
                        onChange={(event) => {
                            setText(event.target.value);
                            setInvalid(false);
                        }}
                    />
                </Field>
            )}
        </Dialog>
    );
}
