import clsx from 'clsx';
import type { ReactNode } from 'react';

interface FieldProps {
    label: ReactNode;
    htmlFor?: string;
    required?: boolean;
    error?: string;
    /** Muted help text under the control; an error takes its place. */
    hint?: ReactNode;
    className?: string;
    children: ReactNode;
}

/** A labelled form control with its hint or validation message under it. */
export default function Field({ label, htmlFor, required = false, error, hint, className, children }: FieldProps) {
    return (
        <div className={clsx('form-field rd-field', error && 'has-error', className)}>
            <label htmlFor={htmlFor} className="rd-field__label">
                {label}
                {required && (
                    <span className="rd-field__required" aria-hidden="true">
                        {' '}
                        *
                    </span>
                )}
            </label>
            {children}
            {error ? (
                <span className="rd-field__error" id={htmlFor ? `${htmlFor}-error` : undefined} role="alert">
                    <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                    {error}
                </span>
            ) : (
                hint && <span className="rd-field__hint">{hint}</span>
            )}
        </div>
    );
}
