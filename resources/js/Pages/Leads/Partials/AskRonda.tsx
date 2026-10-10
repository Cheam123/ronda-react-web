import clsx from 'clsx';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Offcanvas from 'react-bootstrap/Offcanvas';
import TextArea from '@/Components/form/TextArea';
import { useToast } from '@/Components/feedback/ToastProvider';
import { assistantError, callAssistant, MAX_CHAT_MESSAGE_LENGTH, MAX_CHAT_MESSAGES } from '@/lib/assistant';
import type { ChatMessage } from '@/types/leads';

interface AskRondaProps {
    show: boolean;
    onHide: () => void;
    lead: { id: number; name: string; customerId: string | null };
    /** Claude on Bedrock is set up; there is no template for free questions. */
    available: boolean;
}

const STARTERS = [
    'What should I raise on today’s visit?',
    'What did they order last time?',
    'The owner says a product is too expensive. What can I say?',
    'Write a WhatsApp in Bahasa Melayu to follow up on my last visit',
];

/** The chat survives a reload of the page (per tab), never a new session. */
const storageKey = (leadId: number) => `ronda-ask-${leadId}`;

function loadChat(leadId: number): ChatMessage[] {
    try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey(leadId)) ?? '[]');
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

function saveChat(leadId: number, messages: ChatMessage[]) {
    try {
        if (messages.length === 0) {
            sessionStorage.removeItem(storageKey(leadId));
        } else {
            sessionStorage.setItem(storageKey(leadId), JSON.stringify(messages));
        }
    } catch {
        // Storage blocked (private window): the chat just won't survive a reload.
    }
}

/**
 * Ask Ronda: questions about this outlet, answered by Claude from its
 * records (OutletAssistantService::chat()). The browser holds the chat and
 * sends it back with each question.
 */
