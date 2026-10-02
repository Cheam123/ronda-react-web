import { Link, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useState } from 'react';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/Layouts/AppLayout';
import type { PageProps } from '@/types';
import DashboardTabs from './Partials/DashboardTabs';
import FieldOutput from './Partials/FieldOutput';
import MorningRoundUp from './Partials/MorningRoundUp';
import NeedsAttention, { type AttentionFilter } from './Partials/NeedsAttention';
import TeamActivity from './Partials/TeamActivity';
import TrendChart from './Partials/TrendChart';
import type { DailyDigest, DashboardSummary, RiskLevel } from './types';

const ATTENTION_ID = 'needs-attention';

interface DashboardProps {
    /** Admins and Managers get the team view; a Field Rep sees their own work. */
    isTeam: boolean;
    /** Admins can switch back to the organisation overview. */
    showViewTabs: boolean;
    summary: DashboardSummary;
    digest: DailyDigest | null;
    digestStatus: string | null;
    risk: { hours: number; percent: number };
}

function greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

/** "3 tasks are overdue and 5 are at risk." */
function headline(overdue: number, atRisk: number): string {
    if (overdue === 0 && atRisk === 0) return 'Nothing is overdue or at risk.';
    const tasks = (count: number) => `${count} ${count === 1 ? 'task is' : 'tasks are'}`;
    if (atRisk === 0) return `${tasks(overdue)} overdue.`;
    if (overdue === 0) return `${tasks(atRisk)} at risk.`;
    return `${tasks(overdue)} overdue and ${atRisk} ${atRisk === 1 ? 'is' : 'are'} at risk.`;
}

export default function Dashboard({ isTeam, showViewTabs, summary, digest, digestStatus, risk }: DashboardProps) {
    const { currency } = usePage<PageProps>().props.app;
    const { user, can } = useAuth();
    const [filter, setFilter] = useState<AttentionFilter>('all');
    const { tasks } = summary;
    const firstName = user?.name.split(' ')[0] ?? '';

    // The Overdue / At risk tiles narrow the list below and move to it.
    const showLevel = (level: RiskLevel) => {
        setFilter((current) => (current === level ? 'all' : level));
        document.getElementById(ATTENTION_ID)?.focus({ preventScroll: true });
        document.getElementById(ATTENTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <AppLayout title="Home">
            <SurfacePage>
                <PageHeader
                    eyebrow={`${isTeam ? 'Team dashboard' : 'My dashboard'} · ${summary.date_label}`}
                    title={`${greeting()}, ${firstName}`}
                    lede={`${headline(tasks.overdue, tasks.at_risk)} Updated ${summary.time_label}. “7 days” means today and the six days before.`}
                    actions={
                        can('add_task') && (
                            <Link href={route('tasks.create')} className="rd-btn rd-btn--primary">
                                <i className="mdi mdi-plus" aria-hidden="true" />
                                New task
                            </Link>
                        )
                    }
                />

                {showViewTabs && <DashboardTabs active="team" />}

                <section className="rd-kpis" aria-label="Today">
                    <button
                        type="button"
                        className={clsx(
                            'rd-kpi rd-kpi--accent rd-kpi--critical',
                            filter === 'overdue' && 'is-selected',
                        )}
                        aria-pressed={filter === 'overdue'}
                        onClick={() => showLevel('overdue')}
                    >
                        <span className="rd-kpi__label">
                            <i className="mdi mdi-alert-octagon" aria-hidden="true" />
                            Overdue
                        </span>
                        <span className="rd-kpi__value">{tasks.overdue}</span>
                        <span className="rd-kpi__note">Past their due time</span>
                    </button>
                    <button
                        type="button"
                        className={clsx('rd-kpi rd-kpi--accent rd-kpi--serious', filter === 'at_risk' && 'is-selected')}
                        aria-pressed={filter === 'at_risk'}
                        onClick={() => showLevel('at_risk')}
                    >
                        <span className="rd-kpi__label">
                            <i className="mdi mdi-alert" aria-hidden="true" />
                            At risk
                        </span>
                        <span className="rd-kpi__value">{tasks.at_risk}</span>
                        <span className="rd-kpi__note">
                            Due within {risk.hours} h, or {risk.percent}% of their time used
                        </span>
                    </button>
                    <div className="rd-kpi rd-kpi--accent rd-kpi--brand">
                        <span className="rd-kpi__label">
                            <i className="mdi mdi-clock-outline" aria-hidden="true" />
                            Due today
                        </span>
                        <span className="rd-kpi__value">{tasks.due_today}</span>
                        <span className="rd-kpi__note">Open tasks due before midnight</span>
                    </div>
                    <div className="rd-kpi rd-kpi--accent">
                        <span className="rd-kpi__label">
                            <i className="mdi mdi-clipboard-text-outline" aria-hidden="true" />
                            Open tasks
                        </span>
                        <span className="rd-kpi__value">{tasks.open}</span>
                        {tasks.open > 0 && (
                            <span className="rd-stack rd-stack--thin" aria-hidden="true">
                                {tasks.new > 0 && <span style={{ flexGrow: tasks.new, background: '#BFD8E3' }} />}
                                {tasks.in_progress > 0 && (
                                    <span style={{ flexGrow: tasks.in_progress, background: '#0D729E' }} />
                                )}
                            </span>
                        )}
                        <span className="rd-kpi__note">
                            {tasks.new} new &middot; {tasks.in_progress} in progress
                        </span>
                    </div>
                </section>

                <div className="rd-grid">
                    {isTeam && <MorningRoundUp digest={digest} status={digestStatus} className="rd-span-5" />}
                    <NeedsAttention
                        id={ATTENTION_ID}
                        items={summary.attention}
                        counts={{ overdue: tasks.overdue, at_risk: tasks.at_risk }}
                        now={summary.generated_at}
                        filter={filter}
                        onFilterChange={setFilter}
                        className={isTeam ? 'rd-span-7' : undefined}
                    />
                    <TrendChart
                        trend={summary.trend}
                        createdWeek={tasks.created_7d}
                        doneWeek={tasks.done_7d}
                        className="rd-span-7"
                    />
                    <FieldOutput summary={summary} currency={currency} className="rd-span-5" />
                    {isTeam && <TeamActivity team={summary.team} currency={currency} />}
                </div>
            </SurfacePage>
        </AppLayout>
    );
}
