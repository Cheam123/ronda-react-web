import InfoList, { type InfoItem } from '@/Components/ui/InfoList';
import Modal from '@/Components/ui/Modal';
import type { TaskListItem } from '@/types/tasks';

/** Rows whose condition is false are left out. */
const rows = (...items: (InfoItem | false)[]): InfoItem[] => items.filter((item): item is InfoItem => item !== false);

interface TaskDetailsModalProps {
    task: TaskListItem | null;
    onHide: () => void;
}

/** "Lead & Task Details" for a row of the task list. */
export default function TaskDetailsModal({ task, onHide }: TaskDetailsModalProps) {
    return (
        <Modal
            show={task !== null}
            onHide={onHide}
            size="lg"
            title={
                task && (
                    <>
                        <div className="triage-modal-sub">{task.reference}</div>
                        Lead &amp; Task Details
                    </>
                )
            }
        >
            {task && (
                <>
                    <div className="detail-grid">
                        <section>
                            <div className="triage-section-title">Lead / Customer</div>
                            <InfoList
                                className="detail-list"
                                items={rows(
                                    ['Name', task.lead.name],
                                    ['Customer ID', task.lead.customer_id || '—'],
                                    ['Shop Name', task.lead.business_name || '—'],
                                    !!task.lead.ife_area && ['IFE Area', task.lead.ife_area],
                                    ['Mobile', task.lead.mobile],
                                    ['Source', task.lead.source],
                                    ['Sales Amount', task.sales ?? '—'],
                                )}
                            />
                        </section>
                        <section>
                            <div className="triage-section-title">Task Information</div>
                            <InfoList
                                className="detail-list"
                                items={rows(
                                    ['Title', task.title],
                                    ['Reference No', task.reference],
                                    ['Due Date', task.due ?? '—'],
                                    ['Appointment', task.appointment ?? '—'],
                                    ['Reminder', task.reminder ?? '—'],
                                    ['Status', task.status_label],
                                    ['Created', task.created_at],
                                    ['Last updated', task.last_updated ?? '—'],
                                )}
                            />
                        </section>
                    </div>

                    <div className="triage-section-title">Manage By</div>
                    <InfoList
                        className="detail-list"
                        items={rows(
                            !!task.subscriber && ['Subscriber', task.subscriber.name],
                            task.sub_subscribers.length > 0 && ['Sub-Subscriber(s)', task.sub_subscribers.join(', ')],
                            task.owners.length > 0 && ['Owner(s)', task.owners.join(', ')],
                        )}
                    />
                </>
            )}
        </Modal>
    );
}
