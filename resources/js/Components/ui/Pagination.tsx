import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import type { PaginationLink } from '@/types';

/** Laravel labels its arrows with HTML entities ("&laquo; Previous"). */
function labelText(label: string): string {
    return label.replace('&laquo;', '‹').replace('&raquo;', '›').replace(' Previous', '').replace('Next ', '');
}

interface PaginationProps {
    links: PaginationLink[];
    className?: string;
}

/** Page links for a Laravel paginator. Hidden when everything fits on one page. */
export default function Pagination({ links, className }: PaginationProps) {
    if (links.length <= 3) {
        return null;
    }

    return (
        <nav className={className} aria-label="Pagination">
            <ul className="pagination pagination-sm flex-wrap mb-2">
                {links.map((link, index) => (
                    <li
                        key={`${index}-${link.label}`}
                        className={clsx('page-item', { active: link.active, disabled: !link.url })}
                    >
                        {link.url ? (
                            <Link href={link.url} className="page-link" preserveScroll preserveState>
                                {labelText(link.label)}
                            </Link>
                        ) : (
                            <span className="page-link">{labelText(link.label)}</span>
                        )}
                    </li>
                ))}
            </ul>
        </nav>
    );
}
