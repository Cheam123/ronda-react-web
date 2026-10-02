import clsx from 'clsx';
import { useEffect, useState } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import { useToast } from '@/Components/feedback/ToastProvider';
import Initials from '@/Components/surface/Initials';
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
        return <p className="timeline-empty">No follow-ups yet.</p>;
    }

    return (
        <ol className="timeline">
            {activities.map((activity) => (
                <TimelineEntry
                    key={activity.id}
                    activity={activity}
                    editable={isStillEditable(activity, now)}
                    onChanged={onChanged}
                    onImageClick={onImageClick}
                />
            ))}
        </ol>
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
    editable: boolean;
    onChanged: () => void;
    onImageClick: (src: string) => void;
}

function TimelineEntry({ activity, editable, onChanged, onImageClick }: TimelineEntryProps) {
    const toast = useToast();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(activity.message);
    const [saving, setSaving] = useState(false);

    const expired = (action: string) => {
        if (isStillEditable(activity)) return false;
        toast(`The 15-minute window to ${action} this follow-up has passed.`, 'warning');
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
            toast('Follow-up updated.');
            onChanged();
        } catch (error) {
            toast(errorMessage(error, 'The follow-up could not be updated.'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (expired('delete')) return;
        if (!(await confirm({ title: 'Delete this follow-up?', confirmText: 'Delete', danger: true }))) return;
        try {
            await deleteActivity(activity.id);
            toast('Follow-up deleted.');
            onChanged();
        } catch (error) {
            toast(errorMessage(error, 'The follow-up could not be deleted.'), 'error');
        }
    };

    const files = [...activity.attachments, ...activity.report_photos];

    return (
        <li className="tl-entry">
            <Initials name={activity.author} />
            <div className="tl-entry__body">
                <div className="tl-entry__head">
                    <span className="tl-entry__who">
                        <strong>{activity.author}</strong>
                        <span className="tl-entry__when">{activity.created_at}</span>
                    </span>
                    {editable && !editing && (
                        <Dropdown align="end">
                            <Dropdown.Toggle
                                as="button"
                                type="button"
                                bsPrefix="rd-btn rd-btn--icon"
                                title="You can change it for 15 minutes"
                                aria-label="Edit or delete this follow-up"
                            >
                                <i className="mdi mdi-dots-horizontal" aria-hidden="true" />
                            </Dropdown.Toggle>
                            <Dropdown.Menu className="rd-menu rd-menu--fixed" popperConfig={{ strategy: 'fixed' }}>
                                <Dropdown.Item as="button" type="button" onClick={startEdit}>
                                    <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                                    Edit
                                </Dropdown.Item>
                                <Dropdown.Item as="button" type="button" className="is-danger" onClick={remove}>
                                    <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
                                    Delete
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    )}
                </div>

                {editing ? (
                    <div className="tl-edit">
                        <textarea
                            className="rd-input"
                            aria-label="Edit follow-up"
                            rows={3}
                            value={draft}
                            autoFocus
                            onChange={(event) => setDraft(event.target.value)}
                        />
                        <div className="tl-edit__actions">
                            <button type="button" className="rd-btn rd-btn--quiet" onClick={() => setEditing(false)}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="rd-btn rd-btn--primary"
                                disabled={saving}
                                onClick={saveEdit}
                            >
                                {saving ? 'Saving...' : 'Save'}
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
        </li>
    );
}

function Attachment({ file, onImageClick }: { file: ActivityFile; onImageClick: (src: string) => void }) {
    const kind = fileKind(file.filename);

    if (kind === 'image') {
        return (
            <button
                type="button"
                className="tl-thumb"
                aria-label={`Open ${file.name}`}
                onClick={() => onImageClick(file.url)}
            >
                <img src={file.url} alt="" loading="lazy" />
            </button>
        );
    }

    if (kind === 'video') {
        return (
            <video className="tl-video" controls src={file.url}>
                Your browser does not support the video tag.
            </video>
        );
    }

    return (
        <a className={clsx('tl-file', `tl-file--${kind}`)} href={file.url} target="_blank" rel="noopener noreferrer">
            <span className="tl-file__icon">
                <i className="mdi mdi-file-document-outline" aria-hidden="true" />
            </span>
            <span className="tl-file__name">{file.name}</span>
        </a>
    );
}
