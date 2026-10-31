import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { confirm } from '@/lib/dialogs';

/**
 * Asks before a page with unsaved changes is left. A visit to another page
 * (a menu link, Cancel, a crumb) asks in a dialog; closing or reloading the
 * tab gets the browser's own question. Saving is a post and is never held
 * back, nor are visits that stay on the page (filters, a file deleted from a
 * list, partial reloads). The browser's Back button is not caught.
 *
 * `what` names the thing being edited in the question ("Kopi Kita Bangsar").
 * `keptAsDraft` says the answers survive as a draft on this device (form
 * fill-in), so leaving loses only the picked files.
 */
export function useUnsavedChanges(dirty: boolean, what?: string, { keptAsDraft = false } = {}) {
    useEffect(() => {
        if (!dirty) return;

        let leaving = false;

        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            // Older browsers need a value to show their prompt.
            event.returnValue = '';
        };

        const off = router.on('before', (event) => {
            const { visit } = event.detail;
            const staying = visit.preserveState === true || visit.url.pathname === window.location.pathname;
            if (leaving || visit.method !== 'get' || staying) return;

            event.preventDefault();
            confirm(
                keptAsDraft
                    ? {
                          title: 'Leave this form?',
                          text: 'Your answers stay on this device as a draft; open the form again to pick them up. Files you picked are not kept.',
                          icon: 'warning',
                          confirmText: 'Leave',
                          cancelText: 'Keep filling in',
                          safeCancel: true,
                      }
                    : {
                          title: 'Leave without saving?',
                          text: `Your changes${what ? ` to ${what}` : ''} haven’t been saved. If you leave now, they are lost.`,
                          icon: 'warning',
                          confirmText: 'Leave without saving',
                          cancelText: 'Keep editing',
                          safeCancel: true,
                      },
            ).then((leave) => {
                if (!leave) return;
                leaving = true;
                router.visit(visit.url.href, {
                    replace: visit.replace,
                    preserveScroll: visit.preserveScroll,
                });
            });
        });

        window.addEventListener('beforeunload', onBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            off();
        };
    }, [dirty, what, keptAsDraft]);
}
