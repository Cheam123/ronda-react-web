import { Link } from '@inertiajs/react';
import { Fragment, type ReactNode } from 'react';

export type BreadcrumbTrail = ReactNode[];

/** "Home > Users > Total: 12" in the header. Hidden on phones. */
export default function Breadcrumbs({ trail }: { trail: BreadcrumbTrail }) {
    return (
        <div className="header-breadcrumb d-none d-md-flex align-items-center">
            <Link href="/index">Home</Link>
            {trail.map((crumb, index) => (
                <Fragment key={index}>
                    <i className="fas fa-arrow-alt-circle-right" />
                    <span>{crumb}</span>
                </Fragment>
            ))}
        </div>
    );
}
