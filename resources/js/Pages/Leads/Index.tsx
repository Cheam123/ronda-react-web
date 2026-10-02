import { Link, router } from '@inertiajs/react';
import clsx from 'clsx';
import { useEffect, useState, type FormEvent } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import IfeAreaListButton from '@/Components/areas/IfeAreaListButton';
import SearchSelect from '@/Components/form/SearchSelect';
import BulkBar from '@/Components/surface/BulkBar';
import DateRangeMenu from '@/Components/surface/DateRangeMenu';
import Initials from '@/Components/surface/Initials';
import PageHeader from '@/Components/surface/PageHeader';
import Pager from '@/Components/surface/Pager';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useAuth } from '@/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';
import AppLayout from '@/Layouts/AppLayout';
import { confirm } from '@/lib/dialogs';
import { formatNumber, pluralize } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { areaHue, tagClass } from '@/lib/tags';
import type { Paginated, QueryParams } from '@/types';
import type { IfeAreaOption, LeadListItem } from '@/types/leads';

/** The has_customerid filter: '' every outlet, Y customers, N prospects. */
type Kind = '' | 'Y' | 'N';

interface LeadsIndexProps {
    leads: Paginated<LeadListItem>;
    ifeAreas: IfeAreaOption[];
    /** Every outlet the user can see, whatever the filters. */
    stats: { total: number; customers: number; prospects: number; areas: number };
    /** What the other filters leave, per tab. */
    counts: { all: number; customers: number; prospects: number };
    filters: QueryParams;
}

