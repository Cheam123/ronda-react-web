import { Link, router } from '@inertiajs/react';
import clsx from 'clsx';
import type { FormEvent } from 'react';
import SearchSelect from '@/Components/form/SearchSelect';
import DateRangeMenu from '@/Components/surface/DateRangeMenu';
import Initials from '@/Components/surface/Initials';
import PageHeader from '@/Components/surface/PageHeader';
import Pager from '@/Components/surface/Pager';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useAuth } from '@/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';
import AppLayout from '@/Layouts/AppLayout';
import { confirm } from '@/lib/dialogs';
import { formatNumber } from '@/lib/format';
import { compactParams } from '@/lib/input';
import { areaHue, tagClass } from '@/lib/tags';
import type { Paginated, QueryParams, SelectOption } from '@/types';

interface IfeReportListItem {
    id: number;
    ife_area: string | null;
    ife_area_id: number | null;
    salesperson: string | null;
    salesperson_id: number | null;
    company_name: string | null;
    shop_name: string | null;
    filed_date: string;
    filed_time: string;
    location: string | null;
    has_task: boolean;
}

/** The task filter: '' every report, open has no task yet, made became one. */
type TaskTab = '' | 'open' | 'made';

interface IfeReportsIndexProps {
    reports: Paginated<IfeReportListItem>;
    /** Reports per tab, with the other filters applied. */
    counts: { all: number; open: number; made: number };
    salespeople: SelectOption[];
    ifeAreas: SelectOption[];
    /** The query string, with the 30-day range the controller defaulted. */
    filters: QueryParams;
}

