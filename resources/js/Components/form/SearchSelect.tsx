import clsx from 'clsx';
import ReactSelect, { type GroupBase, type Props as ReactSelectProps, type StylesConfig } from 'react-select';
import type { SelectOption } from '@/types';

type Value = string | number;

const styles: StylesConfig<SelectOption, boolean, GroupBase<SelectOption>> = {
    // Menus render into <body> so table cells and cards never clip them.
    menuPortal: (base) => ({ ...base, zIndex: 1100 }),
};

interface BaseProps {
    options: SelectOption[];
    placeholder?: string;
    id?: string;
    name?: string;
    invalid?: boolean;
    disabled?: boolean;
    clearable?: boolean;
    /** Hide the search box for short lists. */
    searchable?: boolean;
    className?: string;
}

function commonProps({
    options,
    placeholder,
    id,
    name,
    invalid,
    disabled,
    clearable = true,
    searchable = true,
    className,
}: BaseProps): Partial<ReactSelectProps<SelectOption, boolean>> {
    return {
        options,
        placeholder: placeholder ?? '-- Select --',
        inputId: id,
        name,
        isDisabled: disabled,
        isClearable: clearable,
        isSearchable: searchable,
        className: clsx('search-select custom-font-small', invalid && 'is-invalid', className),
        classNamePrefix: 'rs',
        menuPortalTarget: typeof document !== 'undefined' ? document.body : undefined,
        styles,
    };
}

interface SearchSelectProps extends BaseProps {
    value: Value | null | undefined;
    /** Called with the chosen option's value, or '' when cleared. */
    onChange: (value: string) => void;
}

/** A searchable single select (what select2 used to do). */
export default function SearchSelect({ value, onChange, ...props }: SearchSelectProps) {
    const selected = props.options.find((option) => String(option.value) === String(value ?? '')) ?? null;

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
    const selected = props.options.filter((option) => wanted.has(String(option.value)));

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
