import { Link } from '@inertiajs/react';
import Initials from '@/Components/surface/Initials';
import Meter from '@/Components/surface/Meter';
import { useAuth } from '@/hooks/useAuth';
import { formatMoney } from '@/lib/format';
import type { TeamMember } from '../types';

/** A count that only draws the eye when it is not zero. */
function Flag({ count, tone }: { count: number; tone: 'critical' | 'serious' }) {
    return count > 0 ? (
        <span className={`rd-chip rd-chip--${tone}`}>{count}</span>
    ) : (
        <span className="rd-muted">0</span>
    );
}

interface TeamActivityProps {
    team: TeamMember[];
    currency: string;
}

/** One row per active team member: open work and the last 7 days. */
export default function TeamActivity({ team, currency }: TeamActivityProps) {
    const { user, can } = useAuth();
    const heaviest = Math.max(1, ...team.map((person) => person.open));
    const total = (key: keyof TeamMember) => team.reduce((sum, person) => sum + Number(person[key]), 0);

    return (
        <section className="rd-panel" aria-labelledby="team-title">
            <div className="rd-panel__head">
                <div>
                    <h2 id="team-title" className="rd-panel__title">
                        Team
                    </h2>
                    <p className="rd-panel__sub">
                        Open work each person holds as subscriber, and what they did in the last 7 days
                    </p>
                </div>
                {can('create_task') && (
                    <Link href={route('tasks.create')} className="fw-semibold text-decoration-none">
                        Assign a task
                    </Link>
                )}
            </div>

            {team.length === 0 ? (
                <p className="rd-empty">No active team members yet.</p>
            ) : (
                <div className="rd-scroll">
                    <table className="rd-table">
                        <thead>
                            <tr>
                                <th scope="col">Person</th>
                                <th scope="col">Open tasks</th>
                                <th scope="col" className="num">
                                    Overdue
                                </th>
                                <th scope="col" className="num">
                                    At risk
                                </th>
                                <th scope="col" className="num">
                                    Done
                                </th>
                                <th scope="col" className="num">
                                    Visits
                                </th>
                                <th scope="col" className="num">
                                    Forms
                                </th>
                                <th scope="col" className="num">
                                    Orders ({currency})
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {team.map((person) => (
                                <tr key={person.user_id}>
                                    <td>
                                        <span className="dash-person">
                                            <Initials name={person.name} colorKey={person.user_id} />
                                            <span className="dash-person__name">
                                                {person.name}
                                                <small>
                                                    {person.role}
                                                    {person.user_id === user?.id && ' · you'}
                                                </small>
                                            </span>
                                        </span>
                                    </td>
                                    <td>
                                        <span className="dash-load">
                                            <span className="dash-load__count rd-num">{person.open}</span>
                                            <Meter value={person.open} max={heaviest} />
                                        </span>
                                    </td>
                                    <td className="num">
                                        <Flag count={person.overdue} tone="critical" />
                                    </td>
                                    <td className="num">
                                        <Flag count={person.at_risk} tone="serious" />
                                    </td>
                                    <td className="num">{person.done_7d}</td>
                                    <td className="num">{person.visits_7d}</td>
                                    <td className="num">{person.forms_7d}</td>
                                    <td className="num">{formatMoney(person.orders_7d)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row">Team total</th>
                                <td className="rd-num">{total('open')}</td>
                                <td className="num">{total('overdue')}</td>
                                <td className="num">{total('at_risk')}</td>
                                <td className="num">{total('done_7d')}</td>
                                <td className="num">{total('visits_7d')}</td>
                                <td className="num">{total('forms_7d')}</td>
                                <td className="num">{formatMoney(total('orders_7d'))}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </section>
    );
}
