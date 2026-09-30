import { Link, router, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import DataTable from '@/Components/ui/DataTable';
import SectionHeader from '@/Components/ui/SectionHeader';
import Pill from '@/Components/ui/Pill';
import { useAuth } from '@/hooks/useAuth';
import { confirm } from '@/lib/dialogs';
import { formatMoney, formatQuantity, pluralize } from '@/lib/format';
import type { PageProps } from '@/types';
import type { Order, Recommendation, Visit } from '@/types/leads';

interface OutletActivityProps {
    leadId: number;
    visits: Visit[];
    orders: Order[];
    /** Admins / Managers get a read-only copy of the rep's "Recommended" tab. */
    recommendation: Recommendation | null;
}

function VisitHistory({ visits }: { visits: Visit[] }) {
    return (
        <div className="mt-3">
            <SectionHeader title="Visit history" note={`(${visits.length})`} />
            <div className="m-2">
                {visits.length === 0 ? (
                    <div className="text-muted custom-font-small py-2">
                        No visits recorded at this outlet yet. Visits filed from the app show up here.
                    </div>
                ) : (
                    <DataTable nowrap={false}>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Visited by</th>
                                <th>Status</th>
                                <th>Summary</th>
                                <th>Next follow-up</th>
                                <th style={{ width: 30 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {visits.map((visit) => (
                                <tr key={visit.id}>
                                    <td className="text-nowrap">{visit.visited_at}</td>
                                    <td>{visit.visited_by}</td>
                                    <td>{visit.status}</td>
                                    <td>{visit.summary}</td>
                                    <td className="text-nowrap">
                                        {visit.followup_date}
                                        {visit.followup_plan && (
                                            <div className="text-muted custom-font-xsmall text-wrap">{visit.followup_plan}</div>
                                        )}
                                    </td>
                                    <td>
                                        <a href={route('ifereport.view', { id: visit.id })} target="_blank" rel="noopener noreferrer" title="Open report">
                                            <i className="mdi mdi-clipboard-outline font-size-20" />
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </DataTable>
                )}
            </div>
        </div>
    );
}

function OrderHistory({ leadId, orders }: { leadId: number; orders: Order[] }) {
    const { can } = useAuth();
    const { currency } = usePage<PageProps>().props.app;

    const cancel = async (order: Order) => {
        const confirmed = await confirm({
            title: `Cancel ${order.order_no}?`,
            text: 'It stays on the history but stops counting as a purchase.',
            danger: true,
        });
        if (confirmed) {
            router.post(route('lead.orders.cancel', order.id), {}, { preserveScroll: true });
        }
    };

    return (
        <div className="mt-3">
            <SectionHeader
                title="Order history"
                note={`(${orders.length})`}
                actions={
                    can('record_order') && (
                        <Link href={route('lead.orders.create', leadId)} className="btn btn-sm btn-light py-0">
                            + Record order
                        </Link>
                    )
                }
            />
            <div className="m-2">
                {orders.length === 0 ? (
                    <div className="text-muted custom-font-small py-2">No orders recorded for this outlet yet.</div>
                ) : (
                    <DataTable nowrap={false}>
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>Date</th>
                                <th>Products</th>
                                <th className="num">Total ({currency})</th>
                                <th>Recorded by</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order.id} className={clsx(order.cancelled && 'opacity-50')}>
                                    <td className="text-nowrap">
                                        {order.order_no}{' '}
                                        {order.cancelled && <Pill tone="grey">Cancelled</Pill>}
                                    </td>
                                    <td className="text-nowrap">{order.order_date}</td>
                                    <td>
                                        {order.lines.map((line, index) => (
                                            <div key={index}>
                                                {formatQuantity(line.quantity)} {line.unit} &times; {line.product}
                                            </div>
                                        ))}
                                        {order.remark && <div className="text-muted custom-font-xsmall">{order.remark}</div>}
                                    </td>
                                    <td className="num text-nowrap">{formatMoney(order.total_amount)}</td>
                                    <td>{order.recorded_by}</td>
                                    <td className="text-nowrap">
                                        {can('manage_order') && !order.cancelled && (
                                            <button type="button" className="btn btn-sm btn-outline-danger py-0" onClick={() => cancel(order)}>
                                                Cancel
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </DataTable>
                )}
            </div>
        </div>
    );
}

function SuggestedOrders({ recommendation }: { recommendation: Recommendation }) {
    const { currency } = usePage<PageProps>().props.app;
    const items = recommendation.items ?? [];
    const explanation = recommendation.explanation;

    return (
        <div className="mt-3 mb-3">
            <SectionHeader title="Suggested Orders" note="(what the rep sees on the outlet screen)" />
            <div className="m-2">
                {recommendation.status !== 'ready' ? (
                    <div className="text-muted custom-font-small py-2">
                        We need more information to give you suggestions. Order history and outlet details from
                        similar locations help us learn.
                    </div>
                ) : (
                    <>
                        <div className="custom-font-small mb-2">
                            Based on the {recommendation.similar_outlets} most similar outlets.{' '}
                            {pluralize(recommendation.gap_count ?? 0, 'product')} not ordered yet; estimated extra value{' '}
                            <b>
                                {currency} {formatMoney(recommendation.estimated_monthly_value)}
                            </b>{' '}
                            a month.
                        </div>
                        <DataTable nowrap={false}>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th />
                                    <th className="num">Similar outlets buying</th>
                                    <th className="num">Suggested / month</th>
                                    <th className="num">Currently / month</th>
                                    <th className="num">Value / month ({currency})</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.sku}>
                                        <td>
                                            {item.name} <span className="text-muted custom-font-xsmall">{item.sku}</span>
                                        </td>
                                        <td>
                                            <Pill tone={item.status === 'gap' ? 'green' : 'orange'}>
                                                {item.status === 'gap' ? 'Not ordered' : 'Top up'}
                                            </Pill>
                                        </td>
                                        <td className="num">
                                            {item.buyers} of {item.neighbors_used} ({Math.round(item.support * 100)}%)
                                        </td>
                                        <td className="num">
                                            {item.recommended_qty} {item.unit}
                                        </td>
                                        <td className="num">
                                            {item.current_qty} {item.unit}
                                        </td>
                                        <td className="num">{formatMoney(item.est_monthly_value)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </DataTable>

                        {explanation?.why && (
                            <div className="recommendation-why custom-font-small mt-2">
                                <b>Why these?</b>
                                <div>{explanation.why}</div>
                                {explanation.opening_line && (
                                    <div className="mt-2">
                                        <b>Opening line:</b> &quot;{explanation.opening_line}&quot;
                                    </div>
                                )}
                                <div className="text-muted custom-font-xsmall mt-1">
                                    {explanation.source === 'bedrock'
                                        ? 'Written by Claude (Amazon Bedrock).'
                                        : 'Template explanation (AI not configured).'}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

/** The outlet's visits, orders and (for managers) suggested orders. */
export default function OutletActivity({ leadId, visits, orders, recommendation }: OutletActivityProps) {
    return (
        <>
            <VisitHistory visits={visits} />
            <OrderHistory leadId={leadId} orders={orders} />
            {recommendation && <SuggestedOrders recommendation={recommendation} />}
        </>
    );
}
