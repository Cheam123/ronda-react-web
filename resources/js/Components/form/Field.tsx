import clsx from 'clsx';
import type { ReactNode } from 'react';

interface FieldProps {
    label: ReactNode;
    htmlFor?: string;
    required?: boolean;
    error?: string;
    /** Muted help text under the control. */
    hint?: ReactNode;
    className?: string;
    children: ReactNode;
}

/** A labelled form control with its validation message. */
export default function Field({ label, htmlFor, required = false, error, hint, className, children }: FieldProps) {
    return (
        <div className={clsx('form-field', className)}>
            <label htmlFor={htmlFor} className="form-field__label custom-font-xsmall">
                <b>{label}</b> :{required && <span className="form-field__required">*</span>}
            </label>
            {error && (
                <span className="text-danger ms-1">
                    <i className="fas fa-exclamation-triangle me-1" />
                    {error}
                </span>
            )}
            {children}
            {hint && <div className="custom-font-xxsmall text-muted mt-1">{hint}</div>}
        </div>
    );
}
