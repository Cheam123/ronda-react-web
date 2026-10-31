import { Link } from '@inertiajs/react';
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import Meter from '@/Components/surface/Meter';
import TabList from '@/Components/surface/TabList';
import { useAuth } from '@/hooks/useAuth';
import { BAR_STYLE, barOptions, chartColors } from '@/lib/chartTheme';
import { compactNumber, formatMoney, formatNumber, formatQuantity } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { AdminSummary } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type SalesView = 'day' | 'category' | 'products';

interface SalesPanelProps {
    sales: AdminSummary['sales'];
    currency: string;
    className?: string;
}

/** Confirmed orders this month, three ways: per day, by product category, and the best sellers. */
export default function SalesPanel({ sales, currency, className }: SalesPanelProps) {
    const [view, setView] = useState<SalesView>('day');
    const categoryTotal = sales.categories.reduce((sum, category) => sum + category.value, 0);

    const sub: Record<SalesView, string> = {
        day: `Confirmed order value per day, in ${currency}. Hover a bar for the day’s total.`,
        category: `Confirmed order value by product category, of ${currency} ${formatNumber(categoryTotal)} in all.`,
        products: 'The five best sellers this month, by value.',
    };

    return (
        <section className={clsx('rd-panel', className)} aria-labelledby="sales-title">
            <div className="rd-panel__head">
                <div>
                    <h2 id="sales-title" className="rd-panel__title">
                        Sales in {sales.month_label}
                    </h2>
                    <p className="rd-panel__sub">{sub[view]}</p>
                </div>
            </div>

            <TabList
                id="sales"
                label="Show sales"
                tabs={[
                    { key: 'day', label: 'By day' },
                    { key: 'category', label: 'By category' },
                    { key: 'products', label: 'Top products' },
                ]}
                value={view}
                onChange={setView}
            />
            <div role="tabpanel" id="sales-panel" aria-labelledby={`sales-tab-${view}`}>
                {view === 'day' && <ByDay sales={sales} currency={currency} />}
                {view === 'category' && <ByCategory sales={sales} currency={currency} total={categoryTotal} />}
                {view === 'products' && <TopProducts sales={sales} currency={currency} />}
            </div>
        </section>
    );
}

function ByDay({ sales, currency }: Omit<SalesPanelProps, 'className'>) {
    const { daily } = sales;
    const colors = chartColors(useTheme().theme);
    const lastIndex = daily.length - 1;

    const options = useMemo(
        () =>
            barOptions({
                colors,
                format: (value) => `${currency} ${formatMoney(value)}`,
                formatTick: (value) => compactNumber(value),
                titles: daily.map((day, index) => (index === lastIndex ? `${day.label} (so far)` : day.label)),
                keepLabels: true,
            }),
        [colors, currency, daily, lastIndex],
    );

    const data = {
        // Label every 7th day and today; the tooltip names each bar in full.
        labels: daily.map((day, index) => (index === lastIndex ? 'Today' : index % 7 === 0 ? day.day : '')),
        datasets: [
            {
                label: 'Sales',
                data: daily.map((day) => day.value),
                backgroundColor: daily.map((_, index) => (index === lastIndex ? colors.brandToday : colors.brand)),
                ...BAR_STYLE,
                maxBarThickness: 22,
            },
        ],
    };

    return (
        <div className="dash-sales">
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
        </div>
    );
}

function ByCategory({ sales, currency, total }: Omit<SalesPanelProps, 'className'> & { total: number }) {
    const { categories } = sales;
    const biggest = Math.max(0, ...categories.map((category) => category.value));

    if (categories.length === 0) return <p className="rd-muted dash-sales">No confirmed orders this month yet.</p>;

    return (
        <ul className="dash-bars dash-sales">
            {categories.map((category) => (
                <li key={category.name}>
                    <span className="fw-medium">{category.name}</span>
                    <Meter value={category.value} max={biggest} />
                    <span className="num">
                        {currency} {formatNumber(category.value)}
                    </span>
                    <span className="num rd-muted">{total > 0 ? Math.round((category.value / total) * 100) : 0}%</span>
                </li>
            ))}
        </ul>
    );
}

function TopProducts({ sales, currency }: Omit<SalesPanelProps, 'className'>) {
    const { can } = useAuth();
    const products = sales.top_products;
    const best = Math.max(0, ...products.map((product) => product.value));

    return (
        <div className="dash-sales">
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
                                    <span className="rd-mono rd-muted">
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
            {can('manage_product') && (
                <Link href={route('product.index')} className="rd-more">
                    Manage products
                    <i className="mdi mdi-arrow-right" aria-hidden="true" />
                </Link>
            )}
        </div>
    );
}
