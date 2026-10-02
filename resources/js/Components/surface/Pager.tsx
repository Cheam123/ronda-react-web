import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import type { PaginationLink } from '@/types';

interface PagerProps {
    /** A Laravel paginator's links: Previous, the pages (with "..." gaps), Next. */
    links: PaginationLink[];
    className?: string;
}

/** Previous, page numbers and Next for a surface list. Hidden when everything fits on one page. */
export default function Pager({ links, className }: PagerProps) {
    if (links.length <= 3) {
        return null;
    }

    const previous = links[0];
    const next = links[links.length - 1];
    const pages = links.slice(1, -1);

    return (
        <nav className={clsx('rd-pager', className)} aria-label="Pagination">
            <PagerStep link={previous} direction="previous" />
            {pages.map((link, index) =>
                link.url === null ? (
                    <span key={`gap-${index}`} className="rd-pager__gap" aria-hidden="true">
                        &hellip;
                    </span>
                ) : (
                    <Link
                        key={link.label}
                        href={link.url}
                        className={clsx('rd-pager__page', link.active && 'is-current')}
                        aria-current={link.active ? 'page' : undefined}
                        aria-label={`Page ${link.label}`}
                        preserveScroll
                        preserveState
                    >
                        {link.label}
                    </Link>
                ),
            )}
            <PagerStep link={next} direction="next" />
        </nav>
    );
}

function PagerStep({ link, direction }: { link: PaginationLink; direction: 'previous' | 'next' }) {
    const label = direction === 'previous' ? 'Previous' : 'Next';
    const content =
        direction === 'previous' ? (
            <>
                <i className="mdi mdi-chevron-left" aria-hidden="true" />
                {label}
            </>
        ) : (
            <>
                {label}
                <i className="mdi mdi-chevron-right" aria-hidden="true" />
            </>
        );

    if (!link.url) {
        return (
            <span className="rd-btn is-disabled" aria-disabled="true">
                {content}
            </span>
        );
    }

    return (
        <Link
            href={link.url}
            className="rd-btn"
            rel={direction === 'previous' ? 'prev' : 'next'}
            preserveScroll
            preserveState
        >
            {content}
        </Link>
    );
}
