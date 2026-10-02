import { Link, usePage } from '@inertiajs/react';
import Initials from '@/Components/surface/Initials';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/Layouts/AppLayout';
import { formatNumber, pluralize } from '@/lib/format';
import type { PageProps } from '@/types';
import AdminTodo from './Partials/AdminTodo';
import { ActivityFeed, AreaCoverage, Automations, PeoplePanel, TopProducts } from './Partials/AdminPanels';
import ChangeChip from '@/Components/surface/ChangeChip';
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
        <svg width="96" height="36" viewBox="0 0 96 36" aria-hidden="true" style={{ flexShrink: 0 }}>
            <polyline
                points={points}
                fill="none"
                stroke="#0D729E"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}

/** The admin's home: the whole organisation, not the team's task list. */
export default function AdminDashboard({ summary, teamRisks }: AdminDashboardProps) {
    const { currency } = usePage<PageProps>().props.app;
    const { can } = useAuth();
    const { sales, outlets, people, approvals } = summary;

    const prospects = outlets.total - outlets.customers;
    const roleCounts = [
        pluralize(people.filter((person) => person.type === 0).length, 'admin'),
        pluralize(people.filter((person) => person.type === 1).length, 'manager'),
        pluralize(people.filter((person) => person.type === 2).length, 'field rep'),
    ].join(' · ');
    const telegramLinked = people.filter((person) => person.telegram).length;

    return (
        <AppLayout title="Home">
            <SurfacePage>
                <PageHeader
                    eyebrow={`Admin · ${summary.date_label}`}
                    title="Organisation overview"
                    lede={`Sales, people, the catalogue and the jobs that keep Ronda running. Updated ${summary.generated_label}.`}
                    actions={
                        <>
                            {can('form_creation') && (
                                <Link href={route('form.create')} className="rd-btn">
                                    <i className="mdi mdi-file-plus-outline" aria-hidden="true" />
                                    New form
                                </Link>
                            )}
                            {can('manage_product') && (
                                <Link href={route('product.create')} className="rd-btn">
                                    <i className="mdi mdi-package-variant" aria-hidden="true" />
                                    Add product
                                </Link>
                            )}
                            {can('manage_user') && (
                                <Link href={route('users.create')} className="rd-btn rd-btn--primary">
                                    <i className="mdi mdi-plus" aria-hidden="true" />
                                    Add user
                                </Link>
                            )}
                        </>
                    }
                />

                <DashboardTabs active="organisation" overdue={teamRisks.overdue} />

                <section className="rd-kpis" aria-label="Key figures">
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
                                <span className="d-inline-flex align-items-center gap-2">
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
                                            <span style={{ flexGrow: outlets.customers, background: '#0D729E' }} />
                                        )}
                                        {prospects > 0 && (
                                            <span style={{ flexGrow: prospects, background: '#BFD8E3' }} />
                                        )}
                                    </span>
                                )}
                                <span>
                                    {outlets.new_month} new this month &middot; {outlets.without_area} without an IFE
                                    area
                                </span>
                            </span>
                        }
                    />
                    <KpiTile
                        icon="mdi-account-group-outline"
                        label="Active users"
                        value={people.length}
                        note={roleCounts}
                        aside={
                            <span className="d-flex">
                                {people.slice(0, 5).map((person) => (
                                    <Initials key={person.id} name={person.name} colorKey={person.id} stacked />
                                ))}
                            </span>
                        }
                        foot={
                            <>
                                <span>
                                    Telegram linked for {telegramLinked} of {people.length}
                                </span>
                                {can('manage_user') && (
                                    <Link href={route('users.index')} className="fw-semibold text-decoration-none">
                                        Manage users
                                    </Link>
                                )}
                            </>
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

                <div className="rd-grid">
                    <SalesPanel sales={sales} currency={currency} className="rd-span-8" />
                    <AdminTodo summary={summary} className="rd-span-4" />
                    <TopProducts sales={sales} currency={currency} />
                    <PeoplePanel people={people} />
                    <AreaCoverage areas={summary.areas} />
                    <ActivityFeed activity={summary.activity} currency={currency} />
                    <Automations automations={summary.automations} currency={currency} />
                </div>
            </SurfacePage>
        </AppLayout>
    );
}
