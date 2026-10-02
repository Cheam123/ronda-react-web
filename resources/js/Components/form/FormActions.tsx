import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

interface FormActionsProps {
    /** Where "Back" goes. */
    backHref: string;
    /** Show a submit button; leave out on read-only pages. */
    submitLabel?: string;
    processing?: boolean;
    /** Extra buttons before Back. */
    children?: ReactNode;
}

/** Back / Save floating at the foot of the window on long forms that have no FormFoot. */
export default function FormActions({ backHref, submitLabel, processing = false, children }: FormActionsProps) {
    return (
        <div className="form-actions-float">
            {children}
            <Link href={backHref} className={submitLabel ? 'rd-btn rd-btn--lg rd-btn--quiet' : 'rd-btn rd-btn--lg'}>
                Back
            </Link>
            {submitLabel && (
                <button type="submit" className="rd-btn rd-btn--lg rd-btn--primary" disabled={processing}>
                    {processing && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                    {submitLabel}
                </button>
            )}
        </div>
    );
}
