import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import DocumentList from '@/Components/documents/DocumentList';
import GpsStampField from '@/Components/form/GpsStampField';
import Initials from '@/Components/surface/Initials';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/Layouts/AppLayout';
import { formatPhone, phoneHref } from '@/lib/phone';
import { areaHue, tagClass } from '@/lib/tags';
import type { SelectOption } from '@/types';
import type { DocumentFile } from '@/types/documents';
import type { Lead, LeadFormOptions, Order, Recommendation, TaskSummary, Visit } from '@/types/leads';
import { OrderHistory, SuggestedOrders, VisitHistory } from './Partials/OutletActivity';
import TaskHistories from './Partials/TaskHistories';

interface ShowLeadProps extends LeadFormOptions {
    lead: Lead;
    documents: DocumentFile[];
    tasks: TaskSummary[];
    visits: Visit[];
    orders: Order[];
    recommendation: Recommendation | null;
}

type Tab = 'tasks' | 'visits' | 'orders' | 'suggested';

const LONG_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** The label of the option holding `value`, or null. */
function labelOf(options: SelectOption[], value: string | number | null): string | null {
    return value === null ? null : (options.find((option) => String(option.value) === String(value))?.label ?? null);
}

/** An outlet: who and where it is on the right, its tasks, visits and orders on the left. */
export default function ShowLead({
    lead,
    documents,
    tasks,
    visits,
    orders,
    recommendation,
    ...options
}: ShowLeadProps) {
    const { can } = useAuth();
    const [tab, setTab] = useState<Tab>('tasks');
    const title = lead.business_name || lead.name || 'Unnamed outlet';
    const area = options.ifeAreas.find((option) => option.value === lead.ife_area_id);
    const phone = phoneHref(lead.mobile);

    const tabs: { key: Tab; label: string; count: number }[] = [
        { key: 'tasks', label: 'Tasks', count: tasks.length },
        { key: 'visits', label: 'Visits', count: visits.length },
        { key: 'orders', label: 'Orders', count: orders.length },
        ...(recommendation
            ? [{ key: 'suggested' as Tab, label: 'Suggested orders', count: recommendation.items?.length ?? 0 }]
            : []),
    ];

    const place = [lead.postcode, labelOf(options.cities, lead.city_id)].filter(Boolean).join(' ');
    const state = labelOf(options.states, lead.state_id);

    return (
        <AppLayout title={title}>
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Lead/Customer', href: route('lead.index') },
                        { label: title },
                    ]}
                    leading={<Initials name={title} colorKey={lead.id} size="xl" />}
                    title={title}
                    meta={
                        <>
                            {lead.customer_id ? (
                                <span className="rd-chip rd-chip--good">
                                    <span className="rd-dot" />
                                    Customer
                                </span>
                            ) : (
                                <span className="rd-chip rd-chip--serious">
                                    <span className="rd-dot" />
                                    Prospect
                                </span>
                            )}
                            {lead.customer_id && <span className="rd-mono lead-head__id">{lead.customer_id}</span>}
                            {area && <span className={tagClass(areaHue(area.value))}>{area.label}</span>}
                            {lead.assignee && (
                                <span className="lead-head__assignee">
                                    Assigned to
                                    <Initials
                                        name={lead.assignee}
                                        colorKey={lead.assignee_id ?? lead.assignee}
                                        size="sm"
                                    />
                                    <strong>{lead.assignee}</strong>
                                </span>
                            )}
                        </>
                    }
                    actions={
                        <>
                            {can('add_task') && lead.taskable && (
                                <Link href={route('tasks.create', { id: lead.id })} className="rd-btn rd-btn--lg">
                                    <i className="mdi mdi-playlist-plus" aria-hidden="true" />
                                    Add task
                                </Link>
                            )}
                            {can('record_order') && (
                                <Link href={route('lead.orders.create', lead.id)} className="rd-btn rd-btn--lg">
                                    <i className="mdi mdi-cart-plus" aria-hidden="true" />
                                    Record order
                                </Link>
                            )}
                            {can('edit_lead') && (
                                <Link href={route('lead.edit', lead.id)} className="rd-btn rd-btn--primary rd-btn--lg">
                                    <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                                    Edit outlet
                                </Link>
                            )}
                        </>
                    }
                />

                <div className="lead-page">
                    <section className="rd-panel rd-panel--flush lead-activity" aria-label="Activity">
                        <nav className="rd-tabs lead-activity__tabs" aria-label="Activity">
                            {tabs.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    className={clsx('rd-tabs__tab', tab === item.key && 'is-active')}
                                    aria-pressed={tab === item.key}
                                    onClick={() => setTab(item.key)}
                                >
                                    {item.label} <span className="rd-count">{item.count}</span>
                                </button>
                            ))}
                        </nav>
                        {tab === 'tasks' && <TaskHistories tasks={tasks} />}
                        {tab === 'visits' && <VisitHistory visits={visits} />}
                        {tab === 'orders' && <OrderHistory orders={orders} />}
                        {tab === 'suggested' && recommendation && <SuggestedOrders recommendation={recommendation} />}
                    </section>

                    <aside className="lead-page__aside">
                        <Panel title="Details">
                            <dl className="rd-facts">
                                <Fact label="Company">{lead.name}</Fact>
                                <Fact label="Mobile">
                                    {lead.mobile &&
                                        (phone ? (
                                            <a href={phone} className="rd-facts__phone">
                                                <i className="mdi mdi-phone-outline" aria-hidden="true" />
                                                {formatPhone(lead.mobile)}
                                            </a>
                                        ) : (
                                            formatPhone(lead.mobile)
                                        ))}
                                </Fact>
                                <Fact label="Email">
                                    {lead.email && <a href={`mailto:${lead.email}`}>{lead.email}</a>}
                                </Fact>
                                <Fact label="Category">
                                    {labelOf(options.businessCategories, lead.business_category)}
                                </Fact>
                                <Fact label="Source">{labelOf(options.sources, lead.source)}</Fact>
                                <Fact label="Received">
                                    {lead.receiving_date &&
                                        LONG_DATE.format(new Date(`${lead.receiving_date}T00:00:00`))}
                                </Fact>
                                <Fact label="Created by">{lead.created_by}</Fact>
                            </dl>
                        </Panel>

                        <Panel
                            title="Where"
                            side={area && <span className={tagClass(areaHue(area.value))}>{area.label}</span>}
                        >
                            {lead.address || place || state ? (
                                <p className="lead-where">
                                    {lead.address}
                                    {(place || state) && (
                                        <>
                                            {lead.address && <br />}
                                            {[place, state].filter(Boolean).join(', ')}
                                        </>
                                    )}
                                </p>
                            ) : (
                                <p className="rd-muted mb-0">No address yet.</p>
                            )}
                            <GpsStampField value={lead.gps} onChange={() => undefined} readOnly />
                        </Panel>

                        <Panel title="Outlet profile">
                            <div className="lead-profile">
                                <ProfileCell label="Size" value={labelOf(options.sizeBands, lead.size_band)} />
                                <ProfileCell label="Seats" value={lead.seats === null ? null : String(lead.seats)} />
                                <ProfileCell label="Segment" value={labelOf(options.segments, lead.segment)} />
                            </div>
                            <p className="lead-profile__note">
                                Suggested orders compare outlets on these and the location.
                            </p>
                        </Panel>

                        {lead.remark && (
                            <Panel title="Remark">
                                <p className="lead-remark">{lead.remark}</p>
                            </Panel>
                        )}

                        <Panel title="Documents" count={documents.length}>
                            <DocumentList documents={documents} />
                        </Panel>
                    </aside>
                </div>
            </SurfacePage>
        </AppLayout>
    );
}

function Panel({
    title,
    count,
    side,
    children,
}: {
    title: string;
    count?: number;
    side?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="rd-panel lead-card">
            <div className="lead-card__head">
                <h2 className="rd-panel__title">
                    {title}
                    {count !== undefined && <span className="rd-count">{count}</span>}
                </h2>
                {side}
            </div>
            {children}
        </section>
    );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <>
            <dt>{label}</dt>
            <dd>{children || <span className="rd-muted">—</span>}</dd>
        </>
    );
}

function ProfileCell({ label, value }: { label: string; value: string | null }) {
    return (
        <div className="lead-profile__cell">
            <span className="lead-profile__label">{label}</span>
            <span className="lead-profile__value">{value ?? '—'}</span>
        </div>
    );
}
