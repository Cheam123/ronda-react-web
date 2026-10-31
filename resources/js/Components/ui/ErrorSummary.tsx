import { usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { focusField } from '@/lib/focus';
import { pluralize } from '@/lib/format';
import type { PageProps } from '@/types';

interface ErrorSummaryProps {
    /** Defaults to the validation errors of the current response. */
    errors?: Record<string, string>;
    /** The id of the field an error key belongs to; by default the key with dots as dashes ("lines-0-quantity"). */
    fieldId?: (key: string) => string;
}

const defaultFieldId = (key: string) => key.replace(/\./g, '-');

/**
 * Every validation error in one box at the top of a form, each linking to
 * its field. It takes focus when a response brings errors, so keyboard and
 * screen-reader users land on it rather than on the button they pressed.
 */
export default function ErrorSummary({ errors, fieldId = defaultFieldId }: ErrorSummaryProps) {
    const pageErrors = usePage<PageProps>().props.errors;
    const source = errors ?? pageErrors;
    const entries = Object.entries(source);
    const box = useRef<HTMLDivElement>(null);
    const count = entries.length;

    // Each response brings a fresh errors object, so this runs once per refusal.
    useEffect(() => {
        if (count > 0) {
            box.current?.focus();
        }
    }, [source, count]);

    if (count === 0) {
        return null;
    }

    return (
        <div ref={box} className="rd-errors" tabIndex={-1} aria-labelledby="rd-errors-title">
            <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
            <div>
                <p id="rd-errors-title" className="rd-errors__title">
                    {pluralize(count, 'thing')} to fix before saving
                </p>
                <ul className="rd-errors__list">
                    {entries.map(([key, message]) => {
                        const id = fieldId(key);

                        return (
                            <li key={key}>
                                <a
                                    href={`#${id}`}
                                    onClick={(event) => {
                                        if (focusField(id)) event.preventDefault();
                                    }}
                                >
                                    {message}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
