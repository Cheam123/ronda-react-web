import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { formatNumber } from '@/lib/format';
import type { DashboardSummary } from '../types';
import ChangeChip from '@/Components/surface/ChangeChip';

const FORM_STATUSES = [
    { key: 'approved', label: 'approved', color: '#067647' },
    { key: 'pending', label: 'pending', color: '#D9A23A' },
    { key: 'rejected', label: 'rejected', color: '#B42318' },
] as const;

interface FieldOutputProps {
    summary: DashboardSummary;
    currency: string;
    className?: string;
}

/** Visits, form submissions and orders over the last 7 days and this month. */
export default function FieldOutput({ summary, currency, className }: FieldOutputProps) {
    const { can } = useAuth();
    const { visits, forms, orders } = summary;
    const busiestDay = Math.max(1, ...visits.daily.map((day) => day.count));
    const reviewHref = can('form_admin') ? route('form.records.all', { status: 'pending' }) : route('form.tasks');

    return (
        <section className={clsx('rd-panel', className)} aria-labelledby="output-title">
            <div className="rd-panel__head">
                <h2 id="output-title" className="rd-panel__title">
                    Field output
                </h2>
                <span className="rd-panel__sub">Last 7 days</span>
            </div>

            <div className="dash-output">
                <div className="dash-output__row">
                    <div>
                        <div className="dash-output__label">Visits (IFE reports)</div>
                        <div className="dash-output__value">{visits.last_7d}</div>
                        <div className="dash-output__note">{visits.today} so far today</div>
                    </div>
                    <div className="dash-minibars" aria-hidden="true">
                        {visits.daily.map((day, index) => (
                            <span
                                key={day.date}
                                title={`${day.label}: ${day.count}`}
                                className={clsx({
                                    'is-zero': day.count === 0,
                                    'is-today': day.count > 0 && index === visits.daily.length - 1,
                                })}
                                style={{ height: `${Math.max(4, (day.count / busiestDay) * 100)}%` }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="dash-output">
                <div className="dash-output__row">
                    <div>
                        <div className="dash-output__label">Forms submitted</div>
                        <div className="dash-output__value">{forms.submitted_7d}</div>
                    </div>
                    {forms.pending > 0 && (
                        <Link href={reviewHref} className="fw-semibold text-decoration-none">
                            Review {forms.pending} pending
                        </Link>
                    )}
                </div>
                {forms.submitted_7d > 0 && (
                    <>
                        <div className="rd-stack" aria-hidden="true">
                            {FORM_STATUSES.filter((status) => forms[status.key] > 0).map((status) => (
                                <span
                                    key={status.key}
                                    style={{ flexGrow: forms[status.key], background: status.color }}
                                />
                            ))}
                        </div>
                        <div className="rd-legend">
                            {FORM_STATUSES.map((status) => (
                                <span key={status.key}>
                                    <span className="rd-swatch" style={{ background: status.color }} />
                                    {forms[status.key]} {status.label}
                                </span>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div className="dash-output">
                <div className="dash-output__row">
                    <div>
                        <div className="dash-output__label">Orders this month</div>
                        <div className="dash-output__value">
                            {currency} {formatNumber(orders.month_value)}
                        </div>
                        <div className="dash-output__note">
                            {orders.month_count} orders &middot; {currency} {formatNumber(orders.last_7d)} in the last 7
                            days
                        </div>
                    </div>
                    <ChangeChip percent={orders.change_pct} />
                </div>
            </div>
        </section>
    );
}
