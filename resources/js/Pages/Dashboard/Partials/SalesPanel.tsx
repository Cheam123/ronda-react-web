import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import clsx from 'clsx';
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import Meter from '@/Components/surface/Meter';
import { BAR_STYLE, barOptions, CHART } from '@/lib/chartTheme';
import { compactNumber, formatMoney, formatNumber } from '@/lib/format';
import type { AdminSummary } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface SalesPanelProps {
    sales: AdminSummary['sales'];
    currency: string;
    className?: string;
}

/** Confirmed order value per day this month, and its split by product category. */
export default function SalesPanel({ sales, currency, className }: SalesPanelProps) {
    const { daily, categories } = sales;
    const lastIndex = daily.length - 1;
    const biggestCategory = Math.max(0, ...categories.map((category) => category.value));
    const categoryTotal = categories.reduce((sum, category) => sum + category.value, 0);

    const options = useMemo(
        () =>
            barOptions({
                format: (value) => `${currency} ${formatMoney(value)}`,
                formatTick: (value) => compactNumber(value),
                titles: daily.map((day, index) => (index === lastIndex ? `${day.label} (so far)` : day.label)),
                keepLabels: true,
            }),
        [currency, daily, lastIndex],
    );

    const data = {
        // Label every 7th day and today; the tooltip names each bar in full.
        labels: daily.map((day, index) => (index === lastIndex ? 'Today' : index % 7 === 0 ? day.day : '')),
        datasets: [
            {
                label: 'Sales',
                data: daily.map((day) => day.value),
                backgroundColor: daily.map((_, index) => (index === lastIndex ? CHART.brandToday : CHART.brand)),
                ...BAR_STYLE,
                maxBarThickness: 22,
            },
        ],
    };

    return (
        <section className={clsx('rd-panel', className)} aria-labelledby="sales-title">
            <div className="rd-panel__head">
                <div>
                    <h2 id="sales-title" className="rd-panel__title">
                        Sales in {sales.month_label}
                    </h2>
                    <p className="rd-panel__sub">
                        Confirmed order value per day, in {currency}. Hover a bar for the day&apos;s total.
                    </p>
                </div>
            </div>

            <div className="rd-chart">
                <Bar data={data} options={options} aria-label={`Sales per day in ${sales.month_label}`} role="img" />
            </div>

            <details className="rd-chart-table">
                <summary>Show as table</summary>
                <table className="rd-table mt-2">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th className="num">Sales ({currency})</th>
                        </tr>
                    </thead>
                    <tbody>
                        {daily.map((day) => (
                            <tr key={day.date}>
                                <td>{day.label}</td>
                                <td className="num">{formatMoney(day.value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>

            <div className="dash-subsection">
                <div className="dash-subsection__head">
                    <h3 className="dash-subsection__title">By product category</h3>
                    <span className="rd-muted">
                        Share of {currency} {formatNumber(categoryTotal)}
                    </span>
                </div>
                {categories.length === 0 ? (
                    <p className="rd-muted">No confirmed orders this month yet.</p>
                ) : (
                    <ul className="dash-bars">
                        {categories.map((category) => (
                            <li key={category.name}>
                                <span className="fw-medium">{category.name}</span>
                                <Meter value={category.value} max={biggestCategory} />
                                <span className="num">
                                    {currency} {formatNumber(category.value)}
                                </span>
                                <span className="num rd-muted">
                                    {categoryTotal > 0 ? Math.round((category.value / categoryTotal) * 100) : 0}%
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
