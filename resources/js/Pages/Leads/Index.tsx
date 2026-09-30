import { Link, router } from '@inertiajs/react';
import type { FormEvent } from 'react';
import IfeAreaListButton from '@/Components/areas/IfeAreaListButton';
import Select from '@/Components/form/Select';
import TextInput from '@/Components/form/TextInput';
import Button, { ButtonLink } from '@/Components/ui/Button';
import Card from '@/Components/ui/Card';
import DataTable, { EmptyRow } from '@/Components/ui/DataTable';
import InfoList from '@/Components/ui/InfoList';
import Pagination from '@/Components/ui/Pagination';
import { useAuth } from '@/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';
import AppLayout from '@/Layouts/AppLayout';
import { avatarFor } from '@/lib/avatar';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import { confirm } from '@/lib/dialogs';
import { digitsOnly } from '@/lib/input';
import type { BreadcrumbProps, Paginated, QueryParams } from '@/types';
import type { IfeAreaOption, LeadListItem } from '@/types/leads';

const CUSTOMER_ID_OPTIONS = [
    { value: 'Y', label: 'With Customer ID' },
    { value: 'N', label: 'Without Customer ID' },
];

interface LeadsIndexProps extends BreadcrumbProps {
    leads: Paginated<LeadListItem>;
    ifeAreas: IfeAreaOption[];
    filters: QueryParams;
}

