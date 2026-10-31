import { router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import type { PageProps } from '@/types';
import type { ToastType } from './Toast';
import { useToast } from './ToastProvider';

const TYPES: Record<string, ToastType> = { success: 'success', error: 'error', warning: 'warning' };

/** The words of an alert's HTML body, without its tags. */
function plain(html: string): string {
    const element = document.createElement('div');
    element.innerHTML = html;
    return element.textContent?.trim() ?? '';
}

/**
 * Shows what the server flashed for this response as a toast: the alert
 * queued by alert()->..., and plain `success` / `error` flashes. Successes
 * leave on their own; errors stay until dismissed. Also says so when a
 * request never reached the server.
 */
export default function FlashMessages() {
    const { flash } = usePage<PageProps>().props;
    const toast = useToast();

    useEffect(() => {
        if (flash.alert) {
            const { title, text, html, icon } = flash.alert;
            const body = text || (html ? plain(html) : '');
            // The server's titles are generic ("Success", "Oops..."); the sentence says what happened.
            toast(body || title || '', TYPES[icon ?? ''] ?? 'info', { title: '' });
        } else if (flash.error) {
            toast(flash.error, 'error');
        } else if (flash.success) {
            toast(flash.success, 'success');
        }
        // A fresh `flash` object arrives with every response, so this runs
        // once per visit and never re-fires a message on re-render.
    }, [flash, toast]);

    // A save or visit that never got an answer (offline, a dropped connection)
    // would otherwise fail without a word: the spinner stops and nothing changes.
    // Anything else (a bug) is left to throw, so it still shows up in the console.
    useEffect(
        () =>
            router.on('exception', (event) => {
                const error = event.detail.exception as { isAxiosError?: boolean; response?: unknown };
                if (!error?.isAxiosError || error.response) return;
                event.preventDefault();
                toast(
                    'Ronda couldn’t be reached, so that didn’t go through. Check your connection and try again.',
                    'error',
                );
            }),
        [toast],
    );

    return null;
}
