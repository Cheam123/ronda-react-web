import clsx from 'clsx';
import { initialsColor, initialsOf } from '@/lib/avatar';

interface InitialsProps {
    name: string | null | undefined;
    /** Keeps a person's colour stable; defaults to their name. */
    colorKey?: string | number;
    /** 24, 32, 40 or 56 px. */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    stacked?: boolean;
    className?: string;
}

/** A round avatar with a person's (or an outlet's) initials. */
export default function Initials({ name, colorKey, size = 'md', stacked = false, className }: InitialsProps) {
    return (
        <span
            className={clsx(
                'rd-avatar',
                size !== 'md' && `rd-avatar--${size}`,
                stacked && 'rd-avatar--stacked',
                className,
            )}
            style={{ background: initialsColor(colorKey ?? name ?? '') }}
            title={stacked ? (name ?? undefined) : undefined}
            aria-hidden="true"
        >
            {initialsOf(name)}
        </span>
    );
}
