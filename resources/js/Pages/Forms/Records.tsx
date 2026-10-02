import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import type { FormEvent } from 'react';
import StatusBadge from '@/Components/forms/StatusBadge';
import SearchSelect from '@/Components/form/SearchSelect';
import DateRangeMenu from '@/Components/surface/DateRangeMenu';
import PageHeader from '@/Components/surface/PageHeader';
import Pager from '@/Components/surface/Pager';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useFilters } from '@/hooks/useFilters';
import AppLayout from '@/Layouts/AppLayout';
import { formatNumber } from '@/lib/format';
import { compactParams } from '@/lib/input';
import type { Paginated, QueryParams, SelectOption } from '@/types';

interface RecordRow {
    id: number;
    reference: string;
    title: string;
    form_name: string;
    submitted_by: string;
    created_at: string | null;
    closed: boolean;
    parent_reference: string | null;
    stage_name: string | null;
    waiting_on: string[];
    status: string;
    updated_at: string | null;
}

interface RecordsProps {
    records: Paginated<RecordRow>;
    forms: SelectOption<number>[];
    users: SelectOption<number>[];
    /** Records per status, counted before the status filter. */
    statusCounts: Record<string, number | string>;
    /** "All records" (form admins) rather than "My records". */
    isAdmin: boolean;
    filters: QueryParams;
}

// Read left to right the way a record travels: still moving, then the ways it ends.
const TABS = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'In review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'closed', label: 'Closed' },
];

const SORT_BY = [
    { value: 'created_at', label: 'Submitted' },
    { value: 'updated_at', label: 'Last activity' },
    { value: 'record_title', label: 'Title' },
];

