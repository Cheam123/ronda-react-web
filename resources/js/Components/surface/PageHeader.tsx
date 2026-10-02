import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

export interface Crumb {
    label: string;
    href?: string;
}

interface PageHeaderProps {
    title: ReactNode;
    /** Small capitals above the title ("Admin · Wednesday, 30 September 2026"). */
    eyebrow?: ReactNode;
    /** The trail above the title; the last crumb is the current page. */
    crumbs?: Crumb[];
    /** A line of context under the title. */
    lede?: ReactNode;
    /** Chips and facts under the title (SKU, category, status). */
    meta?: ReactNode;
    /** Buttons on the right. */
    actions?: ReactNode;
    /** Beside the title, before it (an outlet's avatar). */
    leading?: ReactNode;
}

/** A surface page's heading: eyebrow or breadcrumb, title, context, actions. */
export default function PageHeader({ title, eyebrow, crumbs, lede, meta, actions, leading }: PageHeaderProps) {
    const heading = (
        <>
            <h1 className="rd-head__title">{title}</h1>
            {lede && <p className="rd-head__lede">{lede}</p>}
            {meta && <div className="rd-head__meta">{meta}</div>}
        </>
    );

    return (
        <header className="rd-head">
            <div className="rd-head__text">
                {crumbs && crumbs.length > 0 && (
                    <nav aria-label="Breadcrumb">
                        <ol className="rd-crumbs">
                            {crumbs.map((crumb, index) =>
                                index === crumbs.length - 1 ? (
                                    <li key={crumb.label}>
                                        <span aria-current="page">{crumb.label}</span>
                                    </li>
                                ) : (
                                    <li key={crumb.label}>
                                        {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : crumb.label}
                                    </li>
                                ),
                            )}
                        </ol>
                    </nav>
                )}
                {eyebrow && <p className="rd-head__eyebrow">{eyebrow}</p>}
                {leading ? (
                    <div className="rd-head__main">
                        {leading}
                        <div className="rd-head__text">{heading}</div>
                    </div>
                ) : (
                    heading
                )}
            </div>
            {actions && <div className="rd-head__actions">{actions}</div>}
        </header>
    );
}
