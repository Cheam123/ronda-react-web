import { Link } from '@inertiajs/react';
import type { AttentionItem } from '../types';
import RiskLevel from './RiskLevel';

/** Overdue first, then at risk; soonest due first. */
export default function FocusAlerts({ items }: { items: AttentionItem[] }) {
    return (
        <div className="dash-card mb-3">
            <h6>
                Focus alerts <span className="dash-sub">(overdue first, then at risk; soonest due first)</span>
            </h6>
            {items.length === 0 ? (
                <div className="dash-sub">Nothing is overdue or at risk.</div>
            ) : (
                <div className="overflow-auto">
                    <table className="dash-table">
                        <thead>
                            <tr>
                                <th />
                                <th>Task</th>
                                <th>Outlet</th>
                                <th>Subscriber</th>
                                <th>Status</th>
                                <th>Due</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.id}>
                                    <td>
                                        <RiskLevel level={item.level} />
                                    </td>
                                    <td>
                                        {item.reference} &middot; {item.title}
                                    </td>
                                    <td>{item.lead}</td>
                                    <td>{item.subscriber}</td>
                                    <td>{item.status}</td>
                                    <td className="text-nowrap">
                                        {item.due_label}
                                        <div className="dash-sub">{item.reason}</div>
                                    </td>
                                    <td>
                                        <Link href={route('tasks.view', item.id)} title="Open task">
                                            <i className="mdi mdi-clipboard-outline font-size-18" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
