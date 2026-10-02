import { Link } from '@inertiajs/react';
import clsx from 'clsx';

interface DashboardTabsProps {
    active: 'organisation' | 'team';
    /** Overdue tasks, flagged on the Team operations tab. */
    overdue?: number;
}

/** Admins switch between the organisation overview and the team view managers see. */
export default function DashboardTabs({ active, overdue = 0 }: DashboardTabsProps) {
    return (
        <nav className="rd-tabs" aria-label="Dashboard view">
            <Link
                href="/index"
                className={clsx('rd-tabs__tab', active === 'organisation' && 'is-active')}
                aria-current={active === 'organisation' ? 'page' : undefined}
            >
                Organisation
            </Link>
            <Link
                href="/index?view=team"
                className={clsx('rd-tabs__tab', active === 'team' && 'is-active')}
                aria-current={active === 'team' ? 'page' : undefined}
            >
                Team operations
                {overdue > 0 && active !== 'team' && (
                    <span className="rd-chip rd-chip--critical">{overdue} overdue</span>
                )}
            </Link>
        </nav>
    );
}
