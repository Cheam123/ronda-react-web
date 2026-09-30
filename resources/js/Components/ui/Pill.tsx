import clsx from 'clsx';
import type { ReactNode } from 'react';

export type PillTone = 'navy' | 'blue' | 'green' | 'purple' | 'orange' | 'grey' | 'red';

interface PillProps {
    tone?: PillTone;
    /** Any CSS colour, for the few statuses that carry their own. */
    color?: string;
    className?: string;
    title?: string;
    children: ReactNode;
}

/** A rounded, filled label: people, statuses, appointment dates. */
export default function Pill({ tone = 'blue', color, className, title, children }: PillProps) {
    return (
        <span
            className={clsx('pill', !color && `pill--${tone}`, className)}
            style={color ? { background: color } : undefined}
            title={title}
        >
            {children}
        </span>
    );
}
