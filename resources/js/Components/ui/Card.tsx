import clsx from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
    /** Rendered in a .card-header above the body (filters, toolbars). */
    header?: ReactNode;
    /** `raised` is the theme's shadowed card3; `plain` a flat Bootstrap card. */
    variant?: 'raised' | 'plain';
    className?: string;
    bodyClassName?: string;
    children: ReactNode;
}

export default function Card({ header, variant = 'raised', className, bodyClassName, children }: CardProps) {
    return (
        <div className={clsx('card', variant === 'raised' && 'card3', 'custom-font-small', className)}>
            {header && <div className="card-header">{header}</div>}
            <div className={clsx('card-body', bodyClassName)}>{children}</div>
        </div>
    );
}
