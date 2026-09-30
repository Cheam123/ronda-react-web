import { Link, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { PageProps } from '@/types';
import { matchesPath, NAVIGATION, type NavGroup, type NavLink } from './navigation';

/**
 * The top navigation bar. On large screens dropdowns open on hover (theme
 * CSS); below that the bar collapses and dropdowns open on tap.
 */
export default function NavMenu() {
    const { url, props } = usePage<PageProps>();
    const { can } = useAuth();
    const [openGroup, setOpenGroup] = useState<string | null>(null);

    const allowed = <T extends NavGroup | NavLink>(item: T) => !item.abilities || can(...item.abilities);

    return (
        <ul className="navbar-nav">
            {NAVIGATION.filter(allowed).map((group) => {
                const active = matchesPath(url, group.active);
                const children = group.children?.filter(allowed) ?? [];

                if (!group.children) {
                    return (
                        <li key={group.label} className="nav-item">
                            <Link className={clsx('nav-link', active && 'nav-active')} href={group.href!()}>
                                <i className={clsx(group.icon, 'me-2')} />
                                <span className="menu-label">{group.label}</span>
                            </Link>
                        </li>
                    );
                }

                const open = openGroup === group.label;

                return (
                    <li key={group.label} className={clsx('nav-item dropdown', open && 'active')}>
                        <button
                            type="button"
                            className={clsx('nav-link dropdown-toggle arrow-none', active && 'nav-active')}
                            aria-expanded={open}
                            onClick={() => setOpenGroup(open ? null : group.label)}
                        >
                            <i className={clsx(group.icon, 'me-2')} />
                            <span className="menu-label">{group.label}</span>
                            <div className="arrow-down" />
                        </button>
                        <div className={clsx('dropdown-menu', open && 'show')}>
                            {children.map((link) => (
                                <Link
                                    key={link.label}
                                    href={link.href()}
                                    className={clsx('dropdown-item', matchesPath(url, link.active) && 'nav-active')}
                                >
                                    {link.label}
                                    {link.badge && props.navigation[link.badge] > 0 && (
                                        <span className="badge bg-danger rounded-pill ms-1">
                                            {props.navigation[link.badge]}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
