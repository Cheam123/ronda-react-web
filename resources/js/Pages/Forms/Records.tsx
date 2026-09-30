import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import { useState, type FormEvent } from 'react';
import Collapse from 'react-bootstrap/Collapse';
import StatusBadge from '@/Components/forms/StatusBadge';
import SearchSelect from '@/Components/form/SearchSelect';
import Select from '@/Components/form/Select';
import TextInput from '@/Components/form/TextInput';
import Button, { ButtonLink } from '@/Components/ui/Button';
import DataTable from '@/Components/ui/DataTable';
import Pagination from '@/Components/ui/Pagination';
import { useFilters } from '@/hooks/useFilters';
import AppLayout from '@/Layouts/AppLayout';
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
    /** "All Records" (form admins) rather than "My Records". */
    isAdmin: boolean;
    filters: QueryParams;
}

// Read left to right the way a record travels: still moving, then the ways it ends.
const PILLS = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'closed', label: 'Closed' },
];

const SORT_BY = [
    { value: 'created_at', label: 'Sort By Submission Date' },
    { value: 'updated_at', label: 'Sort By Last Activity' },
    { value: 'record_title', label: 'Sort By Record Title' },
];

const SORT_MODE = [
    { value: 'desc', label: '🔽 Desc' },
    { value: 'asc', label: '🔼 Asc' },
];

