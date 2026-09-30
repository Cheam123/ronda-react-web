import { useState, type FormEvent, type ReactNode } from 'react';
import Collapse from 'react-bootstrap/Collapse';
import IfeAreaListButton from '@/Components/areas/IfeAreaListButton';
import SearchSelect, { MultiSearchSelect } from '@/Components/form/SearchSelect';
import TextInput from '@/Components/form/TextInput';
import Button from '@/Components/ui/Button';
import type { SelectOption } from '@/types';
import type { IfeAreaOption } from '@/types/leads';
import type { TaskFilters } from '@/types/tasks';

/** The date ranges the list filters by, as [start key, end key, label]. */
const DATE_RANGES = [
    ['updated_date_start', 'updated_date_end', 'Last Updated Date'],
    ['start', 'end', 'Submission Date'],
    ['complete_date_start', 'complete_date_end', 'Completed Date'],
    ['inprogress_date_start', 'inprogress_date_end', 'In Progress Date'],
    ['done_date_start', 'done_date_end', 'Done Date'],
    ['verify_date_start', 'verify_date_end', 'Verified Date'],
    ['reject_date_start', 'reject_date_end', 'Rejected Date'],
    ['kiv_date_start', 'kiv_date_end', 'KIV Date'],
] as const;

const TEXT_KEYS = [
    'filter_title',
    'filter_reference_no',
    'filter_subscriber',
    'filter_subsubscriber',
    'filter_withsales',
    'filter_alert',
    'filter_cid',
    'filter_ifearea',
    'filter_source',
    'filter_creator',
    'filter_checker',
    'filter_owner',
    'filter_viewer',
    'filter_business_category',
    'appointment_date_start',
    'appointment_date_end',
    ...DATE_RANGES.flatMap(([start, end]) => [start, end]),
    'status',
    'sortby',
    'sortmode',
] as const;

/** Filters shown in the collapsed "more filters" rows. */
const ADVANCED_KEYS = TEXT_KEYS.filter(
    (key) =>
        ![
            'filter_title',
            'filter_reference_no',
            'filter_subscriber',
            'filter_subsubscriber',
            'status',
            'sortby',
            'sortmode',
        ].includes(key),
);

type TextKey = (typeof TEXT_KEYS)[number];

export type TaskFilterValues = Record<TextKey, string> & { filter_name: string[] };

/** The form's starting values, from the query string the controller hands back. */
export function taskFilterValues(filters: TaskFilters): TaskFilterValues {
    const values = Object.fromEntries(TEXT_KEYS.map((key) => [key, String(filters[key] ?? '')])) as Record<
        TextKey,
        string
    >;
    const names = filters.filter_name;

    return { ...values, filter_name: Array.isArray(names) ? names : names ? [names] : [] };
}

const YES_NO = [
    { value: 'Y', label: 'Yes' },
    { value: 'N', label: 'No' },
];

const ALERT_OPTIONS = [
    { value: '1', label: 'NO' },
    { value: '2', label: 'YES' },
];

export interface TaskFilterOptions {
    users: SelectOption<number>[];
    leadNames: string[];
    ifeAreas: IfeAreaOption[];
    sources: SelectOption[];
    businessCategories: SelectOption[];
}

interface TaskFilterFormProps {
    values: TaskFilterValues;
    set: <K extends keyof TaskFilterValues>(key: K, value: TaskFilterValues[K]) => void;
    onSearch: () => void;
    onReset: () => void;
    options: TaskFilterOptions;
}

