import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

const ICONS: Record<ToastType, string> = {
    success: 'mdi mdi-check-bold',
    error: 'mdi mdi-close-thick',
    warning: 'mdi mdi-alert-outline',
    info: 'mdi mdi-information-outline',
};

/** How long a toast lingers after the pointer leaves it. */
const RESUME_DELAY = 1200;
/** Matches the .app-toast exit transition. */
const EXIT_DURATION = 350;

interface ToastProps {
    id: number;
    type: ToastType;
    title: string;
    message: string;
    duration: number;
    onDismiss: (id: number) => void;
}

export default function Toast({ id, type, title, message, duration, onDismiss }: ToastProps) {
    const [phase, setPhase] = useState<'entering' | 'shown' | 'leaving'>('entering');
    const [paused, setPaused] = useState(false);
    const timer = useRef<number>();

    const dismiss = useCallback(() => {
        window.clearTimeout(timer.current);
        setPhase('leaving');
        window.setTimeout(() => onDismiss(id), EXIT_DURATION);
    }, [id, onDismiss]);

    const schedule = useCallback(
        (delay: number) => {
            window.clearTimeout(timer.current);
            if (duration > 0) {
                timer.current = window.setTimeout(dismiss, delay);
            }
        },
        [dismiss, duration],
    );

    useEffect(() => {
        const frame = requestAnimationFrame(() => setPhase('shown'));
        schedule(duration);
        return () => {
            cancelAnimationFrame(frame);
            window.clearTimeout(timer.current);
        };
    }, [duration, schedule]);

    return (
        <div
            className={clsx('app-toast', `app-toast--${type}`, {
                show: phase === 'shown',
                hide: phase === 'leaving',
            })}
            role={type === 'error' ? 'alert' : 'status'}
            onMouseEnter={() => {
                setPaused(true);
                window.clearTimeout(timer.current);
            }}
            onMouseLeave={() => {
                setPaused(false);
                schedule(RESUME_DELAY);
            }}
        >
            <span className="app-toast__icon">
                <i className={ICONS[type]} />
            </span>
            <div className="app-toast__body">
                {title && <div className="app-toast__title">{title}</div>}
                <div className="app-toast__msg">{message}</div>
            </div>
            <button type="button" className="app-toast__close" aria-label="Dismiss" onClick={dismiss}>
                &times;
            </button>
            {duration > 0 && (
                <div
                    className="app-toast__bar"
                    style={{
                        animationDuration: `${duration}ms`,
                        animationPlayState: paused ? 'paused' : 'running',
                    }}
                />
            )}
        </div>
    );
}
