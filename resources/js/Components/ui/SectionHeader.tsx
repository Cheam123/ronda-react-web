import clsx from 'clsx';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
    title: ReactNode;
    /** Small muted text after the title, e.g. a count. */
    note?: ReactNode;
    /** Buttons or links on the right-hand side. */
    actions?: ReactNode;
    className?: string;
}

/** The blue bar that titles each section of a page ("Lead/Customer Detail"). */
export default function SectionHeader({ title, note, actions, className }: SectionHeaderProps) {
    return (
        <div className={clsx('section-header', className)}>
            <span>
                {title}
                {note !== undefined && <span className="custom-font-xsmall ms-1">{note}</span>}
            </span>
            {actions && <div className="section-header__actions">{actions}</div>}
        </div>
    );
}
