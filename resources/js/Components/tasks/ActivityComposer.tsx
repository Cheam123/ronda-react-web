import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useToast } from '@/Components/feedback/ToastProvider';
import { formatFileSize } from '@/lib/files';
import { errorMessage } from '@/lib/http';
import { logActivity } from '@/lib/taskActivity';

/** The composer grows with its text up to this height, then scrolls. */
const MAX_HEIGHT = 140;

interface ActivityComposerProps {
    taskId: number;
    /** Called after the follow-up is saved, to reload the timeline. */
    onSaved: () => void;
    /** Extra fields posted with the follow-up (e.g. a new due date). */
    extra?: Record<string, string>;
    /** Extra controls under the composer. */
    children?: ReactNode;
}

/** "+ Log follow-up": a note and/or attachments posted to a task's timeline. */
export default function ActivityComposer({ taskId, onSaved, extra, children }: ActivityComposerProps) {
    const toast = useToast();
    const textRef = useRef<HTMLTextAreaElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [message, setMessage] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [saving, setSaving] = useState(false);
    const [hint, setHint] = useState('');

    // WhatsApp-style auto-grow.
    useEffect(() => {
        const element = textRef.current;
        if (!element) return;
        element.style.height = 'auto';
        element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
        element.style.overflowY = element.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
    }, [message]);

    const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(event.target.files ?? []);
        setFiles((current) => [...current, ...picked]);
        event.target.value = ''; // allow picking the same file again
    };

    const save = async () => {
        const text = message.trim();
        if (text === '' && files.length === 0) {
            setHint('Please type a follow-up note or attach a file.');
            return;
        }

        setHint('');
        setSaving(true);
        try {
            await logActivity(taskId, text, files, extra);
            setMessage('');
            setFiles([]);
            toast('Follow-up activity saved successfully.');
            onSaved();
        } catch (error) {
            toast(errorMessage(error, 'Failed to save activity.'), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="composer">
            <div className="composer-label">+ Log follow-up</div>
            <textarea
                ref={textRef}
                rows={1}
                aria-label="Follow-up note"
                placeholder="e.g. NPU / Spoke 5 min, interested in Type B / Appt set 8/3 1pm"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
            />
            <input ref={fileRef} type="file" multiple hidden onChange={addFiles} />
            <button
                type="button"
                className="composer-attach"
                title="Attach files — images, documents, video"
                aria-label="Attach files"
                onClick={() => fileRef.current?.click()}
            >
                <i className="mdi mdi-paperclip" />
            </button>
            <button type="button" className="composer-save" disabled={saving} onClick={save}>
                {saving ? 'Saving...' : 'Save activity'}
            </button>
            {hint && <span className="composer-status text-danger">{hint}</span>}
            {files.length > 0 && (
                <div className="composer-preview">
                    {files.map((file, index) => (
                        <FileChip
                            key={`${file.name}-${index}`}
                            file={file}
                            onRemove={() => setFiles((current) => current.filter((_, position) => position !== index))}
                        />
                    ))}
                </div>
            )}
            {children}
        </div>
    );
}

function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if (!file.type.startsWith('image/')) return;
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    return (
        <div className="composer-chip">
            {preview ? (
                <img className="thumb" src={preview} alt="" />
            ) : (
                <span className="thumb">
                    <i className="mdi mdi-file-document-outline" />
                </span>
            )}
            <div className="meta">
                <div className="fname" title={file.name}>
                    {file.name}
                </div>
                <div className="fsize">{formatFileSize(file.size)}</div>
            </div>
            <button type="button" className="rm" title="Remove" aria-label={`Remove ${file.name}`} onClick={onRemove}>
                &times;
            </button>
        </div>
    );
}