export default function LeadsIndex({ leads, ifeAreas, stats, counts, filters }: LeadsIndexProps) {
    const { can } = useAuth();
    const [selected, setSelected] = useState<number[]>([]);
    const { values, set, apply, reset } = useFilters(route('lead.index'), {
        search: filters.search ?? '',
        has_customerid: filters.has_customerid ?? '',
        ifearea: filters.ifearea ?? '',
        start: filters.start ?? '',
        end: filters.end ?? '',
    });

    // A new page of rows (paging, filtering, a delete) starts with nothing ticked.
    useEffect(() => setSelected([]), [leads]);

    const choose = (key: keyof typeof values, value: string) => {
        set(key, value);
        apply({ [key]: value });
    };

    const search = (event: FormEvent) => {
        event.preventDefault();
        apply();
    };

    // Ticking is for deleting, so the checkboxes show only when a row on this page can go.
    const selectable = can('edit_lead') ? leads.data.filter((lead) => lead.deletable) : [];
    const ticking = selectable.length > 0;
    const allTicked = ticking && selectable.every((lead) => selected.includes(lead.id));
    const filtered = Boolean(
        filters.search || filters.ifearea || filters.start || filters.end || filters.has_customerid,
    );

    const toggle = (id: number) =>
        setSelected((current) => (current.includes(id) ? current.filter((other) => other !== id) : [...current, id]));

    const toggleAll = () => setSelected(allTicked ? [] : selectable.map((lead) => lead.id));

    const deleteLead = async (lead: LeadListItem) => {
        if (
            await confirm({ title: 'Delete this outlet?', text: lead.business_name ?? lead.name ?? '', danger: true })
        ) {
            router.post(route('lead.delete'), { id: lead.id }, { preserveScroll: true });
        }
    };

    const deleteSelected = async () => {
        const count = selected.length;
        if (
            await confirm({
                title: `Delete ${pluralize(count, 'outlet')}?`,
                text: 'They leave the list for everyone.',
                confirmText: 'Delete',
                danger: true,
            })
        ) {
            router.post(route('lead.delete.many'), { ids: selected }, { preserveScroll: true });
        }
    };

    const tabs: { value: Kind; label: string; count: number }[] = [
        { value: '', label: 'All', count: counts.all },
        { value: 'Y', label: 'Customers', count: counts.customers },
        { value: 'N', label: 'Prospects', count: counts.prospects },
    ];
    const columns = ticking ? 9 : 8;

    return (
        <AppLayout title="Leads and customers">
            <SurfacePage>
                <PageHeader
                    crumbs={[{ label: 'Home', href: '/index' }, { label: 'Lead/Customer' }]}
                    title="Leads and customers"
                />

                <section className="rd-panel rd-list" aria-labelledby="outlets-title">
                    <div className="rd-list__head">
                        <h2 id="outlets-title" className="rd-list__title">
                            All outlets
                        </h2>
                        <div className="rd-list__actions">
                            <IfeAreaListButton areas={ifeAreas} label="IFE areas" surface />
                            {can('create_lead') && (
                                <Link href={route('lead.create')} className="rd-btn rd-btn--primary rd-btn--lg">
                                    <i className="mdi mdi-plus" aria-hidden="true" />
                                    Add lead
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="rd-stats">
                        <div className="rd-stat">
                            <span className="rd-stat__label">Total outlets</span>
                            <span className="rd-stat__value">{formatNumber(stats.total)}</span>
                        </div>
                        <div className="rd-stat rd-stat--good">
                            <span className="rd-stat__label">Customers</span>
                            <span className="rd-stat__value">{formatNumber(stats.customers)}</span>
                        </div>
                        <div className="rd-stat rd-stat--serious">
                            <span className="rd-stat__label">Prospects</span>
                            <span className="rd-stat__value">{formatNumber(stats.prospects)}</span>
                        </div>
                        <div className="rd-stat rd-stat--violet">
                            <span className="rd-stat__label">IFE areas covered</span>
                            <span className="rd-stat__value">{formatNumber(stats.areas)}</span>
                        </div>
                    </div>

                    <div className="rd-list__bar">
                        <nav className="rd-tabs" aria-label="Customers or prospects">
                            {tabs.map((tab) => {
                                const active = values.has_customerid === tab.value;

                                return (
                                    <button
                                        key={tab.label}
                                        type="button"
                                        className={clsx('rd-tabs__tab', active && 'is-active')}
                                        aria-current={active ? 'true' : undefined}
                                        onClick={() => choose('has_customerid', tab.value)}
                                    >
                                        {tab.label} <span className="rd-count">{formatNumber(tab.count)}</span>
                                    </button>
                                );
                            })}
                        </nav>

                        <div className="rd-list__filters">
                            <form role="search" onSubmit={search}>
                                <label className="rd-search">
                                    <i className="mdi mdi-magnify" aria-hidden="true" />
                                    <input
                                        type="search"
                                        className="rd-input"
                                        aria-label="Search outlets"
                                        placeholder="Search outlet, name or mobile"
                                        maxLength={255}
                                        value={values.search}
                                        onChange={(event) => set('search', event.target.value)}
                                    />
                                </label>
                            </form>
                            <SearchSelect
                                compact
                                ariaLabel="IFE area"
                                options={[{ value: '', label: 'All areas' }, ...ifeAreas]}
                                clearable={false}
                                value={values.ifearea}
                                onChange={(value) => choose('ifearea', value)}
                            />
                            <DateRangeMenu
                                label="Created"
                                start={values.start}
                                end={values.end}
                                onApply={(start, end) => {
                                    set('start', start);
                                    set('end', end);
                                    apply({ start, end });
                                }}
                            />
                        </div>
                    </div>

                    <div className="rd-scroll">
                        <table className="rd-table rd-table--band lead-table">
                            <thead>
                                <tr>
                                    {ticking && (
                                        <th scope="col" className="rd-col-check">
                                            <input
                                                type="checkbox"
                                                className="rd-check"
                                                aria-label="Select every outlet on this page"
                                                checked={allTicked}
                                                onChange={toggleAll}
                                            />
                                        </th>
                                    )}
                                    <th scope="col">Outlet</th>
                                    <th scope="col">Customer ID</th>
                                    <th scope="col">Status</th>
                                    <th scope="col">IFE area</th>
                                    <th scope="col">Assigned to</th>
                                    <th scope="col">Mobile</th>
                                    <th scope="col" aria-sort="descending">
                                        <span className="rd-sorted">
                                            Created
                                            <i className="mdi mdi-arrow-down" aria-hidden="true" />
                                        </span>
                                    </th>
                                    <th scope="col" className="rd-col-actions text-end">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {leads.data.map((lead) => (
                                    <LeadRow
                                        key={lead.id}
                                        lead={lead}
                                        selectable={ticking}
                                        ticked={selected.includes(lead.id)}
                                        onToggle={() => toggle(lead.id)}
                                        onDelete={() => deleteLead(lead)}
                                    />
                                ))}
                                {leads.data.length === 0 && (
                                    <tr>
                                        <td colSpan={columns} className="rd-list__empty">
                                            No outlets match.{' '}
                                            {filtered && (
                                                <button
                                                    type="button"
                                                    className="btn btn-link p-0 align-baseline"
                                                    onClick={reset}
                                                >
                                                    Clear the filters
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="rd-list__foot">
                        <span>
                            {leads.total > 0 ? (
                                <>
                                    Showing{' '}
                                    <strong>
                                        {leads.from}–{leads.to}
                                    </strong>{' '}
                                    of <strong>{formatNumber(leads.total)}</strong>{' '}
                                    {leads.total === 1 ? 'outlet' : 'outlets'}
                                </>
                            ) : (
                                'No outlets'
                            )}
                        </span>
                        <Pager links={leads.links} />
                    </div>
                </section>

                <BulkBar count={selected.length} noun="outlet" onClear={() => setSelected([])}>
                    <button type="button" className="rd-btn rd-btn--danger-soft" onClick={deleteSelected}>
                        <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
                        Delete
                    </button>
                </BulkBar>
            </SurfacePage>
        </AppLayout>
    );
}

interface LeadRowProps {
    lead: LeadListItem;
    /** The page shows the checkbox column (some row on it can be deleted). */
    selectable: boolean;
    ticked: boolean;
    onToggle: () => void;
    onDelete: () => void;
}

function LeadRow({ lead, selectable, ticked, onToggle, onDelete }: LeadRowProps) {
    const { can } = useAuth();
    const title = lead.business_name || lead.name || 'Unnamed outlet';
    const company = lead.business_name ? lead.name : null;
    const canAddTask = can('add_task') && lead.taskable;
    const canOrder = can('record_order');

    return (
        <tr className={clsx(ticked && 'is-selected')}>
            {selectable && (
                <td className="rd-col-check">
                    <input
                        type="checkbox"
                        className="rd-check"
                        aria-label={`Select ${title}`}
                        title={lead.deletable ? undefined : 'Has an open task, so it cannot be deleted'}
                        checked={ticked}
                        disabled={!lead.deletable}
                        onChange={onToggle}
                    />
                </td>
            )}
            <td>
                <div className="rd-person">
                    <Initials name={title} colorKey={lead.id} size="lg" />
                    <span className="rd-person__text">
                        {can('view_lead') ? (
                            <Link href={route('lead.view', lead.id)} className="rd-person__name">
                                {title}
                            </Link>
                        ) : (
                            <span className="rd-person__name">{title}</span>
                        )}
                        {company && <span className="rd-person__sub">{company}</span>}
                    </span>
                </div>
            </td>
            <td>{lead.customer_id ? <span className="rd-mono lead-table__id">{lead.customer_id}</span> : <Dash />}</td>
            <td>
                {lead.customer_id ? (
                    <span className="rd-chip rd-chip--good">
                        <span className="rd-dot" />
                        Customer
                    </span>
                ) : (
                    <span className="rd-chip rd-chip--serious">
                        <span className="rd-dot" />
                        Prospect
                    </span>
                )}
            </td>
            <td>
                {lead.ife_area ? (
                    <span className={tagClass(areaHue(lead.ife_area_id))}>{lead.ife_area}</span>
                ) : (
                    <Dash />
                )}
            </td>
            <td>
                {lead.assignee ? (
                    <span className="rd-person rd-person--sm">
                        <Initials name={lead.assignee} colorKey={lead.assignee_id ?? lead.assignee} size="sm" />
                        <span className="rd-person__name">{lead.assignee}</span>
                    </span>
                ) : (
                    <Dash />
                )}
            </td>
            <td className="rd-num text-nowrap">{lead.mobile ? formatPhone(lead.mobile) : <Dash />}</td>
            <td className="text-nowrap" title={`${lead.created_date ?? ''} ${lead.created_time ?? ''}`.trim()}>
                {lead.created_label}
            </td>
            <td className="rd-col-actions">
                <div className="rd-actions">
                    {can('edit_lead') && (
                        <Link
                            href={route('lead.edit', lead.id)}
                            className="rd-btn rd-btn--icon"
                            aria-label={`Edit ${title}`}
                            title="Edit"
                        >
                            <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                        </Link>
                    )}
                    {can('edit_lead') && lead.deletable && (
                        <button
                            type="button"
                            className="rd-btn rd-btn--icon rd-btn--icon-danger"
                            aria-label={`Delete ${title}`}
                            title="Delete"
                            onClick={onDelete}
                        >
                            <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
                        </button>
                    )}
                    {(can('view_lead') || canAddTask || canOrder) && (
                        <Dropdown align="end">
                            <Dropdown.Toggle
                                as="button"
                                type="button"
                                bsPrefix="rd-btn rd-btn--icon"
                                aria-label={`More for ${title}`}
                                title="More"
                            >
                                <i className="mdi mdi-dots-horizontal" aria-hidden="true" />
                            </Dropdown.Toggle>
                            <Dropdown.Menu className="rd-menu rd-menu--fixed" popperConfig={{ strategy: 'fixed' }}>
                                {can('view_lead') && (
                                    <Link href={route('lead.view', lead.id)} className="dropdown-item">
                                        <i className="mdi mdi-eye-outline" aria-hidden="true" />
                                        View
                                    </Link>
                                )}
                                {canAddTask && (
                                    <Link href={route('tasks.create', { id: lead.id })} className="dropdown-item">
                                        <i className="mdi mdi-playlist-plus" aria-hidden="true" />
                                        Add task
                                    </Link>
                                )}
                                {canOrder && (
                                    <Link href={route('lead.orders.create', lead.id)} className="dropdown-item">
                                        <i className="mdi mdi-cart-plus" aria-hidden="true" />
                                        Record order
                                    </Link>
                                )}
                            </Dropdown.Menu>
                        </Dropdown>
                    )}
                </div>
            </td>
        </tr>
    );
}

function Dash() {
    return <span className="rd-muted">—</span>;
}
