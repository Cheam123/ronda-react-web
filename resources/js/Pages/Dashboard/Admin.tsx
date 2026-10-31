import { Link, usePage } from '@inertiajs/react';
import Dropdown from 'react-bootstrap/Dropdown';
import ChangeChip from '@/Components/surface/ChangeChip';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/Layouts/AppLayout';
import { formatNumber, pluralize } from '@/lib/format';
import type { PageProps } from '@/types';
import AdminTodo from './Partials/AdminTodo';
import { ActivityFeed, AreaCoverage } from './Partials/AdminPanels';
import DashboardTabs from './Partials/DashboardTabs';
import KpiTile from './Partials/KpiTile';
import SalesPanel from './Partials/SalesPanel';
import type { AdminSummary, RiskCounts } from './types';

interface AdminDashboardProps {
    summary: AdminSummary;
    /** Overdue / at-risk tasks, flagged on the Team operations tab. */
    teamRisks: RiskCounts;
}

/** The month's daily sales as a small line; decorative, the figure beside it says it all. */
function Sparkline({ values }: { values: number[] }) {
    if (values.length < 2) return null;

    const peak = Math.max(...values, 1);
    const points = values
        .map(
            (value, index) =>
                `${((index / (values.length - 1)) * 96).toFixed(1)},${(33 - (value / peak) * 30).toFixed(1)}`,
        )
        .join(' ');

    return (
        <svg className="dash-spark" width="96" height="36" viewBox="0 0 96 36" aria-hidden="true">
            <polyline
                points={points}
                fill="none"
                style={{ stroke: 'var(--rd-brand)' }}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}

/** The header's one "Add" menu: the rare jobs an admin starts from here, each behind its permission. */
function AddMenu() {
    const { can } = useAuth();
    const items = [
        can('manage_user') && { href: route('users.create'), icon: 'mdi-account-plus-outline', label: 'User' },
        can('manage_product') && { href: route('product.create'), icon: 'mdi-package-variant', label: 'Product' },
        can('form_creation') && { href: route('form.create'), icon: 'mdi-file-plus-outline', label: 'Form' },
    ].filter((item) => item !== false);

    if (items.length === 0) return null;

    return (
        <Dropdown align="end">
            <Dropdown.Toggle as="button" type="button" bsPrefix="rd-btn">
                <i className="mdi mdi-plus" aria-hidden="true" />
                Add
                <i className="mdi mdi-chevron-down" aria-hidden="true" />
            </Dropdown.Toggle>
            <Dropdown.Menu className="rd-menu">
                {items.map((item) => (
                    <Link key={item.label} href={item.href} className="dropdown-item">
                        <i className={`mdi ${item.icon}`} aria-hidden="true" />
                        {item.label}
                    </Link>
                ))}
            </Dropdown.Menu>
        </Dropdown>
    );
}

/** The admin's home: what needs them first, then the whole organisation's figures. */
export default function AdminDashboard({ summary, teamRisks }: AdminDashboardProps) {
    const { currency } = usePage<PageProps>().props.app;
    const { can } = useAuth();
    const { sales, outlets, users, approvals } = summary;

    const prospects = outlets.total - outlets.customers;
    const roleCounts = [
        pluralize(users.admins, 'admin'),
        pluralize(users.managers, 'manager'),
        pluralize(users.reps, 'field rep'),
    ].join(' · ');

    return (
        <AppLayout title="Home">
            <SurfacePage>
                <PageHeader
                    eyebrow={`Admin · ${summary.date_label}`}
                    title="Organisation overview"
                    lede={`What needs you first, then sales and activity across the organisation. Updated ${summary.generated_label}.`}
                    actions={<AddMenu />}
                />

                <DashboardTabs active="organisation" overdue={teamRisks.overdue} />

                <div className="rd-grid">
                    <AdminTodo summary={summary} className="rd-span-5" />

                    <section className="rd-kpis rd-kpis--pair dash-figures rd-span-7" aria-label="Key figures">
                        <KpiTile
                            icon="mdi-receipt"
                            label="Orders this month"
                            value={`${currency} ${formatNumber(sales.month_value)}`}
                            note={`${pluralize(sales.month_count, 'order')} from ${pluralize(sales.month_outlets, 'outlet')}`}
                            aside={<Sparkline values={sales.daily.map((day) => day.value)} />}
                            foot={
                                sales.change_pct === null ? (
                                    <span>Nothing to compare with last month</span>
                                ) : (
                                    <span className="d-inline-flex flex-wrap align-items-center gap-2">
                                        <ChangeChip percent={sales.change_pct} />
                                        vs last month, same days
                                    </span>
                                )
                            }
                        />
                        <KpiTile
                            icon="mdi-storefront-outline"
                            label="Outlets"
                            value={outlets.total}
                            note={`${outlets.customers} customers · ${prospects} prospects`}
                            foot={
                                <span className="d-flex flex-column gap-2 w-100">
                                    {outlets.total > 0 && (
                                        <span className="rd-stack" aria-hidden="true">
                                            {outlets.customers > 0 && (
                                                <span
                                                    style={{
                                                        flexGrow: outlets.customers,
                                                        background: 'var(--rd-brand)',
                                                    }}
                                                />
                                            )}
                                            {prospects > 0 && (
                                                <span
                                                    style={{ flexGrow: prospects, background: 'var(--rd-brand-soft)' }}
                                                />
                                            )}
                                        </span>
                                    )}
                                    <span>{outlets.new_month} new this month</span>
                                </span>
                            }
                        />
                        <KpiTile
                            icon="mdi-account-group-outline"
                            label="Active users"
                            value={users.active}
                            note={roleCounts}
                            foot={
                                can('manage_user') ? (
                                    <Link href={route('users.index')} className="fw-semibold text-decoration-none">
                                        Manage users
                                    </Link>
                                ) : undefined
                            }
                        />
                        <KpiTile
                            icon="mdi-file-check-outline"
                            tone={approvals.pending > 0 ? 'serious' : 'brand'}
                            label="Awaiting approval"
                            value={approvals.pending}
                            note={
                                approvals.pending > 0
                                    ? `Form submissions · oldest ${approvals.oldest_label}`
                                    : 'No form submissions waiting'
                            }
                            foot={
                                <>
                                    {approvals.slow > 0 ? (
                                        <span className="rd-status rd-status--serious">
                                            <i className="mdi mdi-clock-outline" aria-hidden="true" />
                                            {approvals.slow} waiting over 48 hours
                                        </span>
                                    ) : (
                                        <span>None waiting over 48 hours</span>
                                    )}
                                    {can('form_admin') && (
                                        <Link
                                            href={route('form.records.all', { status: 'pending' })}
                                            className="fw-semibold text-decoration-none"
                                        >
                                            Review all
                                        </Link>
                                    )}
                                </>
                            }
                        />
                    </section>

                    <SalesPanel sales={sales} currency={currency} />
                    <ActivityFeed activity={summary.activity} currency={currency} />
                    <AreaCoverage areas={summary.areas} />
                </div>
            </SurfacePage>
        </AppLayout>
    );
}
