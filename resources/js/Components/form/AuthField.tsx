import clsx from 'clsx';
import type { InputHTMLAttributes } from 'react';

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    id: string;
    label: string;
    error?: string;
}

/** A full-size labelled input for the sign-in style pages. */
export default function AuthField({ id, label, error, className, ...props }: AuthFieldProps) {
    return (
        <div className="mb-3">
            <label className="form-label" htmlFor={id}>
                {label}
            </label>
            <input id={id} className={clsx('form-control', error && 'is-invalid', className)} {...props} />
            {error && (
                <span className="invalid-feedback" role="alert">
                    <strong>{error}</strong>
                </span>
            )}
        </div>
    );
}