export default function LeadsIndex({ leads, ifeAreas, filters, ...breadcrumb }: LeadsIndexProps) {
    const { can } = useAuth();
    const { values, set, apply, reset } = useFilters(route('lead.index'), {
        start: filters.start ?? '',
        end: filters.end ?? '',
        has_customerid: filters.has_customerid ?? '',
        ifearea: filters.ifearea ?? '',
        lead_name: filters.lead_name ?? '',
        business_name: filters.business_name ?? '',
        mobile: filters.mobile ?? '',
        customer_id: filters.customer_id ?? '',
    });

    const search = (event: FormEvent) => {
        event.preventDefault();
        apply();
    };

    const deleteLead = async (lead: LeadListItem) => {
        if (await confirm({ title: 'Please confirm to proceed on the deletion!', text: lead.name ?? '', danger: true })) {
            router.post(route('lead.delete'), { id: lead.id }, { preserveScroll: true });
        }
    };

    const firstRow = leads.from ?? 1;

    return (
        <AppLayout title="Customer" breadcrumb={breadcrumbFrom(breadcrumb)}>
            <Card
                variant="plain"
                header={
                    <form onSubmit={search}>
                        <div className="row g-1">
                            <div className="col-md-3">
                                <div className="input-group input-group-sm">
                                    <TextInput
                                        type="date"
                                        aria-label="Created from"
                                        title="Created (from)"
                                        value={values.start}
                                        onChange={(event) => set('start', event.target.value)}
                                    />
                                    <TextInput
                                        type="date"
                                        aria-label="Created to"
                                        title="Created (to)"
                                        value={values.end}
                                        onChange={(event) => set('end', event.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="col-md-3">
                                <Select
                                    aria-label="Customer ID"
                                    placeholder="All Leads/Customers"
                                    options={CUSTOMER_ID_OPTIONS}
                                    value={values.has_customerid}
                                    onChange={(event) => set('has_customerid', event.target.value)}
                                />
                            </div>
                            <div className="col-md-3">
                                <Select
                                    aria-label="IFE area"
                                    placeholder="-- Select IFE Area --"
                                    options={ifeAreas}
                                    value={values.ifearea}
                                    onChange={(event) => set('ifearea', event.target.value)}
                                />
                            </div>
                        </div>
                        <div className="row g-1 mt-1">
                            <div className="col-md-3">
                                <TextInput
                                    maxLength={255}
                                    placeholder="Company Name"
                                    value={values.lead_name}
                                    onChange={(event) => set('lead_name', event.target.value)}
                                />
                            </div>
                            <div className="col-md-3">
                                <TextInput
                                    maxLength={255}
                                    placeholder="Shop Name"
                                    value={values.business_name}
                                    onChange={(event) => set('business_name', event.target.value)}
                                />
                            </div>
                            <div className="col-md-3">
                                <TextInput
                                    maxLength={14}
                                    placeholder="Lead/Customer Mobile"
                                    onKeyDown={digitsOnly}
                                    value={values.mobile}
                                    onChange={(event) => set('mobile', event.target.value)}
                                />
                            </div>
                            <div className="col-md-3">
                                <TextInput
                                    maxLength={12}
                                    placeholder="Customer ID"
                                    onKeyDown={digitsOnly}
                                    value={values.customer_id}
                                    onChange={(event) => set('customer_id', event.target.value)}
                                />
                            </div>
                        </div>
                        <div className="d-flex flex-wrap gap-1 pt-2">
                            <Button variant="light" size="sm" className="filter-button" onClick={reset}>
                                Reset
                            </Button>
                            <Button type="submit" size="sm" className="filter-button">
                                Search
                            </Button>
                            {can('create_lead') && (
                                <ButtonLink href={route('lead.create')} size="sm" className="filter-button">
                                    Add
                                </ButtonLink>
                            )}
                            <IfeAreaListButton areas={ifeAreas} />
                        </div>
                    </form>
                }
            >
                <Pagination links={leads.links} />
                <DataTable>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th style={{ width: '20%' }}>Name</th>
                            <th>Area</th>
                            <th>Handler Information</th>
                            <th>Lead/Customer Information</th>
                            <th>Created At</th>
                            <th style={{ width: 100 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {leads.data.map((lead, index) => (
                            <tr key={lead.id}>
                                <td>{firstRow + index}</td>
                                <td>
                                    {lead.customer_id && (
                                        <img
                                            className="rounded-circle header-profile-user me-1"
                                            src={avatarFor('M')}
                                            height={10}
                                            alt=""
                                        />
                                    )}
                                    {lead.name}
                                    <InfoList
                                        items={[
                                            ['Customer ID', lead.customer_id],
                                            ['Shop Name', lead.business_name],
                                            ['Mobile No.', lead.mobile],
                                            ['Email Address', lead.email],
                                        ]}
                                    />
                                </td>
                                <td>{lead.location}</td>
                                <td>
                                    <InfoList
                                        items={[
                                            ['Handler', lead.upline_name],
                                            ['Pre-Sales', lead.presales_name],
                                            ['Closing Sales', lead.closing_sales_name],
                                            ['IFE Area', lead.ife_area],
                                        ]}
                                    />
                                </td>
                                <td>
                                    <InfoList
                                        items={[
                                            ['Creator', lead.created_by],
                                            ['Subscriber', lead.assignee],
                                        ]}
                                    />
                                </td>
                                <td className="custom-font-xxsmall">
                                    {lead.created_date}
                                    <br />
                                    {lead.created_time}
                                </td>
                                <td>
                                    <div className="d-flex gap-1">
                                        {can('edit_lead') && lead.deletable && (
                                            <Button variant="danger" size="sm" onClick={() => deleteLead(lead)}>
                                                Delete
                                            </Button>
                                        )}
                                        {can('view_lead') && (
                                            <Link className="btn btn-sm btn-primary custom-button-shadow" href={route('lead.view', lead.id)}>
                                                View
                                            </Link>
                                        )}
                                        {can('edit_lead') && (
                                            <Link className="btn btn-sm btn-primary custom-button-shadow" href={route('lead.edit', lead.id)}>
                                                Edit
                                            </Link>
                                        )}
                                        {can('add_task') && lead.taskable && (
                                            <Link
                                                className="btn btn-sm btn-primary custom-button-shadow"
                                                href={route('tasks.create', { id: lead.id })}
                                            >
                                                + Task
                                            </Link>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {leads.data.length === 0 && <EmptyRow colSpan={7}>No leads found.</EmptyRow>}
                    </tbody>
                </DataTable>
                <Pagination links={leads.links} className="mt-2" />
            </Card>
        </AppLayout>
    );
}
