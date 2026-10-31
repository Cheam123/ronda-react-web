import { Link, usePage } from '@inertiajs/react';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/Layouts/AppLayout';
import { pluralize } from '@/lib/format';
import type { PageProps } from '@/types';
import DashboardTabs from './Partials/DashboardTabs';
import FieldOutput from './Partials/FieldOutput';
import MorningRoundUp from './Partials/MorningRoundUp';
import MyWeek from './Partials/MyWeek';
import NeedsAttention from './Partials/NeedsAttention';
import SuggestedOutlets from './Partials/SuggestedOutlets';
import TeamTable from './Partials/TeamTable';
import TodayPanel from './Partials/TodayPanel';
import TrendChart from './Partials/TrendChart';
import type { DailyDigest, DashboardSummary, SuggestedOutlets as Suggestions, TeamMember } from './types';

interface DashboardProps {
    /** Admins and Managers get the team view; a Field Rep sees their own work. */
    isTeam: boolean;
    /** Admins can switch back to the organisation overview. */
    showViewTabs: boolean;
    summary: DashboardSummary;
    /** A Field Rep's outlets with the most to gain from suggested orders; null on the team view. */
    suggestions: Suggestions | null;
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

/** "3 tasks are overdue and 5 are at risk, spread across 4 people." */
function teamHeadline(overdue: number, atRisk: number, team: TeamMember[]): string {
    const sentence = headline(overdue, atRisk);
    const holders = team.filter((person) => person.overdue + person.at_risk > 0);

    if (holders.length === 0) return sentence;
    if (holders.length === 1) {
        return `${sentence.slice(0, -1)}, ${overdue + atRisk === 1 ? 'held' : 'all held'} by ${holders[0].name}.`;
    }
    return `${sentence.slice(0, -1)}, spread across ${holders.length} people.`;
}

/**
 * Managers (and admins on the Team operations tab): the Morning Round-Up, the
 * team's Needs attention list beside today's other counts, the team table,
 * then the 14-day chart and field output. A Field Rep: their Needs attention
 * list, with Suggested orders and their last 7 days beside it.
 */
export default function Dashboard({
    isTeam,
    showViewTabs,
    summary,
    suggestions,
    digest,
    digestStatus,
    risk,
}: DashboardProps) {
    const { currency } = usePage<PageProps>().props.app;
    const { user, can } = useAuth();
    const { tasks } = summary;
    const firstName = user?.name.split(' ')[0] ?? '';
    const canList = can('manage_task');
    const counts = { overdue: tasks.overdue, at_risk: tasks.at_risk };
    const riskRule = `At risk means due within ${risk.hours} h, or ${risk.percent}% of its time used.`;
    const dueToday = `${tasks.due_today} due today`;

    return (
        <AppLayout title="Home">
            <SurfacePage>
                <PageHeader
                    eyebrow={`${isTeam ? 'Team dashboard' : 'My dashboard'} · ${summary.date_label}`}
                    title={`${greeting()}, ${firstName}`}
                    lede={
                        isTeam
                            ? `${teamHeadline(tasks.overdue, tasks.at_risk, summary.team)} Updated ${summary.time_label}.`
                            : `${headline(tasks.overdue, tasks.at_risk)}${tasks.due_today > 0 ? ` ${pluralize(tasks.due_today, 'task is', 'tasks are')} due today.` : ''} Updated ${summary.time_label}.`
                    }
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

                {isTeam ? (
                    <>
                        <MorningRoundUp digest={digest} status={digestStatus} />
                        <div className="rd-grid rd-grid--stretch">
                            <NeedsAttention
                                items={summary.attention}
                                counts={counts}
                                now={summary.generated_at}
                                team={{ open: tasks.open }}
                                limit={5}
                                riskRule={riskRule}
                                listLink={
                                    canList && tasks.open > 0
                                        ? {
                                              href: route('tasks.index2', { status: 'open' }),
                                              label: `Open all ${tasks.open} in the task list`,
                                          }
                                        : null
                                }
                                className="rd-span-8"
                            />
                            <div className="dash-side">
                                <TodayPanel tasks={tasks} formsPending={summary.forms.pending} />
                            </div>
                        </div>
                        <TeamTable team={summary.team} now={summary.generated_at} currency={currency} />
                        <div className="rd-grid rd-grid--stretch">
                            <TrendChart
                                trend={summary.trend}
                                createdWeek={tasks.created_7d}
                                doneWeek={tasks.done_7d}
                                className="rd-span-7"
                            />
                            <FieldOutput summary={summary} currency={currency} className="rd-span-5" />
                        </div>
                    </>
                ) : (
                    // Not stretched: the chart opening in the side column mustn't leave the list a tall empty panel.
                    <div className="rd-grid">
                        <NeedsAttention
                            items={summary.attention}
                            counts={counts}
                            now={summary.generated_at}
                            riskRule={riskRule}
                            note={
                                <span>
                                    {canList && tasks.due_today > 0 ? (
                                        <Link href={route('tasks.index2', { status: 'open', due: 'today' })}>
                                            {dueToday}
                                        </Link>
                                    ) : (
                                        dueToday
                                    )}{' '}
                                    &middot; {tasks.open} open in all
                                </span>
                            }
                            listLink={
                                canList
                                    ? { href: route('tasks.index2', { status: 'open' }), label: 'Open my task list' }
                                    : null
                            }
                            className="rd-span-8"
                        />
                        <div className="dash-side">
                            {suggestions && <SuggestedOutlets suggestions={suggestions} currency={currency} />}
                            <MyWeek summary={summary} currency={currency} />
                        </div>
                    </div>
                )}
            </SurfacePage>
        </AppLayout>
    );
}