/** My records / All records: every record the user opened or took part in. */
export default function Records({ records, forms, users, statusCounts, isAdmin, filters }: RecordsProps) {
    const url = isAdmin ? route('form.records.all') : route('form.records.index');
    const { values, set, apply, choose } = useFilters(url, {
        search: filters.search ?? '',
        form_id: filters.form_id ?? '',
        submitted_by: filters.submitted_by ?? '',
        date_start: filters.date_start ?? '',
        date_end: filters.date_end ?? '',
        status: filters.status ?? '',
        sortby: filters.sortby ?? 'created_at',
        sortmode: filters.sortmode ?? 'desc',
    });
    const title = isAdmin ? 'All records' : 'My records';
    const descending = values.sortmode !== 'asc';
    const byTitle = values.sortby === 'record_title';

    const count = (status: string) =>
        status === ''
            ? Object.values(statusCounts).reduce<number>((total, n) => total + Number(n), 0)
            : Number(statusCounts[status] ?? 0);
    const filtered = ['search', 'form_id', 'submitted_by', 'date_start', 'date_end'].some((key) => filters[key]);

    const search = (event: FormEvent) => {
        event.preventDefault();
        apply();
    };

    return (
        <AppLayout title={title}>
            <SurfacePage>
                <PageHeader
                    crumbs={[{ label: 'Home', href: '/index' }, { label: title }]}
                    title={title}
                    lede={isAdmin ? 'Every record made from every form.' : 'Everything you submitted or took part in.'}
                    actions={
                        <>
                            {isAdmin && (
                                <a
                                    href={route('form.records.export', compactParams(filters))}
                                    className="rd-btn rd-btn--lg"
                                    download
                                >
                                    <i className="mdi mdi-download" aria-hidden="true" />
                                    Export to Excel
                                </a>
                            )}
                            <Link href={route('form.entry')} className="rd-btn rd-btn--primary rd-btn--lg">
                                <i className="mdi mdi-plus" aria-hidden="true" />
                                Start a form
                            </Link>
                        </>
                    }
                />

                <section className="rd-panel rd-list records-list" aria-label="Records">
                    <nav className="rd-tabs records-list__tabs" aria-label="Status">
                        {TABS.map((tab) => {
                            const active = values.status === tab.value;

                            return (
                                <button
                                    key={tab.label}
                                    type="button"
                                    className={clsx('rd-tabs__tab', active && 'is-active')}
                                    aria-current={active ? 'true' : undefined}
                                    onClick={() => choose({ status: tab.value })}
                                >
                                    {tab.label} <span className="rd-count">{formatNumber(count(tab.value))}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="records-list__toolbar">
                        <div className="records-list__filters">
                            <form role="search" onSubmit={search}>
                                <label className="rd-search">
                                    <i className="mdi mdi-magnify" aria-hidden="true" />
                                    <input
                                        type="search"
                                        className="rd-input"
                                        aria-label="Search records"
                                        placeholder="Search title or form"
                                        maxLength={255}
                                        value={values.search}
                                        onChange={(event) => set('search', event.target.value)}
                                    />
                                </label>
                            </form>
                            <SearchSelect
                                compact
                                ariaLabel="Form"
                                options={[{ value: '', label: 'All forms' }, ...forms]}
                                clearable={false}
                                value={values.form_id}
                                onChange={(value) => choose({ form_id: value })}
                            />
                            <SearchSelect
                                compact
                                ariaLabel="Submitted by"
                                options={[{ value: '', label: 'Anyone' }, ...users]}
                                clearable={false}
                                value={values.submitted_by}
                                onChange={(value) => choose({ submitted_by: value })}
                            />
                            <DateRangeMenu
                                label="Submitted"
                                start={values.date_start}
                                end={values.date_end}
                                onApply={(start, end) => choose({ date_start: start, date_end: end })}
                            />
                        </div>
                        <div className="records-list__sort">
                            <label htmlFor="records-sort">Sort by</label>
                            <SearchSelect
                                id="records-sort"
                                compact
                                options={SORT_BY}
                                clearable={false}
                                searchable={false}
                                value={values.sortby}
                                onChange={(value) => choose({ sortby: value })}
                            />
                            <button
                                type="button"
                                className="rd-btn"
                                title="Change the order"
                                onClick={() => choose({ sortmode: descending ? 'asc' : 'desc' })}
                            >
                                <i className={`mdi mdi-arrow-${descending ? 'down' : 'up'}`} aria-hidden="true" />
                                {byTitle
                                    ? descending
                                        ? 'Z to A'
                                        : 'A to Z'
                                    : descending
                                      ? 'Newest first'
                                      : 'Oldest first'}
                            </button>
                        </div>
                    </div>

                    <div className="rd-scroll">
                        <table className="rd-table rd-table--band records-table">
                            <thead>
                                <tr>
                                    <th scope="col">Record</th>
                                    <th scope="col">Status</th>
                                    <th scope="col">Waiting on</th>
                                    <th scope="col">Submitted</th>
                                    <th scope="col">Last activity</th>
                                    <th scope="col" className="rd-col-actions">
                                        <span className="visually-hidden">Open</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.data.map((row) => (
                                    <tr key={row.id}>
                                        <td className="records-table__record">
                                            <Link
                                                href={route('form.records.show', row.id)}
                                                className="records-table__title"
                                            >
                                                {row.title}
                                            </Link>
                                            <span className="records-table__sub">
                                                <span className="rd-mono">{row.reference}</span>
                                                {row.form_name}
                                                {row.parent_reference && (
                                                    <span
                                                        className="rd-chip"
                                                        title={`Follows up on ${row.parent_reference}`}
                                                    >
                                                        <i
                                                            className="mdi mdi-subdirectory-arrow-right"
                                                            aria-hidden="true"
                                                        />
                                                        {row.parent_reference}
                                                    </span>
                                                )}
                                            </span>
                                        </td>
                                        <td className="records-table__status">
                                            <StatusBadge status={row.closed ? 'closed' : row.status} />
                                        </td>
                                        <td className="records-table__waiting">
                                            {row.stage_name ? (
                                                <>
                                                    <span className="records-table__stage">{row.stage_name}</span>
                                                    <span className="records-table__sub">
                                                        {row.waiting_on.length
                                                            ? row.waiting_on.join(', ')
                                                            : 'Anyone on the step'}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="rd-muted">Nobody</span>
                                            )}
                                        </td>
                                        <td className="records-table__when">
                                            <span>{row.created_at ?? '—'}</span>
                                            <span className="records-table__sub">{row.submitted_by}</span>
                                        </td>
                                        <td className="records-table__when">{row.updated_at ?? '—'}</td>
                                        <td className="rd-col-actions">
                                            <div className="rd-actions">
                                                <Link
                                                    href={route('form.records.show', row.id)}
                                                    className="rd-btn rd-btn--icon"
                                                    aria-label={`Open ${row.title}`}
                                                    title="Open"
                                                >
                                                    <i className="mdi mdi-chevron-right" aria-hidden="true" />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {records.data.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="rd-list__empty">
                                            {filtered
                                                ? 'No records match.'
                                                : 'Nothing yet. Anything you submit or take part in appears here.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="rd-list__foot">
                        <span>
                            {records.total > 0 ? (
                                <>
                                    Showing{' '}
                                    <strong>
                                        {records.from}–{records.to}
                                    </strong>{' '}
                                    of <strong>{formatNumber(records.total)}</strong>{' '}
                                    {records.total === 1 ? 'record' : 'records'}
                                </>
                            ) : (
                                'No records'
                            )}
                        </span>
                        <Pager links={records.links} />
                    </div>
                </section>
            </SurfacePage>
        </AppLayout>
    );
}
