import { usePage } from '@inertiajs/react';
import { pluralize } from '@/lib/format';
import type { PageProps } from '@/types';

interface ErrorSummaryProps {
    /** Defaults to the validation errors of the current response. */
    errors?: Record<string, string>;
}

/** Every validation error in one box at the top of a form, each linking to its field. */
export default function ErrorSummary({ errors }: ErrorSummaryProps) {
    const pageErrors = usePage<PageProps>().props.errors;
    const entries = Object.entries(errors ?? pageErrors);

    if (entries.length === 0) {
        return null;
    }

    return (
        <div className="rd-errors" role="alert">
            <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
            <div>
                <p className="rd-errors__title">{pluralize(entries.length, 'thing')} to fix before saving</p>
                <ul className="rd-errors__list">
                    {entries.map(([field, message]) => (
                        <li key={field}>
                            <a href={`#${field}`}>{message}</a>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
