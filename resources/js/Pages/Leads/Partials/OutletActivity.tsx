import { Link, router, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { confirm } from '@/lib/dialogs';
import { formatMoney, formatQuantity } from '@/lib/format';
import type { PageProps } from '@/types';
import type { Order, Visit } from '@/types/leads';

/** IFE reports filed at the outlet (newest first). */
export function VisitHistory({ visits }: { visits: Visit[] }) {
    if (visits.length === 0) {
        return (
            <p className="lead-activity__empty">
                No visits recorded at this outlet yet. Visits filed from the app show up here.
            </p>
        );
    }

    return (
        <div className="rd-scroll">
            <table className="rd-table rd-table--flush rd-table--stack lead-activity__table">
                <thead>
                    <tr>
                        <th scope="col">Visited</th>
                        <th scope="col">By</th>
                        <th scope="col">What happened</th>
                        <th scope="col">Next follow-up</th>
                        <th scope="col" className="rd-col-actions">
                            <span className="visually-hidden">Report</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {visits.map((visit) => {
                        const [date, time] = visit.visited_at.split(', ');

                        return (
                            <tr key={visit.id} className="lead-activity__top">
                                <td className="rd-cell-main text-nowrap">
                                    <span className="rd-person__text">
                                        <span className="lead-activity__strong">{date}</span>
                                        {time && <span className="rd-person__sub">{time}</span>}
                                    </span>
                                </td>
                                <td data-label="By" className="text-nowrap">
                                    {visit.visited_by ?? '—'}
                                </td>
                                <td data-label="What happened">
                                    <div className="lead-activity__stack">
                                        {visit.status && (
                                            <span className="rd-chip align-self-start">{visit.status}</span>
                                        )}
                                        <span>{visit.summary}</span>
                                    </div>
                                </td>
                                <td
                                    data-label="Next follow-up"
                                    className={visit.followup_date ? undefined : 'is-empty'}
                                >
                                    {visit.followup_date ? (
                                        <span className="rd-person__text">
                                            <span className="lead-activity__strong">{visit.followup_date}</span>
                                            {visit.followup_plan && (
                                                <span className="lead-activity__note">{visit.followup_plan}</span>
                                            )}
                                        </span>
                                    ) : (
                                        <span className="rd-muted">—</span>
                                    )}
                                </td>
                                <td className="rd-col-actions">
                                    <Link
                                        href={route('ifereport.view', { id: visit.id })}
                                        className="rd-btn rd-btn--icon"
                                        aria-label={`Open the visit report from ${date}`}
                                        title="Open the report"
                                    >
                                        <i className="mdi mdi-clipboard-text-outline" aria-hidden="true" />
                                    </Link>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/** Orders recorded for the outlet; a manager can cancel one. */
export function OrderHistory({ orders }: { orders: Order[] }) {
    const { can } = useAuth();
    const { currency } = usePage<PageProps>().props.app;

    const cancel = async (order: Order) => {
        const confirmed = await confirm({
            title: `Cancel ${order.order_no}?`,
            text: 'It stays on the history but stops counting as a purchase.',
            confirmText: 'Cancel order',
            cancelText: 'Keep it',
            danger: true,
        });
        if (confirmed) {
            router.post(route('lead.orders.cancel', order.id), {}, { preserveScroll: true });
        }
    };

    if (orders.length === 0) {
        return <p className="lead-activity__empty">No orders recorded for this outlet yet.</p>;
    }

    return (
        <div className="rd-scroll">
            <table className="rd-table rd-table--flush rd-table--stack lead-activity__table">
                <thead>
                    <tr>
                        <th scope="col">Order</th>
                        <th scope="col">Date</th>
                        <th scope="col">Products</th>
                        <th scope="col" className="num">
                            Total ({currency})
                        </th>
                        <th scope="col">Recorded by</th>
                        <th scope="col" className="rd-col-actions">
                            <span className="visually-hidden">Cancel</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map((order) => (
                        <tr key={order.id} className={clsx('lead-activity__top', order.cancelled && 'is-inactive')}>
                            <td className="rd-cell-main text-nowrap">
                                <div className="lead-activity__stack">
                                    <span className="rd-mono lead-activity__strong">{order.order_no}</span>
                                    {order.cancelled && <span className="rd-chip align-self-start">Cancelled</span>}
                                </div>
                            </td>
                            <td data-label="Date" className="text-nowrap">
                                {order.order_date}
                            </td>
                            <td data-label="Products">
                                <div className="lead-activity__stack lead-activity__stack--tight">
                                    {order.lines.map((line, index) => (
                                        <span key={index}>
                                            {formatQuantity(line.quantity)} {line.unit} &times; {line.product}
                                        </span>
                                    ))}
                                    {order.remark && <span className="lead-activity__note">{order.remark}</span>}
                                </div>
                            </td>
                            <td data-label={`Total (${currency})`} className="num lead-activity__strong">
                                {formatMoney(order.total_amount)}
                            </td>
                            <td data-label="Recorded by" className="text-nowrap">
                                {order.recorded_by ?? '—'}
                            </td>
                            <td className="rd-col-actions">
                                {can('manage_order') && !order.cancelled && (
                                    <button
                                        type="button"
                                        className="rd-btn rd-btn--sm rd-btn--danger-soft"
                                        onClick={() => cancel(order)}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
