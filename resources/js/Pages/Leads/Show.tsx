import { Link, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import DocumentList from '@/Components/documents/DocumentList';
import GpsStampField from '@/Components/form/GpsStampField';
import Initials from '@/Components/surface/Initials';
import PageHeader from '@/Components/surface/PageHeader';
import TabList from '@/Components/surface/TabList';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useAuth } from '@/hooks/useAuth';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import AppLayout from '@/Layouts/AppLayout';
import { formatPhone, phoneHref } from '@/lib/phone';
import { areaHue, tagClass } from '@/lib/tags';
import type { SelectOption } from '@/types';
import type { DocumentFile } from '@/types/documents';
import type {
    FollowUpTopic,
    Lead,
    LeadFormOptions,
    Order,
    Recommendation,
    TaskSummary,
    Visit,
    VisitBrief as Brief,
} from '@/types/leads';
import AskRonda from './Partials/AskRonda';
import FollowUpDialog from './Partials/FollowUpDialog';
import { OrderHistory, SuggestedOrders, VisitHistory } from './Partials/OutletActivity';
import TaskHistories from './Partials/TaskHistories';
import VisitBrief from './Partials/VisitBrief';

interface ShowLeadProps extends LeadFormOptions {
    lead: Lead;
    documents: DocumentFile[];
    tasks: TaskSummary[];
    visits: Visit[];
    orders: Order[];
    recommendation: Recommendation | null;
    brief: Brief | null;
    /** Whether Claude on Bedrock is set up for the rep assistant. */
    assistant: { available: boolean };
}

type Tab = 'tasks' | 'visits' | 'orders' | 'suggested';

const TABS: Tab[] = ['tasks', 'visits', 'orders', 'suggested'];

