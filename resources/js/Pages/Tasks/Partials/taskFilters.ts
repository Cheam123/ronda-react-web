import { describeRange } from '@/Components/surface/DateRangeMenu';
import type { SelectOption } from '@/types';
import type { IfeAreaOption } from '@/types/leads';
import type { TaskFilters } from '@/types/tasks';

/** The people filters in "More filters": [key, label]. The subscriber sits on the toolbar. */
export const PEOPLE_FILTERS = [
    ['filter_subsubscriber', 'Sub-subscriber'],
    ['filter_creator', 'Creator'],
    ['filter_checker', 'Checker'],
    ['filter_owner', 'Owner'],
    ['filter_viewer', 'Viewer'],
] as const;

/** The date ranges in "More filters": [start key, end key, label]. Last updated sits on the toolbar. */
export const DATE_RANGES = [
    ['appointment_date_start', 'appointment_date_end', 'Appointment'],
    ['start', 'end', 'Created'],
    ['inprogress_date_start', 'inprogress_date_end', 'In progress'],
    ['done_date_start', 'done_date_end', 'Done'],
    ['verify_date_start', 'verify_date_end', 'Verified'],
    ['complete_date_start', 'complete_date_end', 'Completed'],
    ['kiv_date_start', 'kiv_date_end', 'Keep in view'],
    ['reject_date_start', 'reject_date_end', 'Rejected'],
] as const;

/** Every single-value filter "More filters" holds. */
const MORE_KEYS = [
    ...PEOPLE_FILTERS.map(([key]) => key),
    'filter_cid',
    'filter_ifearea',
    'filter_source',
    'filter_business_category',
    'filter_withsales',
    'filter_alert',
    ...DATE_RANGES.flatMap(([start, end]) => [start, end]),
] as const;

const TEXT_KEYS = [
    'search',
    'filter_subscriber',
    'updated_date_start',
    'updated_date_end',
    ...MORE_KEYS,
    'status',
    'sortby',
    'sortmode',
] as const;

type TextKey = (typeof TEXT_KEYS)[number];
type MoreKey = (typeof MORE_KEYS)[number];

export type TaskFilterValues = Record<TextKey, string> & { filter_name: string[] };

/** What "More filters" edits: its own keys and the outlet names. */
export type MoreFilterValues = Record<MoreKey, string> & { filter_name: string[] };

/** The form's starting values, from the query string the controller hands back. */
export function taskFilterValues(filters: TaskFilters): TaskFilterValues {
    const values = Object.fromEntries(TEXT_KEYS.map((key) => [key, String(filters[key] ?? '')])) as Record<
        TextKey,
        string
    >;
    const names = filters.filter_name;

    return { ...values, filter_name: Array.isArray(names) ? names : names ? [names] : [] };
}

/** The "More filters" part of the values. */
export function moreFilterValues(values: TaskFilterValues): MoreFilterValues {
    const more = Object.fromEntries(MORE_KEYS.map((key) => [key, values[key]])) as Record<MoreKey, string>;

    return { ...more, filter_name: values.filter_name };
}

/** "More filters" with nothing chosen. */
export const NO_MORE_FILTERS: MoreFilterValues = {
    ...(Object.fromEntries(MORE_KEYS.map((key) => [key, ''])) as Record<MoreKey, string>),
    filter_name: [],
};

/** Every filter cleared; the status tab and the sort stay. */
export const NO_FILTERS: Partial<TaskFilterValues> = {
    ...NO_MORE_FILTERS,
    search: '',
    filter_subscriber: '',
    updated_date_start: '',
    updated_date_end: '',
};

export interface TaskFilterOptions {
    users: SelectOption<number>[];
    leadNames: string[];
    ifeAreas: IfeAreaOption[];
    sources: SelectOption[];
    businessCategories: SelectOption[];
}

export interface FilterChip {
    key: string;
    label: string;
    /** The change that takes this filter off. */
    clear: Partial<TaskFilterValues>;
}

const labelOf = (options: SelectOption[], value: string) =>
    options.find((option) => String(option.value) === value)?.label ?? value;

/** One chip per "More filters" filter in use, so they show while the panel is closed. */
export function filterChips(values: TaskFilterValues, options: TaskFilterOptions): FilterChip[] {
    const chips: FilterChip[] = [];

    for (const [key, label] of PEOPLE_FILTERS) {
        if (values[key]) {
            chips.push({ key, label: `${label}: ${labelOf(options.users, values[key])}`, clear: { [key]: '' } });
        }
    }

    for (const name of values.filter_name) {
        chips.push({
            key: `filter_name:${name}`,
            label: `Name: ${name}`,
            clear: { filter_name: values.filter_name.filter((other) => other !== name) },
        });
    }

    if (values.filter_cid) {
        chips.push({ key: 'filter_cid', label: `Customer ID: ${values.filter_cid}`, clear: { filter_cid: '' } });
    }
    if (values.filter_ifearea) {
        chips.push({
            key: 'filter_ifearea',
            label: `IFE area: ${labelOf(options.ifeAreas, values.filter_ifearea)}`,
            clear: { filter_ifearea: '' },
        });
    }
    if (values.filter_source) {
        chips.push({
            key: 'filter_source',
            label: `Source: ${labelOf(options.sources, values.filter_source)}`,
            clear: { filter_source: '' },
        });
    }
    if (values.filter_business_category) {
        chips.push({
            key: 'filter_business_category',
            label: `Business category: ${labelOf(options.businessCategories, values.filter_business_category)}`,
            clear: { filter_business_category: '' },
        });
    }
    if (values.filter_withsales) {
        chips.push({
            key: 'filter_withsales',
            label: values.filter_withsales === 'N' ? 'Without sales' : 'With sales',
            clear: { filter_withsales: '' },
        });
    }
    if (values.filter_alert) {
        chips.push({
            key: 'filter_alert',
            label: values.filter_alert === '2' ? 'Flagged' : 'Not flagged',
            clear: { filter_alert: '' },
        });
    }

    // The controller filters a range only once it has a start.
    for (const [start, end, label] of DATE_RANGES) {
        if (values[start]) {
            chips.push({
                key: start,
                label: `${label}: ${describeRange(values[start], values[end])}`,
                clear: { [start]: '', [end]: '' },
            });
        }
    }

    return chips;
}
