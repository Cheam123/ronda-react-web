import { formatMoney } from '@/lib/format';
import type { TeamMember } from '../types';

interface TeamActivityProps {
    team: TeamMember[];
    currency: string;
}

/** One row per active team member: open work and the last 7 days. */
export default function TeamActivity({ team, currency }: TeamActivityProps) {
    return (
        <div className="dash-card mb-3">
            <h6>
                Team activity <span className="dash-sub">(open work as subscriber; activity over the last 7 days)</span>
            </h6>
            {team.length === 0 ? (
                <div className="dash-sub">No active team members yet.</div>
            ) : (
                <div className="overflow-auto">
                    <table className="dash-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Role</th>
                                <th className="num">Open</th>
                                <th className="num">Overdue</th>
                                <th className="num">At risk</th>
                                <th className="num">Done</th>
                                <th className="num">Visits</th>
                                <th className="num">Forms</th>
                                <th className="num">Orders ({currency})</th>
                            </tr>
                        </thead>
                        <tbody>
                            {team.map((person) => (
                                <tr key={person.user_id}>
                                    <td>{person.name}</td>
                                    <td>{person.role}</td>
                                    <td className="num">{person.open}</td>
                                    <td className="num">{person.overdue}</td>
                                    <td className="num">{person.at_risk}</td>
                                    <td className="num">{person.done_7d}</td>
                                    <td className="num">{person.visits_7d}</td>
                                    <td className="num">{person.forms_7d}</td>
                                    <td className="num">{formatMoney(person.orders_7d)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