/** "28 Sep" from "28 Sep 2026" or "28 Sep 2026, 10:42 AM". */
const dayMonth = (label: string) => label.split(', ')[0].split(' ').slice(0, 2).join(' ');

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
    brief,
    assistant,
    ...options
}: ShowLeadProps) {
    const { can } = useAuth();
    const { url } = usePage();
    // ?tab=suggested opens a tab directly (the dashboard's Suggested orders links here).
    const [tab, setTab] = useState<Tab>(() => {
        const wanted = new URLSearchParams(url.split('?')[1] ?? '').get('tab') as Tab | null;
        return wanted && TABS.includes(wanted) && (wanted !== 'suggested' || recommendation) ? wanted : 'tasks';
    });
    const [asking, setAsking] = useState(false);
    const [followingUp, setFollowingUp] = useState(false);
    const title = lead.business_name || lead.name || 'Unnamed outlet';

    const lastOrder = orders.find((order) => !order.cancelled);
    const followUpTopics: { value: FollowUpTopic; label: string }[] = [
        ...(visits[0]
            ? [{ value: 'last_visit' as const, label: `Last visit · ${dayMonth(visits[0].visited_at)}` }]
            : []),
        ...(lastOrder
            ? [{ value: 'last_order' as const, label: `Last order · ${dayMonth(lastOrder.order_date)}` }]
            : []),
        ...(recommendation?.items?.length ? [{ value: 'suggested' as const, label: 'Suggested products' }] : []),
    ];
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

    const canAddTask = can('add_task') && lead.taskable;
    const canOrder = can('record_order');
    const narrow = useMediaQuery('(max-width: 1199.98px)');
    // On a phone the bar at the foot holds the page's main button, so Edit outlet steps down.
    const barShown = useMediaQuery('(max-width: 767.98px)') && (canAddTask || canOrder);

    const activity = (
        <section className="rd-panel rd-panel--flush lead-activity" aria-label="Activity">
            <TabList
                id="outlet-activity"
                label="Activity"
                className="lead-activity__tabs"
                tabs={tabs}
                value={tab}
                onChange={setTab}
            />
            <div role="tabpanel" id="outlet-activity-panel" aria-labelledby={`outlet-activity-tab-${tab}`}>
                {tab === 'tasks' && <TaskHistories tasks={tasks} />}
                {tab === 'visits' && <VisitHistory visits={visits} />}
                {tab === 'orders' && <OrderHistory orders={orders} />}
                {tab === 'suggested' && recommendation && (
                    <SuggestedOrders recommendation={recommendation} leadId={lead.id} />
                )}
            </div>
        </section>
    );

    const beforeVisit = (
        <>
            <VisitBrief
                leadId={lead.id}
                brief={brief}
                available={assistant.available}
                onFollowUp={() => setFollowingUp(true)}
            />
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
                    <Fact label="Email">{lead.email && <a href={`mailto:${lead.email}`}>{lead.email}</a>}</Fact>
                    <Fact label="Category">{labelOf(options.businessCategories, lead.business_category)}</Fact>
                    <Fact label="Source">{labelOf(options.sources, lead.source)}</Fact>
                    <Fact label="Received">
                        {lead.receiving_date && LONG_DATE.format(new Date(`${lead.receiving_date}T00:00:00`))}
                    </Fact>
                    <Fact label="Created by">{lead.created_by}</Fact>
                </dl>
            </Panel>
            <Panel title="Where" side={area && <span className={tagClass(areaHue(area.value))}>{area.label}</span>}>
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
        </>
    );

    const background = (
        <>
            <Panel title="Outlet profile">
                <div className="lead-profile">
                    <ProfileCell label="Size" value={labelOf(options.sizeBands, lead.size_band)} />
                    <ProfileCell label="Seats" value={lead.seats === null ? null : String(lead.seats)} />
                    <ProfileCell label="Segment" value={labelOf(options.segments, lead.segment)} />
                </div>
                <p className="lead-profile__note">Suggested orders compare outlets on these and the location.</p>
            </Panel>

            {lead.remark && (
                <Panel title="Remark">
                    <p className="lead-remark">{lead.remark}</p>
                </Panel>
            )}

            <Panel title="Documents" count={documents.length}>
                <DocumentList documents={documents} />
            </Panel>
        </>
    );

    return (
        <AppLayout title={title}>
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Outlets', href: route('lead.index') },
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
                            <button type="button" className="rd-btn rd-btn--lg" onClick={() => setAsking(true)}>
                                <i className="mdi mdi-message-text-outline" aria-hidden="true" />
                                Ask Ronda
                            </button>
                            {/* On phones these two move to the bar at the foot of the screen. */}
                            {canAddTask && (
                                <Link
                                    href={route('tasks.create', { id: lead.id })}
                                    className="rd-btn rd-btn--lg lead-head__visit-action"
                                >
                                    <i className="mdi mdi-playlist-plus" aria-hidden="true" />
                                    Add task
                                </Link>
                            )}
                            {canOrder && (
                                <Link
                                    href={route('lead.orders.create', lead.id)}
                                    className="rd-btn rd-btn--lg lead-head__visit-action"
                                >
                                    <i className="mdi mdi-cart-plus" aria-hidden="true" />
                                    Record order
                                </Link>
                            )}
                            {can('edit_lead') && (
                                <Link
                                    href={route('lead.edit', lead.id)}
                                    className={clsx('rd-btn rd-btn--lg', !barShown && 'rd-btn--primary')}
                                >
                                    <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                                    Edit outlet
                                </Link>
                            )}
                        </>
                    }
                />

                {/* Narrow screens: what a rep needs at the door (the brief, the contact) comes before the history. */}
                <div className={clsx('lead-page', (canAddTask || canOrder) && 'lead-page--with-bar')}>
                    {narrow ? (
                        <>
                            <div className="lead-page__aside">{beforeVisit}</div>
                            {activity}
                            <div className="lead-page__aside">{background}</div>
                        </>
                    ) : (
                        <>
                            {activity}
                            <aside className="lead-page__aside">
                                {beforeVisit}
                                {background}
                            </aside>
                        </>
                    )}
                </div>

                {(canAddTask || canOrder) && (
                    <div className="lead-actionbar" role="group" aria-label={`Act on ${title}`}>
                        {canAddTask && (
                            <Link href={route('tasks.create', { id: lead.id })} className="rd-btn rd-btn--lg">
                                <i className="mdi mdi-playlist-plus" aria-hidden="true" />
                                Add task
                            </Link>
                        )}
                        {canOrder && (
                            <Link
                                href={route('lead.orders.create', lead.id)}
                                className="rd-btn rd-btn--primary rd-btn--lg"
                            >
                                <i className="mdi mdi-cart-plus" aria-hidden="true" />
                                Record order
                            </Link>
                        )}
                    </div>
                )}

                <AskRonda
                    show={asking}
                    onHide={() => setAsking(false)}
                    lead={{ id: lead.id, name: title, customerId: lead.customer_id }}
                    available={assistant.available}
                />
                <FollowUpDialog
                    show={followingUp}
                    onHide={() => setFollowingUp(false)}
                    lead={{ id: lead.id, name: title, mobile: lead.mobile }}
                    topics={followUpTopics}
                />
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
