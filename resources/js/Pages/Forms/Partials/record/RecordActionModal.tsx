import { router, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import BootstrapModal from 'react-bootstrap/Modal';
import Button, { type ButtonVariant } from '@/Components/ui/Button';
import type { PageProps } from '@/types';

interface RecordActionModalProps {
    show: boolean;
    onHide: () => void;
    /** Where the action posts. */
    action: string;
    icon: string;
    tone: 'success' | 'danger';
    title: string;
    children: ReactNode;
    /** Ask for a remark; `required` holds the message shown when it is missing. */
    remark?: { label: string; placeholder: string; required?: string };
    confirmLabel: ReactNode;
    confirmVariant: ButtonVariant;
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
    confirmVariant,
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
        <BootstrapModal show={show} onHide={onHide} centered contentClassName="rs-modal">
            <BootstrapModal.Body>
                <div className={clsx('rs-modal-icon', `rs-modal-icon--${tone}`)}>
                    <i className={`mdi ${icon}`} />
                </div>
                <div className="rs-modal-title">{title}</div>
                <div className="rs-modal-desc">{children}</div>
                {remark && (
                    <div className="mt-3">
                        <label className="form-label small fw-semibold" htmlFor="record-remark">
                            {remark.label}
                        </label>
                        <textarea
                            id="record-remark"
                            className={clsx('form-control', (invalid || serverError) && 'is-invalid')}
                            rows={3}
                            placeholder={remark.placeholder}
                            value={text}
                            onChange={(event) => {
                                setText(event.target.value);
                                setInvalid(false);
                            }}
                        />
                        {(invalid || serverError) && (
                            <div className="invalid-feedback">{invalid ? remark.required : serverError}</div>
                        )}
                    </div>
                )}
            </BootstrapModal.Body>
            <BootstrapModal.Footer>
                <Button variant="light" shadow={false} onClick={onHide}>
                    {cancelLabel}
                </Button>
                <Button variant={confirmVariant} shadow={false} loading={sending} onClick={submit}>
                    {confirmLabel}
                </Button>
            </BootstrapModal.Footer>
        </BootstrapModal>
    );
}
