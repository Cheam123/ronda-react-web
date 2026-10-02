import Modal from '@/Components/ui/Modal';
import type { TaskListItem } from '@/types/tasks';

interface AppointmentsModalProps {
    subscriber: TaskListItem['subscriber'];
    onHide: () => void;
}

/** A subscriber's open appointments, from the task list. */
export default function AppointmentsModal({ subscriber, onHide }: AppointmentsModalProps) {
    return (
        <Modal show={subscriber !== null} onHide={onHide} title={`Open appointments: ${subscriber?.name ?? ''}`}>
            {subscriber && subscriber.appointments.length > 0 ? (
                <ul className="rd-rows task-appointments">
                    {subscriber.appointments.map(([date, outlet], index) => (
                        <li key={`${date}-${index}`}>
                            <i className="mdi mdi-calendar-blank-outline" aria-hidden="true" />
                            <span className="task-appointments__when">{date}</span>
                            <span>{outlet}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="rd-muted mb-0">No open appointments.</p>
            )}
        </Modal>
    );
}
