import { useCallback, useEffect, useRef, useState } from 'react';
import Field from '@/Components/form/Field';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import { useToast } from '@/Components/feedback/ToastProvider';
import { Choices } from '@/Components/surface/Choices';
import Dialog from '@/Components/surface/Dialog';
import Segmented from '@/Components/surface/Segmented';
import { assistantError, callAssistant } from '@/lib/assistant';
import type { FollowUpTopic } from '@/types/leads';

type Language = 'en' | 'ms';

interface Draft {
    text: string;
    source: 'bedrock' | 'template';
}

interface FollowUpDialogProps {
    show: boolean;
    onHide: () => void;
    lead: { id: number; name: string; mobile: string | null };
    /** The topics this outlet has something for, in order ("Last visit · 28 Sep"). */
    topics: { value: FollowUpTopic; label: string }[];
}

const NOTE_MAX = 300;

/** wa.me wants the number with its country code and nothing else. */
function whatsAppHref(mobile: string | null, text: string): string | null {
    const digits = (mobile ?? '').replace(/\D/g, '');
    return digits.length >= 8 ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

/**
 * A follow-up message for the rep to read, change and send themselves
 * (OutletAssistantService::followUp()). Ronda never sends it.
 */
export default function FollowUpDialog({ show, onHide, lead, topics }: FollowUpDialogProps) {
    const toast = useToast();
    const [language, setLanguage] = useState<Language>('en');
    const [topic, setTopic] = useState<FollowUpTopic>(topics[0]?.value ?? 'last_visit');
    const [note, setNote] = useState('');
    // One draft per language and topic, so switching back keeps the rep's edits.
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [writing, setWriting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const key = `${language}-${topic}`;
    const draft = drafts[key];
    // Language-and-topic pairs already asked for, so each is written once by itself.
    const requested = useRef(new Set<string>());

    const write = useCallback(async () => {
        setWriting(true);
        setError(null);
        try {
            const written = await callAssistant<Draft>('followUp', lead.id, {
                language,
                topic,
                note: note.trim() || null,
            });
            setDrafts((current) => ({ ...current, [key]: written }));
        } catch (caught) {
            setError(assistantError(caught, 'The message could not be written. Please try again.'));
        } finally {
            setWriting(false);
        }
    }, [lead.id, language, topic, note, key]);

    // The first draft of each language and topic is written as it is picked.
    useEffect(() => {
        if (show && !requested.current.has(key)) {
            requested.current.add(key);
            write();
        }
    }, [show, key, write]);

    const edit = (text: string) =>
        setDrafts((current) => (current[key] ? { ...current, [key]: { ...current[key], text } } : current));

    const copy = async () => {
        if (!draft) return;
        try {
            await navigator.clipboard.writeText(draft.text);
            toast('Copied. Paste it into WhatsApp or your email.', 'success', { title: '' });
        } catch {
            toast('Copying is blocked in this browser. Select the text instead.', 'error');
        }
    };

    const whatsApp = draft ? whatsAppHref(lead.mobile, draft.text) : null;

    return (
        <Dialog
            show={show}
            onHide={onHide}
            title="Draft a follow-up message"
            text={`For ${lead.name}. Ronda writes it; you read it and send it yourself.`}
            icon="mdi-send-outline"
            tone="neutral"
            wide
            footer={
                <>
                    <button type="button" className="rd-btn rd-btn--quiet" onClick={onHide}>
                        Close
                    </button>
                    <button
                        type="button"
                        className={whatsApp ? 'rd-btn' : 'rd-btn rd-btn--primary'}
                        disabled={!draft || writing}
                        onClick={copy}
                    >
                        <i className="mdi mdi-content-copy" aria-hidden="true" />
                        Copy
                    </button>
                    {whatsApp && (
                        <a
                            href={writing ? undefined : whatsApp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rd-btn rd-btn--primary"
                            aria-disabled={writing}
                        >
                            <i className="mdi mdi-open-in-new" aria-hidden="true" />
                            Open in WhatsApp
                        </a>
                    )}
                </>
            }
        >
            <div className="follow-up">
                <div className="rd-field">
                    <span className="rd-field__label" aria-hidden="true">
                        Language
                    </span>
                    <Segmented<Language>
                        label="Language"
                        className="align-self-start"
                        value={language}
                        onChange={setLanguage}
                        options={[
                            { value: 'en', label: 'English' },
                            { value: 'ms', label: 'Bahasa Melayu' },
                        ]}
                    />
                </div>

                {topics.length > 0 && (
                    <Choices
                        legend="About"
                        options={topics}
                        value={topic}
                        onChange={(value) => value && setTopic(value as FollowUpTopic)}
                        required
                    />
                )}

                <Field
                    label={
                        <>
                            Anything to add? <span className="rd-muted fw-normal">Optional</span>
                        </>
                    }
                    htmlFor="follow-up-note"
                >
                    <div className="follow-up__note">
                        <TextInput
                            id="follow-up-note"
                            large
                            maxLength={NOTE_MAX}
                            placeholder="For example: the samples arrive on Thursday"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                        />
                        <button type="button" className="rd-btn rd-btn--lg" disabled={writing} onClick={write}>
                            {writing ? (
                                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                            ) : (
                                <i className="mdi mdi-refresh" aria-hidden="true" />
                            )}
                            {draft ? 'Write again' : 'Write'}
                        </button>
                    </div>
                </Field>

                <Field
                    label="Draft"
                    htmlFor="follow-up-draft"
                    error={error ?? undefined}
                    hint={
                        draft &&
                        (draft.source === 'bedrock'
                            ? 'Written by Claude (Amazon Bedrock) from this outlet’s visits, orders and suggested orders. Read it before you send it.'
                            : 'Written from a template (AI not configured). Read it before you send it.')
                    }
                >
                    <TextArea
                        id="follow-up-draft"
                        rows={8}
                        value={writing && !draft ? '' : (draft?.text ?? '')}
                        placeholder={writing ? 'Writing your message…' : ''}
                        aria-busy={writing}
                        readOnly={writing || !draft}
                        onChange={(event) => edit(event.target.value)}
                    />
                </Field>
            </div>
        </Dialog>
    );
}
