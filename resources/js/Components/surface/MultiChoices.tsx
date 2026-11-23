import clsx from 'clsx';
import { useId, type ReactNode } from 'react';
import { describedBy } from '@/Components/form/Field';
import type { SelectOption } from '@/types';

interface MultiChoicesProps {
    legend: ReactNode;
    options: SelectOption[];
    value: string[];
    onChange: (value: string[]) => void;
    hint?: ReactNode;
    error?: string;
}

/** A short list of answers where several can be chosen, as pills. The many-answer twin of Choices. */
export function MultiChoices({ legend, options, value, onChange, hint, error }: MultiChoicesProps) {
    const id = useId();

    return (
        <fieldset
            className={clsx('rd-fieldset', error && 'has-error')}
            aria-describedby={describedBy(error ? `${id}-error` : hint ? `${id}-hint` : undefined)}
        >
            <legend className="rd-field__label">{legend}</legend>
            <div className="rd-choices">
                {options.map((option) => {
                    const key = String(option.value);
                    const chosen = value.includes(key);

                    return (
                        <button
                            key={key}
                            type="button"
                            className="rd-choice"
                            aria-pressed={chosen}
                            onClick={() => onChange(chosen ? value.filter((other) => other !== key) : [...value, key])}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
            {error ? (
                <span className="rd-field__error" id={`${id}-error`}>
                    {error}
                </span>
            ) : (
                hint && (
                    <span className="rd-field__hint" id={`${id}-hint`}>
                        {hint}
                    </span>
                )
            )}
        </fieldset>
    );
}
