import clsx from 'clsx';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import type { SelectOption } from '@/types';

export interface OptionGroup {
    label: string;
    options: SelectOption[];
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
    options?: SelectOption[];
    /** Rendered as <optgroup>s after `options`. */
    groups?: OptionGroup[];
    /** A first, empty option ("-- Select Area --"). */
    placeholder?: string;
    invalid?: boolean;
}

/** A native select. Use SearchSelect when the list is long enough to need typing. */
const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
    { options = [], groups = [], placeholder, invalid = false, className, ...props },
    ref,
) {
    return (
        <select
            ref={ref}
            className={clsx('form-select form-select-sm custom-font-small', invalid && 'is-invalid', className)}
            {...props}
        >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
            {groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
});

export default Select;
