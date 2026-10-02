import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { SelectOption } from '@/types';

interface ChoicesProps {
    /** The question ("Size"); the group's legend. */
    legend: ReactNode;
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    /** Let a second tap on the chosen pill clear it. */
    clearable?: boolean;
    error?: string;
    hint?: ReactNode;
    disabled?: boolean;
}

/** A short list of answers as pills (size, segment, gender). */
export function Choices({
    legend,
    options,
    value,
    onChange,
    required = false,
    clearable = !required,
    error,
    hint,
    disabled,
}: ChoicesProps) {
    return (
        <fieldset className={clsx('rd-fieldset', error && 'has-error')}>
            <legend className="rd-field__label">
                {legend}
                {required && (
                    <span className="rd-field__required" aria-hidden="true">
                        {' '}
                        *
                    </span>
                )}
            </legend>
            <div className="rd-choices">
                {options.map((option) => {
                    const chosen = String(option.value) === value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            className="rd-choice"
                            aria-pressed={chosen}
                            disabled={disabled}
                            onClick={() => onChange(chosen && clearable ? '' : String(option.value))}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
            {error ? (
                <span className="rd-field__error" role="alert">
                    <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                    {error}
                </span>
            ) : (
                hint && <span className="rd-field__hint">{hint}</span>
            )}
        </fieldset>
    );
}

export interface CardOption {
    value: string;
    label: string;
    description: ReactNode;
}

interface RadioCardsProps {
    legend: ReactNode;
    /** The radios' name. */
    name: string;
    options: CardOption[];
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    error?: string;
}

/** A choice where each answer needs a line of explanation (user type). */
export function RadioCards({ legend, name, options, value, onChange, required = false, error }: RadioCardsProps) {
    return (
        <fieldset className={clsx('rd-fieldset', error && 'has-error')}>
            <legend className="rd-field__label">
                {legend}
                {required && (
                    <span className="rd-field__required" aria-hidden="true">
                        {' '}
                        *
                    </span>
                )}
            </legend>
            <div className="rd-radio-cards">
                {options.map((option) => (
                    <label key={option.value} className="rd-radio-card">
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={value === option.value}
                            onChange={() => onChange(option.value)}
                        />
                        <span className="rd-radio-card__text">
                            <span className="rd-radio-card__label">{option.label}</span>
                            <span className="rd-radio-card__description">{option.description}</span>
                        </span>
                    </label>
                ))}
            </div>
            {error && (
                <span className="rd-field__error" role="alert">
                    <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                    {error}
                </span>
            )}
        </fieldset>
    );
}
