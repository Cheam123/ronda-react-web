import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface SegmentedOption<V extends string> {
    value: V;
    label: ReactNode;
}

interface SegmentedProps<V extends string> {
    /** Names the group for screen readers ("Status", "Show"). */
    label: string;
    options: SegmentedOption<V>[];
    value: V;
    onChange: (value: V) => void;
    className?: string;
}

/** A few mutually exclusive choices as pressed / unpressed buttons. */
export default function Segmented<V extends string>({ label, options, value, onChange, className }: SegmentedProps<V>) {
    return (
        <div role="group" aria-label={label} className={clsx('rd-seg', className)}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    className="rd-seg__btn"
                    aria-pressed={option.value === value}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
