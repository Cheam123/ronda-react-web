import { router } from '@inertiajs/react';
import { useState } from 'react';
import { useToast } from '@/Components/feedback/ToastProvider';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import { pluralize } from '@/lib/format';

interface TelegramMessage {
    name: string;
    chat_id: number;
    date: string;
    text: string;
}

interface TelegramIndexProps {
    /** The latest messages to the bot, newest first. */
    messages: TelegramMessage[];
    /** Why there may be nothing to show (no bot token, Telegram refused); null when it answered. */
    problem: string | null;
}

/** Recent messages to the bot, to find someone's chat ID and link their task alerts. */
export default function TelegramIndex({ messages, problem }: TelegramIndexProps) {
    const toast = useToast();
    const [refreshing, setRefreshing] = useState(false);

    const copy = async (message: TelegramMessage) => {
        try {
            await navigator.clipboard.writeText(String(message.chat_id));
            toast(`Copied ${message.name.trim()}’s chat ID. Paste it into Telegram chat ID on Edit user.`, 'success', {
                title: '',
            });
        } catch {
            toast('Copying is blocked in this browser. Select the ID instead.', 'error');
        }
    };

    const refresh = () => router.reload({ onStart: () => setRefreshing(true), onFinish: () => setRefreshing(false) });

    return (
        <AppLayout title="Telegram chat IDs">
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Admin' },
                        { label: 'Users', href: route('users.index') },
                        { label: 'Telegram chat IDs' },
                    ]}
                    title="Telegram chat IDs"
                    lede="Find someone’s chat ID so their task alerts reach them on Telegram."
                    actions={
                        <button type="button" className="rd-btn rd-btn--lg" onClick={refresh} disabled={refreshing}>
                            {refreshing ? (
                                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                            ) : (
                                <i className="mdi mdi-refresh" aria-hidden="true" />
                            )}
                            Check for new messages
                        </button>
                    }
                />

                <section className="rd-panel" aria-labelledby="telegram-steps-title">
                    <h2 id="telegram-steps-title" className="rd-panel__title">
                        How to link someone
                    </h2>
                    <ol className="telegram-steps">
                        <li>Ask them to open Telegram and send any message to the Ronda bot.</li>
                        <li>Press Check for new messages. Their message shows below, with their chat ID.</li>
                        <li>Copy the ID, then paste it into Telegram chat ID on their Edit user page.</li>
                    </ol>
                </section>

                {problem && (
                    <p className="rd-notice">
                        <i className="mdi mdi-alert-outline" aria-hidden="true" />
                        <span>{problem}</span>
                    </p>
                )}

                <section className="rd-panel rd-panel--flush rd-list rd-list--flush" aria-labelledby="telegram-title">
                    <div className="rd-list__head">
                        <div className="rd-list__heading">
                            <h2 id="telegram-title" className="rd-list__title">
                                Latest messages
                            </h2>
                            <span className="rd-count rd-count--label">{pluralize(messages.length, 'message')}</span>
                        </div>
                    </div>
                    <div className="rd-scroll">
                        <table className="rd-table rd-table--flush rd-table--stack">
                            <thead>
                                <tr>
                                    <th scope="col">From</th>
                                    <th scope="col">Sent</th>
                                    <th scope="col">Message</th>
                                    <th scope="col">Chat ID</th>
                                    <th scope="col" className="rd-col-actions">
                                        <span className="visually-hidden">Copy</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {messages.map((message, index) => (
                                    <tr key={`${message.chat_id}-${index}`}>
                                        <td className="rd-cell-main">
                                            <strong>{message.name.trim() || 'Someone'}</strong>
                                        </td>
                                        <td className="text-nowrap" data-label="Sent">
                                            {message.date}
                                        </td>
                                        <td data-label="Message">
                                            {message.text || <span className="rd-muted">—</span>}
                                        </td>
                                        <td data-label="Chat ID">
                                            <span className="rd-mono">{message.chat_id}</span>
                                        </td>
                                        <td className="rd-col-actions">
                                            <button
                                                type="button"
                                                className="rd-btn rd-btn--sm"
                                                aria-label={`Copy ${message.name.trim()}’s chat ID`}
                                                onClick={() => copy(message)}
                                            >
                                                <i className="mdi mdi-content-copy" aria-hidden="true" />
                                                Copy
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {messages.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="rd-list__empty">
                                            No messages to the bot yet. Ask the person to send one, then check again.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </SurfacePage>
        </AppLayout>
    );
}
