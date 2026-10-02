import { Link, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useState } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import { useAuth } from '@/hooks/useAuth';
import type { PageProps } from '@/types';
import { matchesPath, NAVIGATION, type NavGroup, type NavLink } from './navigation';

/** The groups and links this user may see, each group with its allowed links. */
function useNavigation() {
    const { url, props } = usePage<PageProps>();
    const { can } = useAuth();
    const allowed = <T extends NavGroup | NavLink>(item: T) => !item.abilities || can(...item.abilities);
    const badgeOf = (link: NavLink) => (link.badge ? props.navigation[link.badge] : 0);

    const groups = NAVIGATION.filter(allowed).map((group) => {
        const links = group.children?.filter(allowed) ?? [];

        return {
            group,
            links,
            active: matchesPath(url, group.active),
            // A group shows the sum of its links' counts (pending form tasks).
            badge: links.reduce((sum, link) => sum + badgeOf(link), 0),
        };
    });

    return { groups, url, badgeOf };
}

function Count({ value }: { value: number }) {
    return value > 0 ? <span className="rd-nav__count">{value}</span> : null;
}

/** The desktop bar: links, and groups that open as menus. */
export function NavBar() {
    const { groups, url, badgeOf } = useNavigation();

    return (
        <nav className="rd-nav" aria-label="Main">
            {groups.map(({ group, links, active, badge }) =>
                group.children ? (
                    <Dropdown key={group.label}>
                        <Dropdown.Toggle
                            as="button"
                            type="button"
                            bsPrefix={clsx('rd-nav__link', active && 'is-active')}
                        >
                            <i className={group.icon} aria-hidden="true" />
                            {group.label}
                            <Count value={badge} />
                            <i className="mdi mdi-chevron-down rd-nav__chevron" aria-hidden="true" />
                        </Dropdown.Toggle>
                        <Dropdown.Menu className="rd-menu rd-nav__menu">
                            {links.map((link) => {
                                const current = matchesPath(url, link.active);

                                return (
                                    <Link
                                        key={link.label}
                                        href={link.href()}
                                        className={clsx('dropdown-item', current && 'is-current')}
                                        aria-current={current ? 'page' : undefined}
                                    >
                                        <span className="flex-grow-1">{link.label}</span>
                                        <Count value={badgeOf(link)} />
                                        {current && <i className="mdi mdi-check rd-nav__tick" aria-hidden="true" />}
                                    </Link>
                                );
                            })}
                        </Dropdown.Menu>
                    </Dropdown>
                ) : (
                    <Link
                        key={group.label}
                        href={group.href!()}
                        className={clsx('rd-nav__link', active && 'is-active')}
                        aria-current={active ? 'page' : undefined}
                    >
                        <i className={group.icon} aria-hidden="true" />
                        {group.label}
                    </Link>
                ),
            )}
        </nav>
    );
}

/** The phone menu: every link in a list, groups opening in place. */
export function NavSheet() {
    const { groups, url, badgeOf } = useNavigation();
    // The group holding the current page starts open.
    const [open, setOpen] = useState<string | null>(
        () => groups.find(({ group, active }) => group.children && active)?.group.label ?? null,
    );

    return (
        <nav className="rd-sheet__nav" aria-label="Main">
            {groups.map(({ group, links, active, badge }) => {
                if (!group.children) {
                    return (
                        <Link
                            key={group.label}
                            href={group.href!()}
                            className={clsx('rd-sheet__link', active && 'is-active')}
                            aria-current={active ? 'page' : undefined}
                        >
                            <i className={group.icon} aria-hidden="true" />
                            {group.label}
                        </Link>
                    );
                }

                const expanded = open === group.label;

                return (
                    <div key={group.label}>
                        <button
                            type="button"
                            className={clsx('rd-sheet__link', active && 'is-active')}
                            aria-expanded={expanded}
                            onClick={() => setOpen(expanded ? null : group.label)}
                        >
                            <i className={group.icon} aria-hidden="true" />
                            <span className="flex-grow-1 text-start">{group.label}</span>
                            <Count value={badge} />
                            <i
                                className={clsx(
                                    'mdi rd-sheet__chevron',
                                    expanded ? 'mdi-chevron-up' : 'mdi-chevron-down',
                                )}
                                aria-hidden="true"
                            />
                        </button>
                        {expanded && (
                            <div className="rd-sheet__group">
                                {links.map((link) => {
                                    const current = matchesPath(url, link.active);

                                    return (
                                        <Link
                                            key={link.label}
                                            href={link.href()}
                                            className={clsx('rd-sheet__sublink', current && 'is-active')}
                                            aria-current={current ? 'page' : undefined}
                                        >
                                            <span className="flex-grow-1">{link.label}</span>
                                            <Count value={badgeOf(link)} />
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
