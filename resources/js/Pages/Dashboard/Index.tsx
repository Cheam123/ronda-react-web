import { usePage } from '@inertiajs/react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import { compactNumber, formatMoney } from '@/lib/format';
import type { PageProps } from '@/types';
import FocusAlerts from './Partials/FocusAlerts';
import MorningRoundUp from './Partials/MorningRoundUp';
import StatTile from './Partials/StatTile';
import TeamActivity from './Partials/TeamActivity';
import TrendChart from './Partials/TrendChart';
import type { DailyDigest, DashboardSummary } from './types';

interface DashboardProps {
    /** Admins and Managers get the team view; a Field Rep sees their own work. */
    isTeam: boolean;
    summary: DashboardSummary;
    digest: DailyDigest | null;
    digestStatus: string | null;
    risk: { hours: number; percent: number };
}

export default function Dashboard({ isTeam, summary, digest, digestStatus, risk }: DashboardProps) {
    const { currency } = usePage<PageProps>().props.app;
    const { tasks, forms, visits, orders } = summary;

    return (
        <AppLayout title="Home">
            <div className="dash py-2">
                <div className="d-flex flex-wrap justify-content-between align-items-baseline mb-3">
                    <h5 className="mb-0">{isTeam ? 'Team dashboard' : 'My dashboard'}</h5>
                    <span className="dash-sub">
                        Updated {summary.generated_label} &middot; &quot;7 days&quot; is today and the six days before
                    </span>
                </div>

                <div className="dash-tiles mb-3">
                    <StatTile
                        label="Open tasks"
                        value={compactNumber(tasks.open)}
                        note={
                            <>
                                {tasks.new} new &middot; {tasks.in_progress} in progress
                            </>
                        }
                    />
                    <StatTile
                        label={
                            <>
                                <i className="mdi mdi-alert-octagon dash-icon--critical" /> Overdue
                            </>
                        }
                        value={compactNumber(tasks.overdue)}
                        note="past their due time"
                    />
                    <StatTile
                        label={
                            <>
                                <i className="mdi mdi-alert dash-icon--serious" /> At risk
                            </>
                        }
                        value={compactNumber(tasks.at_risk)}
                        note={`due within ${risk.hours} h or ${risk.percent}% of time used`}
                    />
                    <StatTile label="Due today" value={compactNumber(tasks.due_today)} note="open tasks" />
                    <StatTile
                        label="Tasks done, 7 days"
                        value={compactNumber(tasks.done_7d)}
                        note={
                            <>
                                {tasks.created_7d} created &middot; {tasks.completed_7d} completed
                            </>
                        }
                    />
                    <StatTile
                        label="Visits, 7 days"
                        value={compactNumber(visits.last_7d)}
                        note={`${visits.today} today`}
                    />
                    <StatTile
                        label="Forms submitted, 7 days"
                        value={compactNumber(forms.submitted_7d)}
                        note={
                            <>
                                {forms.pending} pending &middot; {forms.approved} approved &middot; {forms.rejected}{' '}
                                rejected
                            </>
                        }
                    />
                    <StatTile
                        label="Orders this month"
                        value={`${currency} ${compactNumber(orders.month_value)}`}
                        note={
                            <>
                                {orders.month_count} orders &middot; {currency} {formatMoney(orders.month_value)}
                            </>
                        }
                    />
                </div>

                <div className="row g-3 mb-3">
                    <div className={clsx(isTeam ? 'col-xl-7' : 'col-12')}>
                        <div className="dash-card">
                            <h6>Tasks created vs. done, last 14 days</h6>
                            <TrendChart trend={summary.trend} />
                        </div>
                    </div>
                    {isTeam && (
                        <div className="col-xl-5">
                            <MorningRoundUp digest={digest} status={digestStatus} />
                        </div>
                    )}
                </div>

                <FocusAlerts items={summary.attention} />

                {isTeam && <TeamActivity team={summary.team} currency={currency} />}
            </div>
        </AppLayout>
    );
}