/** In-field visit reports filed from the app. */
export default function IfeReportsIndex({ reports, counts, salespeople, ifeAreas, filters }: IfeReportsIndexProps) {
    const { can } = useAuth();
    const { values, set, apply, choose } = useFilters(route('ifereport.index'), {
        search: filters.search ?? '',
        task: filters.task ?? '',
        ifearea: filters.ifearea ?? '',
        salesperson: filters.salesperson ?? '',
        start: filters.start ?? '',
        end: filters.end ?? '',
    });
    const canMakeTasks = can('manage_ife_report');

    const search = (event: FormEvent) => {
        event.preventDefault();
        apply();
    };

    const makeTask = async (report: IfeReportListItem) => {
        const outlet = report.shop_name || report.company_name || 'this outlet';
        const confirmed = await confirm({
            title: 'Make a task from this report?',
            text:
                `An in-progress task on ${outlet}, with ${report.salesperson ?? 'the salesperson'} as subscriber ` +
                'and you as checker and owner. If the visit isn’t linked to an outlet yet, it is added as a new lead first.',
            confirmText: 'Make task',
        });

        if (confirmed) {
            router.post(
                route('ifereport.convert'),
                { ...compactParams(filters), id: report.id },
                { preserveScroll: true },
            );
        }
    };

    const tabs: { value: TaskTab; label: string; count: number }[] = [
        { value: '', label: 'All', count: counts.all },
        { value: 'open', label: 'No task yet', count: counts.open },
        { value: 'made', label: 'Made into a task', count: counts.made },
    ];
    const filtered = Boolean(filters.search || filters.ifearea || filters.salesperson);

    return (
        <AppLayout title="IFE reports">
            <SurfacePage>
                <PageHeader
                    crumbs={[{ label: 'Home', href: '/index' }, { label: 'IFE Report' }]}
                    title="IFE reports"
                    lede={
                        canMakeTasks
                            ? 'Visit reports filed from the mobile app. Make one into a task to follow it up.'
                            : 'Visit reports filed from the mobile app.'
                    }
                />

                <section className="rd-panel rd-list" aria-labelledby="ife-reports-title">
                    <div className="rd-list__head">
                        <h2 id="ife-reports-title" className="rd-list__title">
                            Visit reports
                        </h2>
                        <div className="rd-list__actions">
                            {/* A file download, so a plain link rather than an Inertia visit. */}
                            <a
                                href={route('ifereport.export', compactParams(filters))}
                                className="rd-btn rd-btn--lg"
                                download
                            >
                                <i className="mdi mdi-download" aria-hidden="true" />
                                Export to Excel
                            </a>
                        </div>
                    </div>

                    <div className="rd-list__bar">
                        <nav className="rd-tabs" aria-label="Made into a task or not">
                            {tabs.map((tab) => {
                                const active = values.task === tab.value;

                                return (
                                    <button
                                        key={tab.label}
                                        type="button"
                                        className={clsx('rd-tabs__tab', active && 'is-active')}
                                        aria-current={active ? 'true' : undefined}
                                        onClick={() => choose({ task: tab.value })}
                                    >
                                        {tab.label} <span className="rd-count">{formatNumber(tab.count)}</span>
                                    </button>
                                );
                            })}
                        </nav>

                        <div className="rd-list__filters ife-filters">
                            <form role="search" onSubmit={search}>
                                <label className="rd-search">
                                    <i className="mdi mdi-magnify" aria-hidden="true" />
                                    <input
                                        type="search"
                                        className="rd-input"
                                        aria-label="Search reports"
                                        placeholder="Search shop, company or mobile"
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
                                onChange={(value) => choose({ ifearea: value })}
                            />
                            <SearchSelect
                                compact
                                ariaLabel="Salesperson"
                                options={[{ value: '', label: 'All salespeople' }, ...salespeople]}
                                clearable={false}
                                value={values.salesperson}
                                onChange={(value) => choose({ salesperson: value })}
                            />
                            {/* The controller always applies a range (the last 30 days by default). */}
                            <DateRangeMenu
                                label="Filed"
                                start={values.start}
                                end={values.end}
                                clearable={false}
                                onApply={(start, end) => choose({ start, end })}
                            />
                        </div>
                    </div>

                    <div className="rd-scroll">
                        <table className="rd-table rd-table--band ife-table">
                            <thead>
                                <tr>
                                    <th scope="col">Outlet</th>
                                    <th scope="col">IFE area</th>
                                    <th scope="col">Salesperson</th>
                                    <th scope="col" aria-sort="descending">
                                        <span className="rd-sorted">
                                            Filed
                                            <i className="mdi mdi-arrow-down" aria-hidden="true" />
                                        </span>
                                    </th>
                                    <th scope="col">Location</th>
                                    <th scope="col">Task</th>
                                    <th scope="col" className="rd-col-actions">
                                        <span className="visually-hidden">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.data.map((report) => (
                                    <ReportRow
                                        key={report.id}
                                        report={report}
                                        filters={filters}
                                        canMakeTask={canMakeTasks}
                                        onMakeTask={() => makeTask(report)}
                                    />
                                ))}
                                {reports.data.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="rd-list__empty">
                                            No reports in this period.{' '}
                                            {filtered && (
                                                <button
                                                    type="button"
                                                    className="btn btn-link p-0 align-baseline"
                                                    onClick={() => choose({ search: '', ifearea: '', salesperson: '' })}
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
                            {reports.total > 0 ? (
                                <>
                                    Showing{' '}
                                    <strong>
                                        {reports.from}–{reports.to}
                                    </strong>{' '}
                                    of <strong>{formatNumber(reports.total)}</strong>{' '}
                                    {reports.total === 1 ? 'report' : 'reports'}
                                </>
                            ) : (
                                'No reports'
                            )}
                        </span>
                        <Pager links={reports.links} />
                    </div>
                </section>
            </SurfacePage>
        </AppLayout>
    );
}

interface ReportRowProps {
    report: IfeReportListItem;
    filters: QueryParams;
    canMakeTask: boolean;
    onMakeTask: () => void;
}

function ReportRow({ report, filters, canMakeTask, onMakeTask }: ReportRowProps) {
    const title = report.shop_name || report.company_name || 'Visit report';
    const company = report.shop_name ? report.company_name : null;
    const href = route('ifereport.view', { ...compactParams(filters), id: report.id });

    return (
        <tr>
            <td className="ife-table__outlet">
                <div className="rd-person">
                    <Initials name={title} colorKey={`ife-${report.id}`} size="lg" />
                    <span className="rd-person__text">
                        <Link href={href} className="rd-person__name">
                            {title}
                        </Link>
                        {company && <span className="rd-person__sub">{company}</span>}
                    </span>
                </div>
            </td>
            <td className="ife-table__area">
                {report.ife_area ? (
                    <span className={tagClass(areaHue(report.ife_area_id))}>{report.ife_area}</span>
                ) : (
                    <span className="rd-muted">—</span>
                )}
            </td>
            <td className="ife-table__by">
                {report.salesperson ? (
                    <span className="rd-person rd-person--sm">
                        <Initials
                            name={report.salesperson}
                            colorKey={report.salesperson_id ?? report.salesperson}
                            size="sm"
                        />
                        <span className="rd-person__name">{report.salesperson}</span>
                    </span>
                ) : (
                    <span className="rd-muted">—</span>
                )}
            </td>
            <td className="ife-table__filed text-nowrap">
                <span className="ife-table__date">{report.filed_date}</span>
                <span className="ife-table__time">{report.filed_time}</span>
            </td>
            <td className="ife-table__location">
                {report.location ? (
                    <span className="ife-table__address" title={report.location}>
                        {report.location}
                    </span>
                ) : (
                    <span className="rd-muted">—</span>
                )}
            </td>
            <td className="ife-table__task">
                {report.has_task ? (
                    <span className="rd-chip rd-chip--good">
                        <span className="rd-dot" />
                        Task made
                    </span>
                ) : canMakeTask ? (
                    <button type="button" className="rd-btn" onClick={onMakeTask}>
                        <i className="mdi mdi-plus" aria-hidden="true" />
                        Make task
                    </button>
                ) : (
                    <span className="rd-muted">No task yet</span>
                )}
            </td>
            <td className="rd-col-actions">
                <div className="rd-actions">
                    <Link
                        href={href}
                        className="rd-btn rd-btn--icon"
                        aria-label={`View the report on ${title}`}
                        title="View"
                    >
                        <i className="mdi mdi-eye-outline" aria-hidden="true" />
                    </Link>
                </div>
            </td>
        </tr>
    );
}
