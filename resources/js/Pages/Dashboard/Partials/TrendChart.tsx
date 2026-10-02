import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import clsx from 'clsx';
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { BAR_STYLE, barOptions, CHART } from '@/lib/chartTheme';
import type { TrendDay } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

function shortDate(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

interface TrendChartProps {
    trend: TrendDay[];
    createdWeek: number;
    doneWeek: number;
    className?: string;
}

/** Tasks created vs. done per day, with a table for screen readers. */
export default function TrendChart({ trend, createdWeek, doneWeek, className }: TrendChartProps) {
    const options = useMemo(() => barOptions({ titles: trend.map((day) => day.label) }), [trend]);

    const data = {
        labels: trend.map((day) => shortDate(day.date)),
        datasets: [
            { label: 'Created', data: trend.map((day) => day.created), backgroundColor: CHART.ochre, ...BAR_STYLE },
            { label: 'Done', data: trend.map((day) => day.done), backgroundColor: CHART.brand, ...BAR_STYLE },
        ],
    };

    return (
        <section className={clsx('rd-panel', className)} aria-labelledby="trend-title">
            <div className="rd-panel__head">
                <div>
                    <h2 id="trend-title" className="rd-panel__title">
                        Tasks created vs. done
                    </h2>
                    <p className="rd-panel__sub">
                        Last 14 days &middot; {createdWeek} created and {doneWeek} done in the last 7
                    </p>
                </div>
                <div className="rd-legend">
                    <span>
                        <span className="rd-swatch" style={{ background: CHART.ochre }} />
                        Created
                    </span>
                    <span>
                        <span className="rd-swatch" style={{ background: CHART.brand }} />
                        Done
                    </span>
                </div>
            </div>

            <div className="rd-chart">
                <Bar
                    data={data}
                    options={options}
                    aria-label="Tasks created and done per day, last 14 days"
                    role="img"
                />
            </div>

            <details className="rd-chart-table">
                <summary>Show as table</summary>
                <table className="rd-table mt-2">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th className="num">Created</th>
                            <th className="num">Done</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trend.map((day) => (
                            <tr key={day.date}>
                                <td>{day.label}</td>
                                <td className="num">{day.created}</td>
                                <td className="num">{day.done}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </section>
    );
}
