import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useToast } from '@/Components/feedback/ToastProvider';
import { formatFileSize } from '@/lib/files';
import { errorMessage } from '@/lib/http';
import { logActivity } from '@/lib/taskActivity';

/** The composer grows with its text up to this height, then scrolls. */
const MAX_HEIGHT = 160;

interface ActivityComposerProps {
    taskId: number;
    /** Called after the follow-up is saved, to reload the timeline. */
    onSaved: () => void;
    /** Extra fields posted with the follow-up (e.g. a new due date). */
    extra?: Record<string, string>;
    /** Extra controls under the composer. */
    children?: ReactNode;
}

/** "Log a follow-up": a note and/or attachments posted to a task's timeline. */
export default function ActivityComposer({ taskId, onSaved, extra, children }: ActivityComposerProps) {
    const toast = useToast();
    const id = useId();
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
            setHint('Type a note or attach a file first.');
            return;
        }

        setHint('');
        setSaving(true);
        try {
            await logActivity(taskId, text, files, extra);
            setMessage('');
            setFiles([]);
            toast('Follow-up saved.');
            onSaved();
        } catch (error) {
            toast(errorMessage(error, 'The follow-up could not be saved.'), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="composer">
            <label htmlFor={`${id}-note`} className="rd-field__label">
                Log a follow-up
            </label>
            <div className="composer__box">
                <textarea
                    id={`${id}-note`}
                    ref={textRef}
                    rows={2}
                    placeholder="What happened? e.g. Spoke 5 min, interested in Type B, appointment 8 Oct 1 pm"
                    aria-invalid={hint ? true : undefined}
                    aria-describedby={hint ? `${id}-hint` : undefined}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                />
                <div className="composer__bar">
                    <input ref={fileRef} type="file" multiple hidden onChange={addFiles} />
                    <button
                        type="button"
                        className="rd-btn rd-btn--quiet"
                        title="Attach photos, documents or video"
                        onClick={() => fileRef.current?.click()}
                    >
                        <i className="mdi mdi-paperclip" aria-hidden="true" />
                        Attach
                    </button>
                    <button type="button" className="rd-btn rd-btn--primary" disabled={saving} onClick={save}>
                        {saving ? 'Saving...' : 'Save follow-up'}
                    </button>
                </div>
            </div>
            {hint && (
                <p className="rd-field__error" id={`${id}-hint`} role="alert">
                    {hint}
                </p>
            )}
            {files.length > 0 && (
                <div className="composer__files">
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
        <div className="composer__file">
            {preview ? (
                <img className="composer__thumb" src={preview} alt="" />
            ) : (
                <span className="composer__thumb">
                    <i className="mdi mdi-file-document-outline" aria-hidden="true" />
                </span>
            )}
            <span className="composer__meta">
                <span className="composer__name" title={file.name}>
                    {file.name}
                </span>
                <span className="composer__size">{formatFileSize(file.size)}</span>
            </span>
            <button
                type="button"
                className="rd-btn rd-btn--icon rd-btn--icon-danger"
                title="Remove"
                aria-label={`Remove ${file.name}`}
                onClick={onRemove}
            >
                <i className="mdi mdi-close" aria-hidden="true" />
            </button>
        </div>
    );
}
