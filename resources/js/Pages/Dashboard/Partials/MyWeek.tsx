import { useState } from 'react';
import ChangeChip from '@/Components/surface/ChangeChip';
import { formatNumber, pluralize } from '@/lib/format';
import type { DashboardSummary } from '../types';
import { TrendBars, TrendLegend } from './TrendChart';

interface MyWeekProps {
    summary: DashboardSummary;
    currency: string;
}

/** A rep's last 7 days as four figures, with the 14-day chart on request. */
export default function MyWeek({ summary, currency }: MyWeekProps) {
    const [chartShown, setChartShown] = useState(false);
    const { tasks, visits, forms, orders } = summary;

    return (
        <section className="rd-panel dash-week" aria-labelledby="week-title">
            <div className="rd-panel__head">
                <h2 id="week-title" className="rd-panel__title">
                    Your last 7 days
                </h2>
                <span className="rd-panel__sub">Today and the 6 days before</span>
            </div>

            <dl className="dash-week__figures">
                <div>
                    <dt>Tasks done</dt>
                    <dd className="dash-week__value">{tasks.done_7d}</dd>
                    <dd className="dash-week__note">of {tasks.created_7d} created</dd>
                </div>
                <div>
                    <dt>Visit reports</dt>
                    <dd className="dash-week__value">{visits.last_7d}</dd>
                    <dd className="dash-week__note">{visits.today} so far today</dd>
                </div>
                <div>
                    <dt>Forms submitted</dt>
                    <dd className="dash-week__value">{forms.submitted_7d}</dd>
                    <dd className="dash-week__note">
                        {forms.pending > 0 ? `${forms.pending} waiting for a decision` : 'None waiting'}
                    </dd>
                </div>
                <div>
                    <dt>Orders this month</dt>
                    <dd className="dash-week__value">
                        {currency} {formatNumber(orders.month_value)}
                    </dd>
                    <dd className="dash-week__note">{pluralize(orders.month_count, 'order')}</dd>
                    {orders.change_pct !== null && (
                        <dd className="dash-week__note">
                            <ChangeChip percent={orders.change_pct} /> vs last month
                        </dd>
                    )}
                </div>
            </dl>

            <div>
                <button
                    type="button"
                    className="rd-btn rd-btn--sm"
                    aria-expanded={chartShown}
                    aria-controls="week-chart"
                    onClick={() => setChartShown((shown) => !shown)}
                >
                    {chartShown ? 'Hide the chart' : 'Show the 14-day chart'}
                    <i className={`mdi mdi-chevron-${chartShown ? 'up' : 'down'}`} aria-hidden="true" />
                </button>
            </div>
            <div id="week-chart" className="dash-week__chart" hidden={!chartShown}>
                {chartShown && (
                    <>
                        <p className="rd-panel__sub">
                            Tasks created vs. done, last 14 days &middot; {tasks.created_7d} created and {tasks.done_7d}{' '}
                            done in the last 7
                        </p>
                        <TrendLegend />
                        <TrendBars trend={summary.trend} />
                    </>
                )}
            </div>
        </section>
    );
}
