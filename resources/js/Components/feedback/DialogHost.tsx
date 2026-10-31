import clsx from 'clsx';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Field from '@/Components/form/Field';
import PasswordInput from '@/Components/form/PasswordInput';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import Dialog from '@/Components/surface/Dialog';
import {
    registerDialogHost,
    type ConfirmOptions,
    type DialogIcon,
    type DialogRequest,
    type PromptOptions,
} from '@/lib/dialogs';

const ICONS: Record<DialogIcon, { icon: string; tone: 'good' | 'serious' | 'critical' | 'neutral' }> = {
    question: { icon: 'mdi-help-circle-outline', tone: 'neutral' },
    warning: { icon: 'mdi-alert-outline', tone: 'serious' },
    error: { icon: 'mdi-alert-circle-outline', tone: 'critical' },
    success: { icon: 'mdi-check', tone: 'good' },
    info: { icon: 'mdi-information-outline', tone: 'neutral' },
};

let nextId = 1;

/**
 * Draws the confirm() and prompt() requests from lib/dialogs.ts, one at a
 * time, as surface Dialogs. Mounted once, beside the page.
 */
export default function DialogHost() {
    const [queue, setQueue] = useState<{ id: number; request: DialogRequest }[]>([]);
    // The answered dialog keeps its content while it animates closed.
    const [closing, setClosing] = useState(false);

    useEffect(
        () => registerDialogHost((request) => setQueue((current) => [...current, { id: nextId++, request }])),
        [],
    );

    if (queue.length === 0) return null;
    const { id, request: current } = queue[0];

    const answer = (resolve: () => void) => {
        if (closing) return;
        resolve();
        setClosing(true);
    };

    const next = () => {
        setQueue((items) => items.slice(1));
        setClosing(false);
    };

    return current.kind === 'confirm' ? (
        <ConfirmDialog
            key={id}
            options={current.options}
            show={!closing}
            onAnswer={(confirmed) => answer(() => current.resolve(confirmed))}
            onExited={next}
        />
    ) : (
        <PromptDialog
            key={id}
            options={current.options}
            show={!closing}
            onAnswer={(value) => answer(() => current.resolve(value))}
            onExited={next}
        />
    );
}

interface ConfirmDialogProps {
    options: ConfirmOptions;
    show: boolean;
    onAnswer: (confirmed: boolean) => void;
    onExited: () => void;
}

function ConfirmDialog({ options, show, onAnswer, onExited }: ConfirmDialogProps) {
    const {
        title,
        text,
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        icon = options.danger ? 'warning' : 'question',
        danger = false,
        safeCancel = false,
    } = options;
    const cancelRef = useRef<HTMLButtonElement>(null);
    const confirmRef = useRef<HTMLButtonElement>(null);
    const look = ICONS[icon];

    const cancelButton = (
        <button
            ref={cancelRef}
            type="button"
            className={clsx('rd-btn', safeCancel ? 'rd-btn--primary' : 'rd-btn--quiet')}
            onClick={() => onAnswer(false)}
        >
            {cancelText}
        </button>
    );
    const confirmButton = (
        <button
            ref={confirmRef}
            type="button"
            className={clsx(
                'rd-btn',
                safeCancel ? 'rd-btn--danger-soft' : danger ? 'rd-btn--danger' : 'rd-btn--primary',
            )}
            onClick={() => onAnswer(true)}
        >
            {confirmText}
        </button>
    );

    return (
        <Dialog
            show={show}
            onHide={() => onAnswer(false)}
            onEntered={() => (danger || safeCancel ? cancelRef : confirmRef).current?.focus()}
            onExited={onExited}
            title={title}
            text={text}
            icon={look.icon}
            tone={danger ? 'critical' : look.tone}
            // The primary button goes last: Cancel then Delete, or Leave then Keep editing.
            footer={
                safeCancel ? (
                    <>
                        {confirmButton}
                        {cancelButton}
                    </>
                ) : (
                    <>
                        {cancelButton}
                        {confirmButton}
                    </>
                )
            }
        />
    );
}

interface PromptDialogProps {
    options: PromptOptions;
    show: boolean;
    onAnswer: (value: string | null) => void;
    onExited: () => void;
}

function PromptDialog({ options, show, onAnswer, onExited }: PromptDialogProps) {
    const {
        title,
        text,
        inputLabel,
        inputPlaceholder,
        inputValue = '',
        inputType = 'text',
        confirmText = 'Submit',
        required = false,
        minLength,
        maxLength,
    } = options;
    const [value, setValue] = useState(inputValue);
    const [error, setError] = useState<string | undefined>();
    const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
    const id = 'rd-prompt-input';

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const trimmed = value.trim();
        if (required && trimmed === '') {
            setError(required);
        } else if (minLength && trimmed !== '' && trimmed.length < minLength) {
            setError(`Use at least ${minLength} characters.`);
        } else {
            onAnswer(value);
            return;
        }
        inputRef.current?.focus();
    };

    const change = (next: string) => {
        setValue(next);
        if (error) setError(undefined);
    };

    const control =
        inputType === 'textarea' ? (
            <TextArea
                id={id}
                ref={inputRef}
                rows={4}
                placeholder={inputPlaceholder}
                maxLength={maxLength}
                value={value}
                onChange={(event) => change(event.target.value)}
            />
        ) : inputType === 'password' ? (
            <PasswordInput
                id={id}
                ref={inputRef}
                autoComplete="new-password"
                placeholder={inputPlaceholder}
                minLength={minLength}
                maxLength={maxLength}
                value={value}
                onChange={(event) => change(event.target.value)}
            />
        ) : (
            <TextInput
                id={id}
                ref={inputRef}
                large
                placeholder={inputPlaceholder}
                minLength={minLength}
                maxLength={maxLength}
                value={value}
                onChange={(event) => change(event.target.value)}
            />
        );

    const hint = [
        maxLength && inputType === 'textarea' ? `${value.length} / ${maxLength}` : null,
        minLength && maxLength && inputType !== 'textarea' ? `${minLength} to ${maxLength} characters.` : null,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <Dialog
            show={show}
            onHide={() => onAnswer(null)}
            onEntered={() => inputRef.current?.focus()}
            onExited={onExited}
            onSubmit={submit}
            title={title}
            text={text}
            footer={
                <>
                    <button type="button" className="rd-btn rd-btn--quiet" onClick={() => onAnswer(null)}>
                        Cancel
                    </button>
                    <button type="submit" className="rd-btn rd-btn--primary">
                        {confirmText}
                    </button>
                </>
            }
        >
            <Field
                label={inputLabel ?? <span className="visually-hidden">{title}</span>}
                htmlFor={id}
                required={Boolean(required) && Boolean(inputLabel)}
                error={error}
                hint={hint || undefined}
            >
                {control}
            </Field>
        </Dialog>
    );
}
