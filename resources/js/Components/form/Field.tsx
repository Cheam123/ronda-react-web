import clsx from 'clsx';
import { createContext, useContext, useId, useMemo, type ReactNode } from 'react';

/** What a Field tells the control inside it: which text describes it, and whether it is in error. */
export interface FieldState {
    /** Ids for aria-describedby: the error when there is one, else the hint. */
    describedBy?: string;
    invalid: boolean;
    /** The error message's id, for aria-errormessage. */
    errorId?: string;
}

const NO_FIELD: FieldState = { invalid: false };

const FieldContext = createContext<FieldState>(NO_FIELD);

/** The surrounding Field's hint and error, for TextInput, TextArea, SearchSelect and PhoneInput. */
export const useField = () => useContext(FieldContext);

/** Provides a hint or error id to a control that sits outside a Field (a fieldset, a table cell). */
export const FieldProvider = FieldContext.Provider;

/** aria-describedby from a list of ids, skipping the empty ones. */
export function describedBy(...ids: (string | false | null | undefined)[]): string | undefined {
    return ids.filter(Boolean).join(' ') || undefined;
}

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

/** A labelled form control with its hint or validation message under it, both tied to the control. */
export default function Field({ label, htmlFor, required = false, error, hint, className, children }: FieldProps) {
    const fallbackId = useId();
    const base = htmlFor ?? fallbackId;
    const errorId = `${base}-error`;
    const hintId = `${base}-hint`;
    const hasHint = Boolean(hint);

    const state = useMemo<FieldState>(
        () => ({
            describedBy: error ? errorId : hasHint ? hintId : undefined,
            invalid: Boolean(error),
            errorId: error ? errorId : undefined,
        }),
        [error, errorId, hasHint, hintId],
    );

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
            <FieldContext.Provider value={state}>{children}</FieldContext.Provider>
            {error ? (
                <span className="rd-field__error" id={errorId} role="alert">
                    <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                    {error}
                </span>
            ) : (
                hint && (
                    <span className="rd-field__hint" id={hintId}>
                        {hint}
                    </span>
                )
            )}
        </div>
    );
}
