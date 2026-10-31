import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import { useState } from 'react';
import Initials from '@/Components/surface/Initials';
import Meter from '@/Components/surface/Meter';
import { useAuth } from '@/hooks/useAuth';
import { formatMoney, pluralize } from '@/lib/format';
import type { AdminSummary } from '../types';

/** The smaller panels of the admin dashboard: the activity feed and IFE area coverage. */

function MoreLink({ href, children }: { href: string; children: string }) {
    return (
        <Link href={href} className="rd-more">
            {children}
            <i className="mdi mdi-arrow-right" aria-hidden="true" />
        </Link>
    );
}

/** "8 areas with 24 outlets between them. 2 visit reports this month, all in Kuala Lumpur." */
function coverageLine(areas: AdminSummary['areas']): string {
    const outlets = areas.reduce((sum, area) => sum + area.outlets, 0);
    const reports = areas.reduce((sum, area) => sum + area.reports_month, 0);
    const visited = areas.filter((area) => area.reports_month > 0);

    const where =
        areas.length === 1
            ? `1 area, with ${pluralize(outlets, 'outlet')}.`
            : `${areas.length} areas with ${pluralize(outlets, 'outlet')} between them.`;
    const visits =
        reports === 0
            ? 'No visit reports this month.'
            : visited.length === 1
              ? `${pluralize(reports, 'visit report')} this month, ${reports === 1 ? 'in' : 'all in'} ${visited[0].name}.`
              : `${pluralize(reports, 'visit report')} this month, across ${visited.length} areas.`;

    return `${where} ${visits}`;
}

/** One line, with the per-area figures on request. */
export function AreaCoverage({ areas }: { areas: AdminSummary['areas'] }) {
    const { can } = useAuth();
    const [open, setOpen] = useState(false);
    const most = Math.max(0, ...areas.map((area) => area.outlets));
    const empty = areas.filter((area) => area.outlets === 0).length;

    return (
        <section className="rd-panel rd-span-5" aria-labelledby="areas-title">
            <div className="rd-panel__head">
                <h2 id="areas-title" className="rd-panel__title">
                    Coverage by IFE area
                </h2>
            </div>
            {areas.length === 0 ? (
                <p className="rd-muted">No IFE areas yet.</p>
            ) : (
                <>
                    <p className="dash-coverage">
                        {coverageLine(areas)}
                        {empty > 0 && (
                            <span className="rd-status rd-status--serious">
                                <i className="mdi mdi-alert" aria-hidden="true" />
                                {pluralize(empty, 'area has', 'areas have')} no outlets yet.
                            </span>
                        )}
                    </p>
                    <div>
                        <button
                            type="button"
                            className="rd-btn rd-btn--sm"
                            aria-expanded={open}
                            aria-controls="areas-list"
                            onClick={() => setOpen((shown) => !shown)}
                        >
                            {open
                                ? 'Hide the areas'
                                : areas.length === 1
                                  ? 'Show the area'
                                  : `Show the ${areas.length} areas`}
                            <i className={`mdi mdi-chevron-${open ? 'up' : 'down'}`} aria-hidden="true" />
                        </button>
                    </div>
                    <div id="areas-list" className="dash-coverage__list" hidden={!open}>
                        <ul className="dash-bars dash-bars--areas">
                            <li className="dash-bars__head" aria-hidden="true">
                                <span>Area</span>
                                <span />
                                <span className="num">Outlets</span>
                                <span className="num">Reports</span>
                            </li>
                            {areas.map((area) => (
                                <li key={area.id}>
                                    <span className="fw-medium">{area.name}</span>
                                    <Meter value={area.outlets} max={most} />
                                    <span
                                        className={clsx('num', area.outlets === 0 && 'rd-status--serious fw-semibold')}
                                    >
                                        <span className="visually-hidden">Outlets: </span>
                                        {area.outlets}
                                    </span>
                                    <span className="num rd-muted">
                                        <span className="visually-hidden">Visit reports this month: </span>
                                        {area.reports_month}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <span className="rd-panel__sub">Reports are visit reports filed this month.</span>
                    </div>
                </>
            )}
            {can('manage_area') && <MoreLink href={route('area.index')}>Manage IFE areas</MoreLink>}
        </section>
    );
}

const KIND_ICONS: Record<AdminSummary['activity'][number]['kind'], string> = {
    order: 'mdi-receipt',
    visit: 'mdi-map-marker-outline',
    form: 'mdi-file-document-outline',
    task: 'mdi-check',
};

export function ActivityFeed({ activity, currency }: { activity: AdminSummary['activity']; currency: string }) {
    return (
        <section className="rd-panel rd-span-7" aria-labelledby="activity-title">
            <div className="rd-panel__head">
                <h2 id="activity-title" className="rd-panel__title">
                    Recent activity
                </h2>
                <span className="rd-panel__sub">Orders, visits, forms and finished tasks</span>
            </div>
            {activity.length === 0 ? (
                <p className="rd-muted">Nothing has happened yet.</p>
            ) : (
                <ul className="rd-rows dash-feed">
                    {activity.map((event, index) => (
                        <li key={`${event.at}-${index}`}>
                            <span className="dash-feed__when">{event.when}</span>
                            {event.who ? (
                                <Initials name={event.who} />
                            ) : (
                                <span className="rd-icon dash-feed__icon" aria-hidden="true">
                                    <i className={`mdi ${KIND_ICONS[event.kind]}`} />
                                </span>
                            )}
                            <span className="dash-feed__what">
                                <strong className="fw-semibold">{event.who ?? 'Someone'}</strong> {event.what}
                            </span>
                            <span className="dash-feed__amount">
                                {event.amount !== null && `${currency} ${formatMoney(event.amount)}`}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