/** My Records / All Records: every case the user opened or took part in. */
export default function Records({ records, forms, users, statusCounts, isAdmin, filters }: RecordsProps) {
    const url = isAdmin ? route('form.records.all') : route('form.records.index');
    const { values, set, apply, reset } = useFilters(url, {
        search: filters.search ?? '',
        form_id: filters.form_id ?? '',
        submitted_by: filters.submitted_by ?? '',
        date_start: filters.date_start ?? '',
        date_end: filters.date_end ?? '',
        status: filters.status ?? '',
        sortby: filters.sortby ?? 'created_at',
        sortmode: filters.sortmode ?? 'desc',
    });
    const [expanded, setExpanded] = useState(Boolean(filters.submitted_by || filters.date_start || filters.date_end));
    const title = isAdmin ? 'All Records' : 'My Records';

    const count = (status: string) =>
        status === ''
            ? Object.values(statusCounts).reduce<number>((total, n) => total + Number(n), 0)
            : Number(statusCounts[status] ?? 0);
    const filtered = ['search', 'form_id', 'status', 'submitted_by', 'date_start', 'date_end'].some(
        (key) => filters[key],
    );

    const search = (event: FormEvent) => {
        event.preventDefault();
        apply();
    };

    return (
        <AppLayout title={title} breadcrumb={['Forms', title]}>
            <div className="page-title-box d-flex align-items-center justify-content-between flex-wrap gap-2">
                <h4 className="mb-0">{title}</h4>
                <div className="d-flex gap-2">
                    {isAdmin && (
                        <a href={route('form.records.export', compactParams(filters))} className="btn btn-success">
                            <i className="mdi mdi-file-excel me-1" /> Export
                        </a>
                    )}
                    <ButtonLink href={route('form.entry')} icon="mdi mdi-plus">
                        Start a form
                    </ButtonLink>
                </div>
            </div>

            <div className="card card3 custom-font-small">
                <div className="card-body">
                    <form onSubmit={search}>
                        <div className="row g-2 align-items-end">
                            <div className="col-lg-4">
                                <label htmlFor="search" className="custom-font-xsmall mb-1">
                                    Search:
                                </label>
                                <TextInput
                                    id="search"
                                    maxLength={255}
                                    placeholder="Record title or form name..."
                                    value={values.search}
                                    onChange={(event) => set('search', event.target.value)}
                                />
                            </div>
                            <div className="col-lg-4">
                                <label htmlFor="form_id" className="custom-font-xsmall mb-1">
                                    Form:
                                </label>
                                <SearchSelect
                                    id="form_id"
                                    placeholder="All forms"
                                    options={forms}
                                    value={values.form_id}
                                    onChange={(value) => set('form_id', value)}
                                />
                            </div>
                            <div className="col-lg-4 d-flex justify-content-lg-end gap-1">
                                <Button
                                    variant="light"
                                    size="sm"
                                    icon={
                                        expanded ? 'mdi mdi-unfold-less-horizontal' : 'mdi mdi-unfold-more-horizontal'
                                    }
                                    title="More filters"
                                    aria-expanded={expanded}
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
                                    title="Clear filters"
                                    aria-label="Clear filters"
                                    onClick={reset}
                                />
                            </div>
                        </div>
                        <Collapse in={expanded}>
                            <div>
                                <div className="row g-2 pt-2">
                                    <div className="col-lg-4">
                                        <label htmlFor="submitted_by" className="custom-font-xsmall mb-1">
                                            Submitted By:
                                        </label>
                                        <SearchSelect
                                            id="submitted_by"
                                            placeholder="Anyone"
                                            options={users}
                                            value={values.submitted_by}
                                            onChange={(value) => set('submitted_by', value)}
                                        />
                                    </div>
                                    <div className="col-lg-4">
                                        <label htmlFor="date_start" className="custom-font-xsmall mb-1">
                                            Submission Date:
                                        </label>
                                        <div className="input-group input-group-sm">
                                            <TextInput
                                                id="date_start"
                                                type="date"
                                                aria-label="Submitted from"
                                                value={values.date_start}
                                                onChange={(event) => set('date_start', event.target.value)}
                                            />
                                            <TextInput
                                                type="date"
                                                aria-label="Submitted to"
                                                value={values.date_end}
                                                onChange={(event) => set('date_end', event.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Collapse>
                    </form>

                    <hr />

                    <div className="task-tabs">
                        <div className="nav nav-pills task-tabs__pills" role="tablist">
                            {PILLS.map((pill) => (
                                <button
                                    key={pill.value || 'all'}
                                    type="button"
                                    role="tab"
                                    aria-selected={values.status === pill.value}
                                    className={clsx(
                                        'btn btn-sm nav-link',
                                        values.status === pill.value ? 'active' : 'inactive',
                                    )}
                                    onClick={() => {
                                        set('status', pill.value);
                                        apply({ status: pill.value });
                                    }}
                                >
                                    {pill.label}
                                    {count(pill.value) > 0 && ` ( ${count(pill.value)} )`}
                                </button>
                            ))}
                        </div>
                        <div className="task-tabs__sort">
                            <Select
                                aria-label="Sort by"
                                options={SORT_BY}
                                value={values.sortby}
                                onChange={(event) => {
                                    set('sortby', event.target.value);
                                    apply({ sortby: event.target.value });
                                }}
                            />
                            <Select
                                aria-label="Sort order"
                                options={SORT_MODE}
                                value={values.sortmode}
                                onChange={(event) => {
                                    set('sortmode', event.target.value);
                                    apply({ sortmode: event.target.value });
                                }}
                            />
                        </div>
                    </div>

                    {records.data.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="mdi mdi-file-document-outline empty-icon" />
                            <h5 className="mt-3 text-muted">
                                {filtered ? 'No records match this filter' : 'No records yet'}
                            </h5>
                            <p className="text-muted mb-0">Anything you submit or take part in appears here.</p>
                        </div>
                    ) : (
                        <>
                            <DataTable className="table-hover align-middle mb-0" nowrap={false}>
                                <thead>
                                    <tr>
                                        <th>Reference</th>
                                        <th>Record</th>
                                        <th>Waiting on</th>
                                        <th className="text-center">Status</th>
                                        <th>Last activity</th>
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.data.map((row) => (
                                        <tr key={row.id}>
                                            <td className="small fw-semibold text-nowrap">{row.reference}</td>
                                            <td>
                                                <Link
                                                    href={route('form.records.show', row.id)}
                                                    className="fw-semibold text-body"
                                                >
                                                    {row.title}
                                                </Link>
                                                <div className="text-muted small">
                                                    {row.form_name} &middot; {row.submitted_by} &middot;{' '}
                                                    {row.created_at}
                                                    {row.closed && (
                                                        <span className="badge bg-secondary ms-1">Closed</span>
                                                    )}
                                                    {row.parent_reference && (
                                                        <span
                                                            className="badge bg-light text-dark border ms-1"
                                                            title={`Follows up on ${row.parent_reference}`}
                                                        >
                                                            <i className="mdi mdi-subdirectory-arrow-right" />{' '}
                                                            {row.parent_reference}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                {row.stage_name ? (
                                                    <>
                                                        <div className="small fw-semibold">{row.stage_name}</div>
                                                        <div className="text-muted small">
                                                            {row.waiting_on.length
                                                                ? row.waiting_on.join(', ')
                                                                : 'pending'}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="text-muted small">—</span>
                                                )}
                                            </td>
                                            <td className="text-center">
                                                <StatusBadge status={row.status} />
                                            </td>
                                            <td className="small text-muted text-nowrap">{row.updated_at}</td>
                                            <td className="text-center">
                                                <Link
                                                    href={route('form.records.show', row.id)}
                                                    className="btn btn-sm btn-outline-primary"
                                                >
                                                    Open
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </DataTable>
                            <Pagination links={records.links} className="mt-3" />
                        </>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