export default function AskRonda({ show, onHide, lead, available }: AskRondaProps) {
    const toast = useToast();
    const [messages, setMessages] = useState<ChatMessage[]>(() => loadChat(lead.id));
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => saveChat(lead.id, messages), [lead.id, messages]);

    // Keep the newest message in view, also when the drawer opens on an old chat (onEntered).
    const scrollToEnd = () => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });

    useEffect(() => {
        bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
    }, [messages, sending]);

    const full = messages.length + 1 > MAX_CHAT_MESSAGES;

    const send = async (text: string) => {
        const question = text.trim();
        if (question === '' || sending || full || !available) return;

        const asked: ChatMessage[] = [...messages, { role: 'user', content: question }];
        setMessages(asked);
        setDraft('');
        setError(null);
        setSending(true);

        try {
            const answer = await callAssistant<{ reply: string }>('chat', lead.id, { messages: asked });
            setMessages([...asked, { role: 'assistant', content: answer.reply }]);
        } catch (caught) {
            // Put the question back so it can be sent again.
            setMessages(messages);
            setDraft(question);
            setError(assistantError(caught, 'Ronda could not answer just now. Please try again.'));
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        send(draft);
    };

    // Enter sends; Shift+Enter starts a new line.
    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send(draft);
        }
    };

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast('Copied.', 'success', { title: '' });
        } catch {
            toast('Copying is blocked in this browser. Select the text instead.', 'error');
        }
    };

    const clear = () => {
        setMessages([]);
        setError(null);
        inputRef.current?.focus();
    };

    return (
        <Offcanvas
            show={show}
            onHide={onHide}
            onEntered={scrollToEnd}
            placement="end"
            className="rd-drawer ask-ronda"
            backdropClassName="rd-drawer-backdrop"
            aria-labelledby="ask-ronda-title"
        >
            <div className="rd-drawer__head">
                <div className="rd-drawer__meta">
                    <span className="ask-ronda__outlet">{lead.name}</span>
                    {lead.customerId && <span className="rd-mono">{lead.customerId}</span>}
                </div>
                <h2 id="ask-ronda-title" className="rd-drawer__title">
                    Ask Ronda
                </h2>
                <p className="rd-drawer__lede">
                    Answers come from this outlet’s visits, orders, tasks and suggested orders. Contact details are not
                    sent.
                </p>
                <button
                    type="button"
                    className="rd-btn rd-btn--icon rd-drawer__close"
                    aria-label="Close"
                    title="Close"
                    onClick={onHide}
                >
                    <i className="mdi mdi-close" aria-hidden="true" />
                </button>
            </div>

            <div className="rd-drawer__body ask-ronda__body" ref={bodyRef}>
                {!available ? (
                    <p className="rd-notice">
                        <i className="mdi mdi-information-outline" aria-hidden="true" />
                        Ask Ronda needs Claude on Amazon Bedrock, which is not set up yet. Visit briefs and follow-up
                        drafts still work from templates. An admin can turn it on.
                    </p>
                ) : messages.length === 0 && !sending ? (
                    <div className="ask-ronda__start">
                        <p className="ask-ronda__intro">
                            Ask anything about {lead.name}. Ronda answers from what is recorded here and says so when it
                            does not know.
                        </p>
                        <h3 className="ask-ronda__label">Try one of these</h3>
                        <div className="ask-ronda__starters">
                            {STARTERS.map((starter) => (
                                <button
                                    key={starter}
                                    type="button"
                                    className="ask-ronda__starter"
                                    onClick={() => send(starter)}
                                >
                                    <i className="mdi mdi-arrow-right" aria-hidden="true" />
                                    {starter}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <ol className="ask-ronda__thread" aria-label="Chat" aria-live="polite">
                        {messages.map((message, index) => (
                            <li
                                key={index}
                                className={clsx('ask-ronda__message', `ask-ronda__message--${message.role}`)}
                            >
                                {message.role === 'assistant' && <span className="ask-ronda__who">Ronda</span>}
                                {message.role === 'user' && <span className="visually-hidden">You:</span>}
                                <div className="ask-ronda__bubble">{message.content}</div>
                                {message.role === 'assistant' && (
                                    <button
                                        type="button"
                                        className="ask-ronda__copy"
                                        onClick={() => copy(message.content)}
                                    >
                                        <i className="mdi mdi-content-copy" aria-hidden="true" />
                                        Copy
                                    </button>
                                )}
                            </li>
                        ))}
                        {sending && (
                            <li className="ask-ronda__message ask-ronda__message--assistant" role="status">
                                <span className="ask-ronda__who">Ronda</span>
                                <div className="ask-ronda__bubble ask-ronda__thinking">
                                    <span className="ask-ronda__dots" aria-hidden="true">
                                        <span />
                                        <span />
                                        <span />
                                    </span>
                                    Reading this outlet’s orders and visits…
                                </div>
                            </li>
                        )}
                    </ol>
                )}
            </div>

            <form className="rd-drawer__foot ask-ronda__foot" onSubmit={submit}>
                {error && (
                    <p className="rd-field__error ask-ronda__error" role="alert">
                        <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                        {error}
                    </p>
                )}
                {full && (
                    <p className="ask-ronda__full" role="status">
                        This chat is getting long. Clear it to start a new one.
                    </p>
                )}
                <div className="ask-ronda__compose">
                    <label htmlFor="ask-ronda-input" className="visually-hidden">
                        Ask about {lead.name}
                    </label>
                    <TextArea
                        id="ask-ronda-input"
                        ref={inputRef}
                        rows={2}
                        maxLength={MAX_CHAT_MESSAGE_LENGTH}
                        placeholder={`Ask about ${lead.name}`}
                        value={draft}
                        disabled={!available || full}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={onKeyDown}
                    />
                    <button
                        type="submit"
                        className="rd-btn rd-btn--primary rd-btn--lg"
                        disabled={!available || full || sending || draft.trim() === ''}
                    >
                        {sending ? (
                            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                        ) : (
                            <i className="mdi mdi-send-outline" aria-hidden="true" />
                        )}
                        Send
                    </button>
                </div>
                <div className="ask-ronda__hints">
                    <span>Ronda can be wrong. Check prices and stock before you promise anything.</span>
                    {messages.length > 0 && (
                        <button
                            type="button"
                            className="rd-btn rd-btn--quiet rd-btn--sm"
                            onClick={clear}
                            disabled={sending}
                        >
                            Clear chat
                        </button>
                    )}
                </div>
            </form>
        </Offcanvas>
    );
}
