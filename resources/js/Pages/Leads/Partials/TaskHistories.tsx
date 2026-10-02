import Initials from '@/Components/surface/Initials';
import { taskStatusChip } from '@/lib/taskStatus';
import type { TaskSummary } from '@/types/leads';

/** Every task raised on the outlet: what, who handles it, when, where it stands. */
export default function TaskHistories({ tasks }: { tasks: TaskSummary[] }) {
    if (tasks.length === 0) {
        return <p className="lead-activity__empty">No tasks on this outlet yet.</p>;
    }

    return (
        <div className="rd-scroll">
            <table className="rd-table rd-table--flush lead-activity__table">
                <thead>
                    <tr>
                        <th scope="col">Task</th>
                        <th scope="col">Subscriber</th>
                        <th scope="col">Appointment</th>
                        <th scope="col">Status</th>
                        <th scope="col">Last update</th>
                        <th scope="col" className="rd-col-actions">
                            <span className="visually-hidden">Open</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {tasks.map((task) => (
                        <tr key={task.id}>
                            <td>
                                <span className="rd-person__text">
                                    <a
                                        href={route('tasks.view', task.id)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rd-person__name"
                                    >
                                        {task.title || task.reference}
                                    </a>
                                    <span className="rd-person__sub rd-mono">{task.reference}</span>
                                </span>
                            </td>
                            <td>
                                {task.subscriber ? (
                                    <span className="rd-person rd-person--sm">
                                        <Initials name={task.subscriber} size="sm" />
                                        <span className="rd-person__name">{task.subscriber}</span>
                                    </span>
                                ) : (
                                    <span className="rd-muted">—</span>
                                )}
                            </td>
                            <td className="text-nowrap">{task.appointment ?? <span className="rd-muted">—</span>}</td>
                            <td>
                                <span className={taskStatusChip(task.status)}>
                                    <span className="rd-dot" />
                                    {task.status_label}
                                </span>
                            </td>
                            <td className="text-nowrap">{task.last_updated ?? <span className="rd-muted">—</span>}</td>
                            <td className="rd-col-actions">
                                <div className="rd-actions">
                                    <a
                                        href={route('tasks.view', { id: task.id, mode: 'comment' })}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rd-btn rd-btn--icon"
                                        aria-label={`Open the chat on ${task.title || task.reference}`}
                                        title="Open the chat"
                                    >
                                        <i className="mdi mdi-message-outline" aria-hidden="true" />
                                    </a>
                                    <a
                                        href={route('tasks.view', task.id)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rd-btn rd-btn--icon"
                                        aria-label={`Open ${task.title || task.reference}`}
                                        title="Open the task"
                                    >
                                        <i className="mdi mdi-open-in-new" aria-hidden="true" />
                                    </a>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
