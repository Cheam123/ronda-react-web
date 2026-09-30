import { router } from '@inertiajs/react';
import BootstrapModal from 'react-bootstrap/Modal';
import ActivityComposer from '@/Components/tasks/ActivityComposer';
import ActivityTimeline from '@/Components/tasks/ActivityTimeline';
import InfoList from '@/Components/ui/InfoList';
import type { TaskListItem } from '@/types/tasks';

interface ActivityModalProps {
    task: TaskListItem | null;
    onHide: () => void;
    onImageClick: (src: string) => void;
}

/** Full-screen follow-up log for one task: composer, timeline and a lead snapshot. */
export default function ActivityModal({ task, onHide, onImageClick }: ActivityModalProps) {
    // Only the list is reloaded; the modal stays open on the fresh row.
    const reload = () => router.reload({ only: ['tasks'] });

    return (
        <BootstrapModal show={task !== null} onHide={onHide} fullscreen contentClassName="activity-modal">
            {task && (
                <>
                    <div className="am-head">
                        <div className="title">
                            <span className="lead-name-am">{task.lead.name}</span>
                            <span className="sep">·</span>
                            <span className="task-title-am">{task.title}</span>
                            <span className="sub">Follow-up Activity · {task.reference}</span>
                        </div>
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            aria-label="Close"
                            onClick={onHide}
                        />
                    </div>
                    <div className="am-body">
                        <div className="am-main">
                            <ActivityComposer taskId={task.id} onSaved={reload} />
                            <div className="timeline-label">Activity Timeline ({task.activities.length})</div>
                            <div className="timeline-scroll">
                                <ActivityTimeline
                                    activities={task.activities}
                                    onChanged={reload}
                                    onImageClick={onImageClick}
                                />
                            </div>
                        </div>

                        <aside className="am-aside">
                            <div className="triage-section-title">Lead Snapshot</div>
                            <InfoList
                                className="detail-list"
                                items={[
                                    ['Name', task.lead.name],
                                    ['Mobile', task.lead.mobile],
                                    ['Source', task.lead.source],
                                    ['Customer ID', task.lead.customer_id || '—'],
                                    ['Status', task.status_label],
                                ]}
                            />

                            <div className="triage-section-title">Upcoming</div>
                            <div className="upcoming">
                                {task.appointment && (
                                    <Upcoming tone="appt" label="Appointment" when={task.appointment} />
                                )}
                                {task.reminder && <Upcoming tone="rem" label="Reminder" when={task.reminder} />}
                                {task.due && <Upcoming tone="due" label="Due" when={task.due} />}
                                {!task.appointment && !task.reminder && !task.due && (
                                    <div className="upcoming-none">None scheduled</div>
                                )}
                            </div>
                        </aside>
                    </div>
                </>
            )}
        </BootstrapModal>
    );
}

function Upcoming({ tone, label, when }: { tone: 'appt' | 'rem' | 'due'; label: string; when: string }) {
    return (
        <div className={`upcoming-item ${tone}`}>
            <div className="ui-label">{label}</div>
            <div className="ui-when">{when}</div>
        </div>
    );
}
