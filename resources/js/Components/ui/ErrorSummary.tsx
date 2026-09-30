import { usePage } from '@inertiajs/react';
import type { PageProps } from '@/types';

interface ErrorSummaryProps {
    /** Defaults to the validation errors of the current response. */
    errors?: Record<string, string>;
}

/** Every validation error in one box at the top of a form. */
export default function ErrorSummary({ errors }: ErrorSummaryProps) {
    const pageErrors = usePage<PageProps>().props.errors;
    const messages = Object.values(errors ?? pageErrors);

    if (messages.length === 0) {
        return null;
    }

    return (
        <div className="alert alert-danger" role="alert">
            <ul className="mb-0">
                {messages.map((message, index) => (
                    <li key={index}>{message}</li>
                ))}
            </ul>
        </div>
    );
}
