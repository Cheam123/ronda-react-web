import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

export type BreadcrumbTrail = ReactNode[];

/** "Home > Users > Total: 12" above a page that has no PageHeader of its own. */
export default function Breadcrumbs({ trail }: { trail: BreadcrumbTrail }) {
    return (
        <nav aria-label="Breadcrumb" className="rd-shell__crumbs">
            <ol className="rd-crumbs">
                <li>
                    <Link href="/index">Home</Link>
                </li>
                {trail.map((crumb, index) => (
                    <li key={index}>{index === trail.length - 1 ? <span aria-current="page">{crumb}</span> : crumb}</li>
                ))}
            </ol>
        </nav>
    );
}
