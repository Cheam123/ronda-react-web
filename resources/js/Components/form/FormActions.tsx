import type { ReactNode } from 'react';
import Button, { ButtonLink } from '@/Components/ui/Button';

interface FormActionsProps {
    /** Where "Back" goes. */
    backHref: string;
    /** Show a submit button; leave out on read-only pages. */
    submitLabel?: string;
    processing?: boolean;
    /** Extra buttons before Back. */
    children?: ReactNode;
}

/** Back / Save pinned to the bottom-right corner of long forms. */
export default function FormActions({ backHref, submitLabel, processing = false, children }: FormActionsProps) {
    return (
        <div className="form-actions-float">
            {children}
            <ButtonLink href={backHref} variant={submitLabel ? 'light' : 'primary'} className="action-button">
                Back
            </ButtonLink>
            {submitLabel && (
                <Button type="submit" className="action-button" loading={processing}>
                    {submitLabel}
                </Button>
            )}
        </div>
    );
}
