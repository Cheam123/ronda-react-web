import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import Toast, { type ToastType } from './Toast';

export interface ToastOptions {
    /** Heading; defaults per type. Pass '' to hide it. */
    title?: string;
    /** Auto-dismiss after this many ms (default 3500). 0 keeps it until closed. */
    duration?: number;
}

interface ToastItem extends Required<ToastOptions> {
    id: number;
    type: ToastType;
    message: string;
}

type ShowToast = (message: string, type?: ToastType, options?: ToastOptions) => void;

const ToastContext = createContext<ShowToast | null>(null);

const DEFAULT_TITLES: Record<ToastType, string> = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Notice',
};

let nextId = 1;

/** Bottom-right toast notifications for the whole app. */
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: number) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const show = useCallback<ShowToast>((message, type = 'success', options = {}) => {
        setToasts((current) => [
            ...current,
            {
                id: nextId++,
                type,
                message,
                title: options.title ?? DEFAULT_TITLES[type],
                duration: options.duration ?? 3500,
            },
        ]);
    }, []);

    const value = useMemo(() => show, [show]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="app-toast-container" aria-live="polite" aria-atomic="true">
                {toasts.map((toast) => (
                    <Toast key={toast.id} {...toast} onDismiss={dismiss} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast(): ShowToast {
    const show = useContext(ToastContext);
    if (!show) {
        throw new Error('useToast() must be used inside <ToastProvider>.');
    }
    return show;
}
