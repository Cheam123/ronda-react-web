import { useEffect, useState, type FormEvent } from 'react';
import Offcanvas from 'react-bootstrap/Offcanvas';
import Field from '@/Components/form/Field';
import SearchSelect, { MultiSearchSelect } from '@/Components/form/SearchSelect';
import TextInput from '@/Components/form/TextInput';
import { Choices } from '@/Components/surface/Choices';
import {
    DATE_RANGES,
    NO_MORE_FILTERS,
    PEOPLE_FILTERS,
    type MoreFilterValues,
    type TaskFilterOptions,
} from './taskFilters';

const WITH_SALES = [
    { value: '', label: 'Any' },
    { value: 'Y', label: 'Yes' },
    { value: 'N', label: 'No' },
];

// The task's alert indicator: 2 is flagged.
const FLAGGED = [
    { value: '', label: 'Any' },
    { value: '2', label: 'Yes' },
    { value: '1', label: 'No' },
];

interface MoreFiltersProps {
    show: boolean;
    onHide: () => void;
    /** The filters in use now; the panel edits a copy until "Show tasks". */
    values: MoreFilterValues;
    options: TaskFilterOptions;
    onApply: (values: MoreFilterValues) => void;
}

/** The task list's less used filters, in a panel beside the list. */
export default function MoreFilters({ show, onHide, values, options, onApply }: MoreFiltersProps) {
    const [draft, setDraft] = useState(values);
    const leadNames = options.leadNames.map((name) => ({ value: name, label: name }));

    // Start from what is applied each time the panel opens.
    useEffect(() => {
        if (show) {
            setDraft(values);
        }
    }, [show, values]);

    const set = <K extends keyof MoreFilterValues>(key: K, value: MoreFilterValues[K]) =>
        setDraft((current) => ({ ...current, [key]: value }));

    const submit = (event: FormEvent) => {
        event.preventDefault();
        onApply(draft);
    };

    return (
        <Offcanvas
            show={show}
            onHide={onHide}
            placement="end"
            className="rd-drawer"
            backdropClassName="rd-drawer-backdrop"
            aria-labelledby="more-filters-title"
        >
            <form className="rd-drawer__form" onSubmit={submit}>
                <div className="rd-drawer__head">
                    <h2 id="more-filters-title" className="rd-drawer__title">
                        More filters
                    </h2>
                    <p className="rd-drawer__lede">They narrow every status tab, together with the search.</p>
                    <button
                        type="button"
                        className="rd-btn rd-btn--icon rd-drawer__close"
                        aria-label="Close"
                        title="Close"
                        onClick={onHide}
                    >
                        <i className="mdi mdi-close" aria-hidden="true" />
                    </button>
                </div>

                <div className="rd-drawer__body">
                    <section className="task-filters__section" aria-labelledby="more-filters-people">
                        <h3 id="more-filters-people" className="task-filters__title">
                            People
                        </h3>
                        <div className="task-filters__grid task-filters__grid--3">
                            {PEOPLE_FILTERS.map(([key, label]) => (
                                <Field key={key} label={label} htmlFor={key}>
                                    <SearchSelect
                                        id={key}
                                        options={options.users}
                                        placeholder="Anyone"
                                        value={draft[key]}
                                        onChange={(value) => set(key, value)}
                                    />
                                </Field>
                            ))}
                        </div>
                    </section>

                    <section className="task-filters__section" aria-labelledby="more-filters-outlet">
                        <h3 id="more-filters-outlet" className="task-filters__title">
                            Outlet
                        </h3>
                        <Field label="Lead or customer name" htmlFor="filter_name">
                            <MultiSearchSelect
                                id="filter_name"
                                options={leadNames}
                                placeholder="Type to find one or more names"
                                value={draft.filter_name}
                                onChange={(names) => set('filter_name', names)}
                            />
                        </Field>
                        <div className="task-filters__grid">
                            <Field label="Customer ID" htmlFor="filter_cid">
                                <TextInput
                                    id="filter_cid"
                                    large
                                    className="rd-input--mono"
                                    maxLength={24}
                                    value={draft.filter_cid}
                                    onChange={(event) => set('filter_cid', event.target.value)}
                                />
                            </Field>
                            <Field label="IFE area" htmlFor="filter_ifearea">
                                <SearchSelect
                                    id="filter_ifearea"
                                    options={options.ifeAreas}
                                    placeholder="Any area"
                                    value={draft.filter_ifearea}
                                    onChange={(value) => set('filter_ifearea', value)}
                                />
                            </Field>
                            <Field label="Source" htmlFor="filter_source">
                                <SearchSelect
                                    id="filter_source"
                                    options={options.sources}
                                    placeholder="Any source"
                                    value={draft.filter_source}
                                    onChange={(value) => set('filter_source', value)}
                                />
                            </Field>
                            <Field label="Business category" htmlFor="filter_business_category">
                                <SearchSelect
                                    id="filter_business_category"
                                    options={options.businessCategories}
                                    searchable={false}
                                    placeholder="Any category"
                                    value={draft.filter_business_category}
                                    onChange={(value) => set('filter_business_category', value)}
                                />
                            </Field>
                        </div>
                        <div className="task-filters__grid">
                            <Choices
                                legend="With sales"
                                options={WITH_SALES}
                                clearable={false}
                                value={draft.filter_withsales}
                                onChange={(value) => set('filter_withsales', value)}
                            />
                            <Choices
                                legend="Flagged"
                                options={FLAGGED}
                                clearable={false}
                                value={draft.filter_alert}
                                onChange={(value) => set('filter_alert', value)}
                            />
                        </div>
                    </section>

                    <section className="task-filters__section" aria-labelledby="more-filters-dates">
                        <h3 id="more-filters-dates" className="task-filters__title">
                            Dates
                        </h3>
                        <div className="task-filters__dates">
                            {DATE_RANGES.map(([start, end, label]) => (
                                <div key={start} className="task-filters__range">
                                    <span className="rd-field__label" aria-hidden="true">
                                        {label}
                                    </span>
                                    <TextInput
                                        type="date"
                                        aria-label={`${label} from`}
                                        max={draft[end] || undefined}
                                        value={draft[start]}
                                        onChange={(event) => set(start, event.target.value)}
                                    />
                                    <span className="task-filters__to" aria-hidden="true">
                                        –
                                    </span>
                                    <TextInput
                                        type="date"
                                        aria-label={`${label} to`}
                                        min={draft[start] || undefined}
                                        value={draft[end]}
                                        onChange={(event) => set(end, event.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="rd-field__hint">A range counts once it has a start date.</p>
                    </section>
                </div>

                <div className="rd-drawer__foot">
                    <button type="button" className="rd-btn rd-btn--quiet" onClick={() => onApply(NO_MORE_FILTERS)}>
                        Clear all
                    </button>
                    <button type="submit" className="rd-btn rd-btn--primary rd-btn--lg">
                        Show tasks
                    </button>
                </div>
            </form>
        </Offcanvas>
    );
}