/** The task list's search: the common filters, and the rest behind "More". */
export default function TaskFilterForm({ values, set, onSearch, onReset, options }: TaskFilterFormProps) {
    // Open the extra rows when one of their filters is in use.
    const [expanded, setExpanded] = useState(
        () => ADVANCED_KEYS.some((key) => values[key] !== '') || values.filter_name.length > 0,
    );
    const leadNames = options.leadNames.map((name) => ({ value: name, label: name }));

    const submit = (event: FormEvent) => {
        event.preventDefault();
        onSearch();
    };

    const userSelect = (key: TextKey, label: string, className?: string) => (
        <FilterField label={label} htmlFor={key} className={className}>
            <SearchSelect
                id={key}
                options={options.users}
                placeholder="-- Select your choice --"
                value={values[key]}
                onChange={(value) => set(key, value)}
            />
        </FilterField>
    );

    return (
        <form onSubmit={submit} className="task-filters custom-font-small">
            <div className="row g-2 align-items-end">
                <FilterField label="Task Title" htmlFor="filter_title" className="col-lg-3">
                    <TextInput
                        id="filter_title"
                        maxLength={500}
                        value={values.filter_title}
                        onChange={(event) => set('filter_title', event.target.value)}
                    />
                </FilterField>
                <FilterField label="Reference No" htmlFor="filter_reference_no" className="col-lg-2">
                    <TextInput
                        id="filter_reference_no"
                        maxLength={21}
                        value={values.filter_reference_no}
                        onChange={(event) => set('filter_reference_no', event.target.value)}
                    />
                </FilterField>
                {userSelect('filter_subscriber', 'Subscriber', 'col-lg-2')}
                {userSelect('filter_subsubscriber', 'Sub-Subscriber', 'col-lg-2')}
                <div className="col-lg-3 d-flex flex-wrap gap-1 justify-content-lg-end mb-2">
                    <Button
                        variant="light"
                        size="sm"
                        icon={expanded ? 'mdi mdi-unfold-less-horizontal' : 'mdi mdi-unfold-more-horizontal'}
                        aria-expanded={expanded}
                        aria-controls="task-filters-more"
                        title={expanded ? 'Fewer filters' : 'More filters'}
                        onClick={() => setExpanded((open) => !open)}
                    />
                    <Button
                        type="submit"
                        variant="light"
                        size="sm"
                        icon="mdi mdi-magnify"
                        title="Search"
                        aria-label="Search"
                    />
                    <Button
                        variant="light"
                        size="sm"
                        icon="mdi mdi-broom"
                        title="Reset"
                        aria-label="Reset"
                        onClick={onReset}
                    />
                    <IfeAreaListButton areas={options.ifeAreas} label="IFE Area Code" />
                </div>
            </div>

            <Collapse in={expanded}>
                <div id="task-filters-more">
                    <div className="row g-2">
                        <FilterField label="With Sales" htmlFor="filter_withsales">
                            <SearchSelect
                                id="filter_withsales"
                                options={YES_NO}
                                searchable={false}
                                placeholder="-- Select your choice --"
                                value={values.filter_withsales}
                                onChange={(value) => set('filter_withsales', value)}
                            />
                        </FilterField>
                        <FilterField label="Lead/Customer Name" htmlFor="filter_name">
                            <MultiSearchSelect
                                id="filter_name"
                                options={leadNames}
                                placeholder=""
                                value={values.filter_name}
                                onChange={(names) => set('filter_name', names)}
                            />
                        </FilterField>
                        <DateRange
                            label="Appointment Date"
                            start="appointment_date_start"
                            end="appointment_date_end"
                            values={values}
                            set={set}
                        />
                        <FilterField label="Alert Indicator ON" htmlFor="filter_alert">
                            <SearchSelect
                                id="filter_alert"
                                options={ALERT_OPTIONS}
                                searchable={false}
                                placeholder="-- Select your choice --"
                                value={values.filter_alert}
                                onChange={(value) => set('filter_alert', value)}
                            />
                        </FilterField>
                        <FilterField label="Customer ID" htmlFor="filter_cid">
                            <TextInput
                                id="filter_cid"
                                maxLength={24}
                                value={values.filter_cid}
                                onChange={(event) => set('filter_cid', event.target.value)}
                            />
                        </FilterField>
                        <FilterField label="IFE Area Code" htmlFor="filter_ifearea">
                            <SearchSelect
                                id="filter_ifearea"
                                options={options.ifeAreas}
                                placeholder="-- Select IFE Area --"
                                value={values.filter_ifearea}
                                onChange={(value) => set('filter_ifearea', value)}
                            />
                        </FilterField>
                        <FilterField label="Source" htmlFor="filter_source">
                            <SearchSelect
                                id="filter_source"
                                options={options.sources}
                                placeholder="-- Select your choice --"
                                value={values.filter_source}
                                onChange={(value) => set('filter_source', value)}
                            />
                        </FilterField>
                        {userSelect('filter_creator', 'Creator')}
                        {userSelect('filter_checker', 'Checker')}
                        {userSelect('filter_owner', 'Owner')}
                        {userSelect('filter_viewer', 'Viewer')}
                        <FilterField label="Business Category" htmlFor="filter_business_category">
                            <SearchSelect
                                id="filter_business_category"
                                options={options.businessCategories}
                                searchable={false}
                                placeholder="-- Select company type --"
                                value={values.filter_business_category}
                                onChange={(value) => set('filter_business_category', value)}
                            />
                        </FilterField>
                        {DATE_RANGES.map(([start, end, label]) => (
                            <DateRange key={start} label={label} start={start} end={end} values={values} set={set} />
                        ))}
                    </div>
                </div>
            </Collapse>
        </form>
    );
}

interface FilterFieldProps {
    label: string;
    htmlFor?: string;
    className?: string;
    children: ReactNode;
}

function FilterField({ label, htmlFor, className = 'col-lg-3 col-md-6', children }: FilterFieldProps) {
    return (
        <div className={className}>
            <label htmlFor={htmlFor} className="custom-font-xsmall mb-1">
                {label}:
            </label>
            {children}
        </div>
    );
}

interface DateRangeProps {
    label: string;
    start: TextKey;
    end: TextKey;
    values: TaskFilterValues;
    set: TaskFilterFormProps['set'];
}

function DateRange({ label, start, end, values, set }: DateRangeProps) {
    return (
        <FilterField label={label} htmlFor={start}>
            <div className="input-group input-group-sm">
                <TextInput
                    id={start}
                    type="date"
                    aria-label={`${label} from`}
                    value={values[start]}
                    onChange={(event) => set(start, event.target.value)}
                />
                <TextInput
                    type="date"
                    aria-label={`${label} to`}
                    value={values[end]}
                    onChange={(event) => set(end, event.target.value)}
                />
            </div>
        </FilterField>
    );
}
