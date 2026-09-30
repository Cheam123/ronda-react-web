import type { TaskDetail } from '@/types/tasks';

/** The strip above a task's page: reference and status, customer, subscriber. */
export default function TaskSummary({ task }: { task: TaskDetail }) {
    const { lead } = task;

    return (
        <div className="task-summary row">
            <div className="col-md-3">
                <div className="task-summary__label">Task Reference</div>
                <div className="task-summary__value">
                    <b>{task.reference}</b> <span className="task-summary__status">({task.status_label})</span>
                </div>
            </div>
            <div className="col-md-3">
                <div className="task-summary__label">Lead/Customer Name</div>
                <div className="task-summary__value">
                    <b>{lead.name}</b>
                    {lead.customer_id && ` (${lead.customer_id})`}
                </div>
                {lead.business_name && <div>{lead.business_name}</div>}
            </div>
            <div className="col-md-3">
                <div className="task-summary__label">Lead/Customer Mobile</div>
                <div className="task-summary__value">
                    <b>{lead.mobile}</b>
                </div>
            </div>
            <div className="col-md-3">
                <div className="task-summary__label">Subscriber</div>
                <div className="task-summary__value">
                    <b>{task.people.subscriber_name}</b>
                </div>
            </div>
        </div>
    );
}
