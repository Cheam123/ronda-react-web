import Modal from '@/Components/ui/Modal';
import type { TaskListItem } from '@/types/tasks';

interface AppointmentsModalProps {
    subscriber: TaskListItem['subscriber'];
    onHide: () => void;
}

/** A subscriber's open appointments, from the task list. */
export default function AppointmentsModal({ subscriber, onHide }: AppointmentsModalProps) {
    return (
        <Modal show={subscriber !== null} onHide={onHide} title={`Appointment List of ${subscriber?.name ?? ''}`}>
            {subscriber && subscriber.appointments.length > 0 ? (
                <ol className="appointment-list mb-0">
                    {subscriber.appointments.map(([date, outlet], index) => (
                        <li key={`${date}-${index}`}>
                            <span className="text-danger">{date}</span> ({outlet})
                        </li>
                    ))}
                </ol>
            ) : (
                <div className="text-muted">No open appointments.</div>
            )}
        </Modal>
    );
}
