import { router, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { Fragment, useState } from 'react';
import Meter from '@/Components/surface/Meter';
import { useAuth } from '@/hooks/useAuth';
import { assistantError, callAssistant } from '@/lib/assistant';
import { confirm } from '@/lib/dialogs';
import { formatMoney, formatQuantity, pluralize } from '@/lib/format';
import type { PageProps } from '@/types';
import type { Order, PitchTip as PitchTipData, PitchTips, Recommendation, Visit } from '@/types/leads';

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
            <table className="rd-table rd-table--flush lead-activity__table">
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
                                <td className="text-nowrap">
                                    <span className="rd-person__text">
                                        <span className="lead-activity__strong">{date}</span>
                                        {time && <span className="rd-person__sub">{time}</span>}
                                    </span>
                                </td>
                                <td className="text-nowrap">{visit.visited_by ?? '—'}</td>
                                <td>
                                    <div className="lead-activity__stack">
                                        {visit.status && (
                                            <span className="rd-chip align-self-start">{visit.status}</span>
                                        )}
                                        <span>{visit.summary}</span>
                                    </div>
                                </td>
                                <td>
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
                                    <a
                                        href={route('ifereport.view', { id: visit.id })}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rd-btn rd-btn--icon"
                                        aria-label={`Open the IFE report from ${date}`}
                                        title="Open the report"
                                    >
                                        <i className="mdi mdi-clipboard-text-outline" aria-hidden="true" />
                                    </a>
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
            <table className="rd-table rd-table--flush lead-activity__table">
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
                            <td className="text-nowrap">
                                <div className="lead-activity__stack">
                                    <span className="rd-mono lead-activity__strong">{order.order_no}</span>
                                    {order.cancelled && <span className="rd-chip align-self-start">Cancelled</span>}
                                </div>
                            </td>
                            <td className="text-nowrap">{order.order_date}</td>
                            <td>
                                <div className="lead-activity__stack lead-activity__stack--tight">
                                    {order.lines.map((line, index) => (
                                        <span key={index}>
                                            {formatQuantity(line.quantity)} {line.unit} &times; {line.product}
                                        </span>
                                    ))}
                                    {order.remark && <span className="lead-activity__note">{order.remark}</span>}
                                </div>
                            </td>
                            <td className="num lead-activity__strong">{formatMoney(order.total_amount)}</td>
                            <td className="text-nowrap">{order.recorded_by ?? '—'}</td>
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

/**
 * The products similar outlets buy and this one does not (or too little of),
 * each with "How to pitch" tips written the first time a row is opened.
 */
export function SuggestedOrders({ recommendation, leadId }: { recommendation: Recommendation; leadId: number }) {
    const { currency } = usePage<PageProps>().props.app;
    const items = recommendation.items ?? [];
    const explanation = recommendation.explanation;
    const [open, setOpen] = useState<string | null>(null);
    const [tips, setTips] = useState<PitchTips | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // One call writes the tips for every product; they are cached server-side.
    const toggle = async (sku: string) => {
        const opening = open !== sku;
        setOpen(opening ? sku : null);
        if (!opening || tips || loading) return;

        setLoading(true);
        setError(null);
        try {
            setTips(await callAssistant<PitchTips>('pitches', leadId));
        } catch (caught) {
            setError(assistantError(caught, 'The tips could not be written. Close and open the row to try again.'));
        } finally {
            setLoading(false);
        }
    };

    if (recommendation.status !== 'ready') {
        return (
            <p className="lead-activity__empty">
                Not enough to go on yet. Order history and outlet details from similar outlets help the suggestions.
            </p>
        );
    }

    const gaps = recommendation.gap_count ?? 0;
    const topUps = items.filter((item) => item.status === 'top_up').length;

    return (
        <div className="lead-activity__suggested">
            <p className="lead-activity__lede">
                Based on the <strong>{pluralize(recommendation.similar_outlets ?? 0, 'most similar outlet')}</strong>:{' '}
                {pluralize(gaps, 'product')} not ordered yet{topUps > 0 && ` and ${topUps} to top up`}, worth about{' '}
                <strong>
                    {currency} {formatMoney(recommendation.estimated_monthly_value)}
                </strong>{' '}
                more a month.
            </p>
            <div className="rd-scroll">
                <table className="rd-table rd-table--flush lead-activity__table">
                    <thead>
                        <tr>
                            <th scope="col">Product</th>
                            <th scope="col">
                                <span className="visually-hidden">Kind</span>
                            </th>
                            <th scope="col">Similar outlets buying</th>
                            <th scope="col" className="num">
                                Suggested / mo
                            </th>
                            <th scope="col" className="num">
                                Now / mo
                            </th>
                            <th scope="col" className="num">
                                Value / mo ({currency})
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <Fragment key={item.sku}>
                                <tr className={clsx(open === item.sku && 'is-open')}>
                                    <td>
                                        <span className="rd-person__text">
                                            <span className="lead-activity__strong">{item.name}</span>
                                            <span className="lead-pitch__line">
                                                <span className="rd-person__sub rd-mono">{item.sku}</span>
                                                <button
                                                    type="button"
                                                    className="lead-pitch__toggle"
                                                    aria-expanded={open === item.sku}
                                                    aria-controls={`pitch-${item.sku}`}
                                                    onClick={() => toggle(item.sku)}
                                                >
                                                    How to pitch
                                                    <i
                                                        className={`mdi mdi-chevron-${open === item.sku ? 'up' : 'down'}`}
                                                        aria-hidden="true"
                                                    />
                                                </button>
                                            </span>
                                        </span>
                                    </td>
                                    <td>
                                        <span
                                            className={
                                                item.status === 'gap'
                                                    ? 'rd-chip rd-chip--good'
                                                    : 'rd-chip rd-chip--serious'
                                            }
                                        >
                                            {item.status === 'gap' ? 'Not ordered' : 'Top up'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="lead-activity__support">
                                            <Meter value={item.support} max={1} thin />
                                            <span className="text-nowrap">
                                                {item.buyers} of {item.neighbors_used}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="num">
                                        {item.recommended_qty} {item.unit}
                                    </td>
                                    <td className="num">
                                        {item.current_qty} {item.unit}
                                    </td>
                                    <td className="num lead-activity__strong">{formatMoney(item.est_monthly_value)}</td>
                                </tr>
                                {open === item.sku && (
                                    <tr className="lead-pitch__row">
                                        <td colSpan={6} id={`pitch-${item.sku}`}>
                                            <PitchTip
                                                tip={tips?.pitches[item.sku]}
                                                source={tips?.source ?? null}
                                                loading={loading}
                                                error={error}
                                            />
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            {explanation?.why && (
                <div className="lead-activity__why">
                    <strong>Why these?</strong>
                    <span>{explanation.why}</span>
                    {explanation.opening_line && (
                        <span>
                            <strong>Opening line:</strong> “{explanation.opening_line}”
                        </span>
                    )}
                    <span className="lead-activity__note">
                        {explanation.source === 'bedrock'
                            ? 'Written by Claude (Amazon Bedrock).'
                            : 'Template explanation (AI not configured).'}
                    </span>
                </div>
            )}
        </div>
    );
}

/** The opened "How to pitch" row: a pitch, a likely objection and a reply. */
function PitchTip({
    tip,
    source,
    loading,
    error,
}: {
    tip: PitchTipData | undefined;
    source: PitchTips['source'];
    loading: boolean;
    error: string | null;
}) {
    if (loading) {
        return (
            <div className="lead-pitch" role="status">
                <span className="lead-activity__note">Writing tips from similar outlets and the product details…</span>
            </div>
        );
    }

    if (error || !tip) {
        return (
            <div className="lead-pitch">
                <span className="lead-activity__note">{error ?? 'No tips for this product yet.'}</span>
            </div>
        );
    }

    return (
        <div className="lead-pitch">
            <dl className="lead-pitch__parts">
                <div>
                    <dt>Pitch</dt>
                    <dd>{tip.pitch}</dd>
                </div>
                {tip.objection && (
                    <div>
                        <dt>If they say</dt>
                        <dd>“{tip.objection}”</dd>
                    </div>
                )}
                {tip.reply && (
                    <div>
                        <dt>You can say</dt>
                        <dd>“{tip.reply}”</dd>
                    </div>
                )}
            </dl>
            <span className="lead-activity__note">
                {source === 'bedrock'
                    ? 'Written by Claude (Amazon Bedrock) from the product description and what similar outlets buy.'
                    : 'From what similar outlets buy and the product description (AI not configured).'}{' '}
                Check prices and stock before you promise anything.
            </span>
        </div>
    );
}
