import { Link, router } from '@inertiajs/react';
import type { FormEvent } from 'react';
import SearchSelect from '@/Components/form/SearchSelect';
import TextInput from '@/Components/form/TextInput';
import Button from '@/Components/ui/Button';
import Card from '@/Components/ui/Card';
import DataTable, { EmptyRow } from '@/Components/ui/DataTable';
import Pagination from '@/Components/ui/Pagination';
import { useAuth } from '@/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';
import AppLayout from '@/Layouts/AppLayout';
import { confirm } from '@/lib/dialogs';
import { compactParams, digitsOnly } from '@/lib/input';
import type { Paginated, QueryParams, SelectOption } from '@/types';

interface IfeReportListItem {
    id: number;
    ife_area: string | null;
    salesperson: string | null;
    company_name: string | null;
    shop_name: string | null;
    created_at: string;
    location: string | null;
    has_task: boolean;
}

interface IfeReportsIndexProps {
    reports: Paginated<IfeReportListItem>;
    salespeople: SelectOption[];
    ifeAreas: SelectOption[];
    filters: QueryParams;
}

/** In-field visit reports filed from the app. */
export default function IfeReportsIndex({ reports, salespeople, ifeAreas, filters }: IfeReportsIndexProps) {
    const { can } = useAuth();
    const { values, set, apply, reset } = useFilters(route('ifereport.index'), {
        start: filters.start ?? '',
        end: filters.end ?? '',
        ifearea: filters.ifearea ?? '',
        salesperson: filters.salesperson ?? '',
        company_name: filters.company_name ?? '',
        cafe_name: filters.cafe_name ?? '',
        mobile: filters.mobile ?? '',
    });

    const search = (event: FormEvent) => {
        event.preventDefault();
        apply();
    };

    // The export is a file download, so it is a plain navigation, not a visit.
    const exportExcel = () => {
        window.location.href = route('ifereport.export', compactParams(values));
    };

    const convertToTask = async (report: IfeReportListItem) => {
        if (await confirm({ title: 'Please confirm to convert this report to sales task!' })) {
            router.post(
                route('ifereport.convert'),
                { ...compactParams(filters), id: report.id },
                { preserveScroll: true },
            );
        }
    };

    const firstRow = reports.from ?? 1;

    return (
        <AppLayout title="IFE Report">
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
                                <SearchSelect
                                    placeholder="-- Select IFE Area --"
                                    options={ifeAreas}
                                    value={values.ifearea}
                                    onChange={(value) => set('ifearea', value)}
                                />
                            </div>
                            <div className="col-md-3">
                                <SearchSelect
                                    placeholder="-- Select Salesperson --"
                                    options={salespeople}
                                    value={values.salesperson}
                                    onChange={(value) => set('salesperson', value)}
                                />
                            </div>
                        </div>
                        <div className="row g-1 mt-1">
                            <div className="col-md-3">
                                <TextInput
                                    maxLength={255}
                                    placeholder="Company Name"
                                    value={values.company_name}
                                    onChange={(event) => set('company_name', event.target.value)}
                                />
                            </div>
                            <div className="col-md-3">
                                <TextInput
                                    maxLength={255}
                                    placeholder="Cafe Name"
                                    value={values.cafe_name}
                                    onChange={(event) => set('cafe_name', event.target.value)}
                                />
                            </div>
                            <div className="col-md-3">
                                <TextInput
                                    maxLength={14}
                                    placeholder="Mobile"
                                    onKeyDown={digitsOnly}
                                    value={values.mobile}
                                    onChange={(event) => set('mobile', event.target.value)}
                                />
                            </div>
                        </div>
                        <div className="d-flex gap-1 pt-2">
                            <Button variant="light" size="sm" className="filter-button" onClick={reset}>
                                Reset
                            </Button>
                            <Button type="submit" size="sm" className="filter-button">
                                Search
                            </Button>
                            <Button variant="success" size="sm" className="filter-button" onClick={exportExcel}>
                                Export Excel
                            </Button>
                        </div>
                    </form>
                }
            >
                <Pagination links={reports.links} />
                <DataTable>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>IFE Area</th>
                            <th>Salesperson</th>
                            <th>Company Name</th>
                            <th>Cafe Name</th>
                            <th>Created At</th>
                            <th style={{ width: 100 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {reports.data.map((report, index) => (
                            <tr key={report.id}>
                                <td>{firstRow + index}</td>
                                <td>{report.ife_area}</td>
                                <td>{report.salesperson}</td>
                                <td>{report.company_name}</td>
                                <td>{report.shop_name}</td>
                                <td className="custom-font-xxsmall text-wrap">
                                    <span className="text-primary">{report.created_at}</span>
                                    <br />
                                    {report.location}
                                </td>
                                <td>
                                    <div className="d-flex gap-1 justify-content-end">
                                        {!report.has_task && can('manage_ife_report') && (
                                            <Button variant="danger" size="sm" onClick={() => convertToTask(report)}>
                                                + Task
                                            </Button>
                                        )}
                                        <Link
                                            className="btn btn-sm btn-primary custom-button-shadow"
                                            href={route('ifereport.view', { ...compactParams(filters), id: report.id })}
                                        >
                                            View
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {reports.data.length === 0 && <EmptyRow colSpan={7}>No reports in this period.</EmptyRow>}
                    </tbody>
                </DataTable>
                <Pagination links={reports.links} className="mt-2" />
            </Card>
        </AppLayout>
    );
}
