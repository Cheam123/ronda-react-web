import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import Initials from '@/Components/surface/Initials';
import Meter from '@/Components/surface/Meter';
import { useAuth } from '@/hooks/useAuth';
import { formatMoney, formatNumber, formatQuantity, pluralize } from '@/lib/format';
import type { AdminSummary } from '../types';

/**
 * The smaller panels of the admin dashboard: top products, people, IFE area
 * coverage, the activity feed and the scheduled jobs.
 */

function MoreLink({ href, children }: { href: string; children: string }) {
    return (
        <Link href={href} className="rd-more">
            {children}
            <i className="mdi mdi-arrow-right" aria-hidden="true" />
        </Link>
    );
}

export function TopProducts({ sales, currency }: { sales: AdminSummary['sales']; currency: string }) {
    const { can } = useAuth();
    const products = sales.top_products;
    const best = Math.max(0, ...products.map((product) => product.value));

    return (
        <section className="rd-panel rd-span-4" aria-labelledby="top-products-title">
            <div className="rd-panel__head">
                <h2 id="top-products-title" className="rd-panel__title">
                    Top products
                </h2>
                <span className="rd-panel__sub">{sales.month_label}, by value</span>
            </div>
            {products.length === 0 ? (
                <p className="rd-muted">No confirmed orders this month yet.</p>
            ) : (
                <ol className="dash-top">
                    {products.map((product, index) => (
                        <li key={product.id}>
                            <div className="dash-top__line">
                                <span className="dash-top__rank">{index + 1}</span>
                                <span className="dash-top__name">
                                    {can('manage_product') ? (
                                        <Link href={route('product.view', product.id)}>{product.name}</Link>
                                    ) : (
                                        <strong>{product.name}</strong>
                                    )}
                                    <span className="rd-mono rd-muted" style={{ fontSize: 11 }}>
                                        {product.sku} &middot; {formatQuantity(product.quantity)} {product.unit}
                                    </span>
                                </span>
                                <span className="dash-top__value">
                                    {currency} {formatNumber(product.value)}
                                </span>
                            </div>
                            <Meter value={product.value} max={best} thin />
                        </li>
                    ))}
                </ol>
            )}
            {can('manage_product') && <MoreLink href={route('product.index')}>Manage products</MoreLink>}
        </section>
    );
}

const ROLE_TONES: Record<number, string> = { 0: 'rd-chip--dark', 1: 'rd-chip--plum' };

export function PeoplePanel({ people }: { people: AdminSummary['people'] }) {
    const { can } = useAuth();

    return (
        <section className="rd-panel rd-span-4" aria-labelledby="people-title">
            <div className="rd-panel__head">
                <h2 id="people-title" className="rd-panel__title">
                    People
                </h2>
                <span className="rd-panel__sub">{people.length} active</span>
            </div>
            <ul className="rd-rows">
                {people.map((person) => (
                    <li key={person.id}>
                        <Initials name={person.name} colorKey={person.id} />
                        <span className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
                            <span className="fw-semibold">
                                {person.name}
                                {person.is_you && <span className="rd-muted fw-normal"> (you)</span>}
                            </span>
                            <span className={clsx('rd-status', person.telegram ? 'rd-status--good' : 'rd-muted')}>
                                <i
                                    className={`mdi ${person.telegram ? 'mdi-check' : 'mdi-telegram'}`}
                                    aria-hidden="true"
                                />
                                {person.telegram ? 'Telegram linked' : 'No Telegram'}
                                {person.push && <span className="rd-muted fw-normal"> &middot; push on</span>}
                            </span>
                        </span>
                        <span className={clsx('rd-chip', ROLE_TONES[person.type])}>{person.role}</span>
                    </li>
                ))}
            </ul>
            {can('manage_user') && <MoreLink href={route('users.index')}>Manage users</MoreLink>}
        </section>
    );
}

export function AreaCoverage({ areas }: { areas: AdminSummary['areas'] }) {
    const { can } = useAuth();
    const most = Math.max(0, ...areas.map((area) => area.outlets));

    return (
        <section className="rd-panel rd-span-4" aria-labelledby="areas-title">
            <div className="rd-panel__head">
                <h2 id="areas-title" className="rd-panel__title">
                    Coverage by IFE area
                </h2>
            </div>
            {areas.length === 0 ? (
                <p className="rd-muted">No IFE areas yet.</p>
            ) : (
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
                            <span className={clsx('num', area.outlets === 0 && 'rd-status--serious fw-semibold')}>
                                <span className="visually-hidden">Outlets: </span>
                                {area.outlets}
                            </span>
                            <span className="num rd-muted">
                                <span className="visually-hidden">IFE reports this month: </span>
                                {area.reports_month}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <span className="rd-panel__sub">Reports are IFE reports filed this month.</span>
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
        <section className="rd-panel rd-span-8" aria-labelledby="activity-title">
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

interface JobProps {
    name: string;
    ok: boolean;
    status: string;
    children: string;
}

function Job({ name, ok, status, children }: JobProps) {
    return (
        <div className="dash-job">
            <div className="dash-job__head">
                {name}
                <span className={clsx('rd-status', ok ? 'rd-status--good' : 'rd-status--serious')}>
                    <i className={`mdi ${ok ? 'mdi-check' : 'mdi-alert'}`} aria-hidden="true" />
                    {status}
                </span>
            </div>
            <p className="dash-job__text">{children}</p>
        </div>
    );
}

export function Automations({ automations, currency }: { automations: AdminSummary['automations']; currency: string }) {
    const { digest, recommendations, notifications } = automations;
    const unlinked = notifications.users - notifications.telegram;

    const digestText = !digest.today
        ? `No brief for today yet. It is written daily at ${digest.schedule}.`
        : digest.source === 'bedrock'
          ? "Today's brief was written by Claude through Amazon Bedrock. Managers see it on their dashboard."
          : `Bedrock was ${digest.error ? 'unavailable' : 'not configured'}, so today's brief used the template summary.`;

    return (
        <section className="rd-panel rd-span-4" aria-labelledby="jobs-title">
            <div className="rd-panel__head">
                <h2 id="jobs-title" className="rd-panel__title">
                    Automations
                </h2>
                <span className="rd-panel__sub">Scheduled jobs</span>
            </div>
            <div>
                <Job
                    name="Morning Round-Up"
                    ok={digest.today && digest.source === 'bedrock'}
                    status={
                        digest.today
                            ? digest.source === 'bedrock'
                                ? `Ran ${digest.ran_label}`
                                : 'Template used'
                            : 'Not run today'
                    }
                >
                    {digestText}
                </Job>
                <Job
                    name="Product recommendations"
                    ok={recommendations.fresh}
                    status={
                        recommendations.ran_label
                            ? `${recommendations.fresh ? 'Ran' : 'Last ran'} ${recommendations.ran_label}`
                            : 'Not run yet'
                    }
                >
                    {recommendations.ran_at
                        ? `${pluralize(recommendations.outlets, 'outlet')} refreshed. ${pluralize(recommendations.gaps, 'product gap')} found, worth about ${currency} ${formatNumber(recommendations.value)} a month.`
                        : `Runs daily at ${recommendations.schedule}.`}
                </Job>
                <Job
                    name="Notifications"
                    ok={unlinked === 0}
                    status={unlinked === 0 ? 'All linked' : `${unlinked} not linked`}
                >
                    {`Telegram linked for ${notifications.telegram} of ${notifications.users} users. Push notifications on for ${notifications.push} of ${notifications.users}.`}
                </Job>
            </div>
        </section>
    );
}
