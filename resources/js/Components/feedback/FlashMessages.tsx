import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { fireServerAlert } from '@/lib/dialogs';
import type { PageProps } from '@/types';
import { useToast } from './ToastProvider';

/**
 * Shows what the server flashed for this response: the SweetAlert queued by
 * alert()->..., and plain `success` / `error` flashes as toasts.
 */
export default function FlashMessages() {
    const { flash } = usePage<PageProps>().props;
    const toast = useToast();

    useEffect(() => {
        if (flash.alert) {
            fireServerAlert(flash.alert);
        } else if (flash.error) {
            toast(flash.error, 'error');
        } else if (flash.success) {
            toast(flash.success, 'success');
        }
        // A fresh `flash` object arrives with every response, so this runs
        // once per visit and never re-fires a message on re-render.
    }, [flash, toast]);

    return null;
}
