import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import Initials from '@/Components/surface/Initials';
import PageHeader, { type Crumb } from '@/Components/surface/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { taskStatusChip } from '@/lib/taskStatus';
import type { TaskDetail } from '@/types/tasks';

interface TaskHeaderProps {
    task: TaskDetail;
    /** The task list, opened the way it was left. */
    listHref: string;
    /** Crumbs after Home and Task. */
    trail: Crumb[];
    title?: string;
    actions?: ReactNode;
}

/** A task page's heading: title, status, reference, outlet and subscriber. */
export default function TaskHeader({ task, listHref, trail, title, actions }: TaskHeaderProps) {
    const { can } = useAuth();
    const outlet = task.lead.business_name || task.lead.name || 'Unnamed outlet';

    return (
        <PageHeader
            crumbs={[{ label: 'Home', href: '/index' }, { label: 'Task', href: listHref }, ...trail]}
            title={title ?? task.title}
            meta={
                <>
                    <span className={taskStatusChip(task.status)}>
                        <span className="rd-dot" />
                        {task.status_label}
                    </span>
                    <span className="rd-mono">{task.reference}</span>
                    <span className="task-head__part">
                        on{' '}
                        {can('view_lead') ? (
                            <Link href={route('lead.view', task.lead.id)}>{outlet}</Link>
                        ) : (
                            <strong>{outlet}</strong>
                        )}
                    </span>
                    {task.people.subscriber_name && (
                        <span className="task-head__part">
                            <Initials name={task.people.subscriber_name} size="sm" />
                            <strong>{task.people.subscriber_name}</strong>
                        </span>
                    )}
                </>
            }
            actions={actions}
        />
    );
}
