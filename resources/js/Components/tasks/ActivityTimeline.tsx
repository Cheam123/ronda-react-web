import clsx from 'clsx';
import { useEffect, useState } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import { useToast } from '@/Components/feedback/ToastProvider';
import SafeHtml from '@/Components/ui/SafeHtml';
import { confirm } from '@/lib/dialogs';
import { fileKind } from '@/lib/files';
import { errorMessage } from '@/lib/http';
import { deleteActivity, isStillEditable, updateActivity } from '@/lib/taskActivity';
import type { ActivityFile, TaskActivity } from '@/types/tasks';

interface ActivityTimelineProps {
    /** Newest first. */
    activities: TaskActivity[];
    /** Called after an edit or delete, to reload the timeline. */
    onChanged: () => void;
    onImageClick: (src: string) => void;
}

/** A task's follow-ups, newest first, with edit/delete in the first 15 minutes. */
export default function ActivityTimeline({ activities, onChanged, onImageClick }: ActivityTimelineProps) {
    const now = useNow(30_000);

    if (activities.length === 0) {
        return <div className="timeline-empty">No activity yet.</div>;
    }

    return (
        <div>
            {activities.map((activity, index) => (
                <TimelineEntry
                    key={activity.id}
                    activity={activity}
                    last={index === activities.length - 1}
                    editable={isStillEditable(activity, now)}
                    onChanged={onChanged}
                    onImageClick={onImageClick}
                />
            ))}
        </div>
    );
}

/** The current time, refreshed every `interval` ms, so edit menus expire on screen. */
function useNow(interval: number): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), interval);
        return () => window.clearInterval(timer);
    }, [interval]);

    return now;
}

interface TimelineEntryProps {
    activity: TaskActivity;
    last: boolean;
    editable: boolean;
    onChanged: () => void;
    onImageClick: (src: string) => void;
}

function TimelineEntry({ activity, last, editable, onChanged, onImageClick }: TimelineEntryProps) {
    const toast = useToast();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(activity.message);
    const [saving, setSaving] = useState(false);

    const expired = (action: string) => {
        if (isStillEditable(activity)) return false;
        toast(`The 15-minute window to ${action} this message has passed.`, 'warning');
        return true;
    };

    const startEdit = () => {
        if (expired('edit')) return;
        setDraft(activity.message);
        setEditing(true);
    };

    const saveEdit = async () => {
        if (expired('edit')) {
            setEditing(false);
            return;
        }
        setSaving(true);
        try {
            await updateActivity(activity.id, draft.trim());
            setEditing(false);
            toast('Follow-up activity updated successfully.');
            onChanged();
        } catch (error) {
            toast(errorMessage(error, 'Failed to update activity.'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (expired('delete')) return;
        if (!(await confirm({ title: 'Please confirm to delete this follow-up log!', danger: true }))) return;
        try {
            await deleteActivity(activity.id);
            toast('Follow-up activity deleted successfully.');
            onChanged();
        } catch (error) {
            toast(errorMessage(error, 'Failed to delete activity.'), 'error');
        }
    };

    const files = [...activity.attachments, ...activity.report_photos];

    return (
        <div className="tl-row">
            <div className="tl-rail">
                {!last && <span className="line" />}
                <span className="tl-dot">
                    <i className="mdi mdi-comment-text-outline" />
                </span>
            </div>
            <div className="tl-content">
                <div className="tl-head">
                    <span className="who">{activity.author}</span>
                    <span className="when">{activity.created_at}</span>
                    {editable && !editing && (
                        <Dropdown align="end" className="tl-menu">
                            <Dropdown.Toggle
                                as="button"
                                type="button"
                                bsPrefix="tl-menu-btn"
                                title="Actions"
                                aria-label="Actions"
                            >
                                <i className="mdi mdi-dots-vertical" />
                            </Dropdown.Toggle>
                            <Dropdown.Menu className="tl-menu-list">
                                <Dropdown.Item as="button" className="tl-menu-item" onClick={startEdit}>
                                    <i className="mdi mdi-pencil-outline" /> Edit
                                </Dropdown.Item>
                                <Dropdown.Item as="button" className="tl-menu-item danger" onClick={remove}>
                                    <i className="mdi mdi-trash-can-outline" /> Delete
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    )}
                </div>

                {editing ? (
                    <div className="tl-edit">
                        <textarea
                            aria-label="Edit follow-up"
                            value={draft}
                            autoFocus
                            onChange={(event) => setDraft(event.target.value)}
                        />
                        <div className="tl-edit-actions">
                            <button type="button" className="tl-edit-save" disabled={saving} onClick={saveEdit}>
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button type="button" className="tl-edit-cancel" onClick={() => setEditing(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    activity.html && <SafeHtml html={activity.html} className="tl-msg" onImageClick={onImageClick} />
                )}

                {files.length > 0 && (
                    <div className="tl-attachments">
                        {files.map((file) => (
                            <Attachment key={file.id} file={file} onImageClick={onImageClick} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function Attachment({ file, onImageClick }: { file: ActivityFile; onImageClick: (src: string) => void }) {
    const kind = fileKind(file.filename);

    return (
        <div className={clsx('tl-attachment', `tl-attachment--${kind}`)}>
            {kind === 'image' && (
                <img src={file.url} alt={file.name} loading="lazy" onClick={() => onImageClick(file.url)} />
            )}
            {kind === 'video' && (
                <video controls src={file.url}>
                    Your browser does not support the video tag.
                </video>
            )}
            {kind !== 'image' && kind !== 'video' && (
                <a className="tl-file" href={file.url} target="_blank" rel="noopener noreferrer">
                    <i className="mdi mdi-paperclip" /> {file.name}
                </a>
            )}
        </div>
    );
}
