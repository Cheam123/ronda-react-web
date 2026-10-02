import clsx from 'clsx';
import ReactSelect, { type GroupBase, type Props as ReactSelectProps, type StylesConfig } from 'react-select';
import type { SelectOption } from '@/types';
import type { OptionGroup } from './Select';

type Value = string | number;

const styles: StylesConfig<SelectOption, boolean, GroupBase<SelectOption>> = {
    // Menus render into <body> so table cells and cards never clip them.
    menuPortal: (base) => ({ ...base, zIndex: 1100 }),
};

interface BaseProps {
    options: SelectOption[];
    /** Options under headings (products by category), after `options`. */
    groups?: OptionGroup[];
    placeholder?: string;
    id?: string;
    name?: string;
    /** Names a select that has no visible label (a toolbar filter). */
    ariaLabel?: string;
    invalid?: boolean;
    disabled?: boolean;
    clearable?: boolean;
    /** Hide the search box for short lists. */
    searchable?: boolean;
    /** The 40px toolbar size instead of the 44px form size. */
    compact?: boolean;
    className?: string;
}

function commonProps({
    options,
    groups = [],
    placeholder,
    id,
    name,
    ariaLabel,
    invalid,
    disabled,
    clearable = true,
    searchable = true,
    compact = false,
    className,
}: BaseProps): Partial<ReactSelectProps<SelectOption, boolean>> {
    return {
        options: [...options, ...groups],
        placeholder: placeholder ?? '-- Select --',
        inputId: id,
        name,
        'aria-label': ariaLabel,
        isDisabled: disabled,
        isClearable: clearable,
        isSearchable: searchable,
        isOptionDisabled: (option) => Boolean(option.disabled),
        className: clsx('search-select', compact && 'search-select--compact', invalid && 'is-invalid', className),
        classNamePrefix: 'rs',
        menuPortalTarget: typeof document !== 'undefined' ? document.body : undefined,
        styles,
    };
}

/** Every option, the grouped ones included. */
const allOptions = ({ options, groups = [] }: BaseProps) => [...options, ...groups.flatMap((group) => group.options)];

interface SearchSelectProps extends BaseProps {
    value: Value | null | undefined;
    /** Called with the chosen option's value, or '' when cleared. */
    onChange: (value: string) => void;
}

/**
 * A single select drawn in the surface look, searchable unless told not to
 * (what select2 used to do). Used for every dropdown, native ones included:
 * a filter's "All ..." is an option whose value is ''.
 */
export default function SearchSelect({ value, onChange, ...props }: SearchSelectProps) {
    const selected = allOptions(props).find((option) => String(option.value) === String(value ?? '')) ?? null;

    return (
        <ReactSelect<SelectOption, false>
            {...(commonProps(props) as ReactSelectProps<SelectOption, false>)}
            value={selected}
            onChange={(option) => onChange(option ? String(option.value) : '')}
        />
    );
}

interface MultiSearchSelectProps extends BaseProps {
    value: Value[];
    onChange: (values: string[]) => void;
}

/** A searchable multi select with removable chips. */
export function MultiSearchSelect({ value, onChange, ...props }: MultiSearchSelectProps) {
    const wanted = new Set(value.map(String));
    const selected = allOptions(props).filter((option) => wanted.has(String(option.value)));

    return (
        <ReactSelect<SelectOption, true>
            {...(commonProps(props) as ReactSelectProps<SelectOption, true>)}
            isMulti
            closeMenuOnSelect={false}
            value={selected}
            onChange={(options) => onChange(options.map((option) => String(option.value)))}
        />
    );
}
