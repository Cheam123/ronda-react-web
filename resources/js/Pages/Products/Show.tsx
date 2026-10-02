import { Link, router, usePage } from '@inertiajs/react';
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import { BAR_STYLE, barOptions, CHART } from '@/lib/chartTheme';
import { compactNumber, formatMoney, formatNumber, formatQuantity, pluralize } from '@/lib/format';
import ChangeChip from '@/Components/surface/ChangeChip';
import type { PageProps } from '@/types';
import type { Product } from '@/types/catalogue';
import RetireDialog from './Partials/RetireDialog';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface ProductPageData extends Product {
    id: number;
    sku: string;
    name: string;
    unit: string;
    unit_price: number;
    order_lines_count: number;
    created_label: string | null;
    updated_label: string | null;
}

interface MonthSales {
    month: string;
    label: string;
    quantity: number;
    value: number;
}

interface OrderLineRow {
    id: number;
    order_no: string;
    lead_id: number;
    outlet: string | null;
    recorded_by: string | null;
    date_label: string;
    quantity: number;
    line_total: number;
}

interface Recommendation {
    lead_id: number;
    outlet: string;
    prospect: boolean;
    status: 'gap' | 'top_up';
    buyers: number;
    neighbors_used: number;
    quantity: number;
    value: number;
}

interface ProductShowProps {
    product: ProductPageData;
    stats: {
        sold_qty: number;
        sold_value: number;
        previous_value: number;
        change_pct: number | null;
        category_share: number | null;
        outlets: number;
        customers: number;
        stale: boolean;
    };
    monthly: MonthSales[];
    lines: OrderLineRow[];
    recommended: Recommendation[];
    recommendedCount: number;
}

/** One product: how it sells, who orders it, and where the recommender suggests it. */
export default function ProductShow({
    product,
    stats,
    monthly,
    lines,
    recommended,
    recommendedCount,
}: ProductShowProps) {
    const { currency } = usePage<PageProps>().props.app;
    const [retiring, setRetiring] = useState(false);
    const neverOrdered = product.order_lines_count === 0;
    const lastMonth = monthly.length - 1;

    const options = useMemo(
        () =>
            barOptions({
                format: (value) => `${currency} ${formatMoney(value)}`,
                formatTick: (value) => compactNumber(value),
                titles: monthly.map((month, index) => {
                    const title = new Date(`${month.month}-01T00:00:00`).toLocaleDateString(undefined, {
                        month: 'long',
                        year: 'numeric',
                    });
                    return `${title}${index === lastMonth ? ' (so far)' : ''} · ${formatQuantity(month.quantity)} ${product.unit}`;
                }),
            }),
        [currency, monthly, lastMonth, product.unit],
    );

    const chartData = {
        labels: monthly.map((month) => month.label),
        datasets: [
            {
                label: 'Sales',
                data: monthly.map((month) => month.value),
                backgroundColor: monthly.map((_, index) => (index === lastMonth ? CHART.brand : CHART.brandPast)),
                ...BAR_STYLE,
                maxBarThickness: 56,
            },
        ],
    };

    const reactivate = () => router.post(route('product.activate', product.id), {}, { preserveScroll: true });

    return (
        <AppLayout title={product.name}>
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Admin' },
                        { label: 'Products', href: route('product.index') },
                        { label: product.name },
                    ]}
                    title={product.name}
                    meta={
                        <>
                            <span className="rd-chip rd-chip--outline rd-mono">{product.sku}</span>
                            {product.category && <span className="rd-chip rd-chip--brand">{product.category}</span>}
                            {product.is_active ? (
                                <span className="rd-chip rd-chip--good">
                                    <span className="rd-dot" />
                                    Active
                                </span>
                            ) : (
                                <span className="rd-chip">
                                    <span className="rd-dot rd-dot--hollow" />
                                    Inactive
                                </span>
                            )}
                            <span>
                                {currency} {formatMoney(product.unit_price)} per {product.unit}
                            </span>
                        </>
                    }
                    actions={
                        <>
                            {!product.is_active && (
                                <button type="button" className="rd-btn rd-btn--lg" onClick={reactivate}>
                                    <i className="mdi mdi-restore" aria-hidden="true" />
                                    Reactivate
                                </button>
                            )}
                            {(product.is_active || neverOrdered) && (
                                <button type="button" className="rd-btn rd-btn--lg" onClick={() => setRetiring(true)}>
                                    <i
                                        className={`mdi ${neverOrdered ? 'mdi-delete-outline' : 'mdi-archive-outline'}`}
                                        aria-hidden="true"
                                    />
                                    {neverOrdered ? 'Delete' : 'Deactivate'}
                                </button>
                            )}
                            <Link
                                href={route('product.edit', product.id)}
                                className="rd-btn rd-btn--primary rd-btn--lg"
                            >
                                <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                                Edit product
                            </Link>
                        </>
                    }
                />

                {stats.stale && (
                    <p className="rd-notice">
                        <i className="mdi mdi-alert" aria-hidden="true" />
                        No outlet has ordered this in 90 days, but it is still offered to reps and recommended. Check
                        the price, or deactivate it.
                    </p>
                )}

                <div className="rd-grid">
                    <div className="rd-span-8 d-flex flex-column gap-4">
                        <section className="rd-panel rd-panel--flush prod-figures" aria-label="Last 30 days">
                            <div>
                                <span className="prod-figures__label">Sold, last 30 days</span>
                                <span className="prod-figures__value">
                                    {currency} {formatNumber(stats.sold_value)}
                                </span>
                                <span className="prod-figures__note d-flex align-items-center gap-2">
                                    {stats.change_pct !== null ? (
                                        <>
                                            <ChangeChip percent={stats.change_pct} /> vs the 30 days before
                                        </>
                                    ) : (
                                        'Nothing sold in the 30 days before'
                                    )}
                                </span>
                            </div>
                            <div>
                                <span className="prod-figures__label">Quantity</span>
                                <span className="prod-figures__value">
                                    {formatQuantity(stats.sold_qty)} <span className="rd-kpi__of">{product.unit}</span>
                                </span>
                                <span className="prod-figures__note">
                                    {stats.category_share !== null
                                        ? `${stats.category_share}% of ${product.category} sales`
                                        : 'Last 30 days'}
                                </span>
                            </div>
                            <div>
                                <span className="prod-figures__label">Outlets buying</span>
                                <span className="prod-figures__value">
                                    {stats.outlets} <span className="rd-kpi__of">of {stats.customers}</span>
                                </span>
                                <span className="prod-figures__note">customers ordered it in 30 days</span>
                            </div>
                            <div>
                                <span className="prod-figures__label">Order lines</span>
                                <span className="prod-figures__value">{product.order_lines_count}</span>
                                <span className="prod-figures__note">
                                    {neverOrdered
                                        ? 'never ordered, so it can be deleted'
                                        : "all time · can't be deleted"}
                                </span>
                            </div>
                        </section>

                        <section className="rd-panel" aria-labelledby="monthly-title">
                            <div className="rd-panel__head">
                                <div>
                                    <h2 id="monthly-title" className="rd-panel__title">
                                        Monthly sales
                                    </h2>
                                    <p className="rd-panel__sub">
                                        Confirmed order value in {currency}, {monthly[0]?.label} to{' '}
                                        {monthly[lastMonth]?.label}
                                    </p>
                                </div>
                            </div>
                            <div className="rd-chart">
                                <Bar
                                    data={chartData}
                                    options={options}
                                    aria-label="Sales per month, last six months"
                                    role="img"
                                />
                            </div>
                            <details className="rd-chart-table">
                                <summary>Show as table</summary>
                                <table className="rd-table mt-2">
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th className="num">Quantity ({product.unit})</th>
                                            <th className="num">Sales ({currency})</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {monthly.map((month) => (
                                            <tr key={month.month}>
                                                <td>{month.label}</td>
                                                <td className="num">{formatQuantity(month.quantity)}</td>
                                                <td className="num">{formatMoney(month.value)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </details>
                        </section>

                        <section className="rd-panel" aria-labelledby="lines-title">
                            <div className="rd-panel__head">
                                <h2 id="lines-title" className="rd-panel__title">
                                    Recent order lines
                                </h2>
                                <span className="rd-panel__sub">Confirmed orders, newest first</span>
                            </div>
                            {lines.length === 0 ? (
                                <p className="rd-muted">Nobody has ordered this yet.</p>
                            ) : (
                                <div className="rd-scroll">
                                    <table className="rd-table">
                                        <thead>
                                            <tr>
                                                <th scope="col">Order</th>
                                                <th scope="col">Outlet</th>
                                                <th scope="col">Recorded by</th>
                                                <th scope="col">Date</th>
                                                <th scope="col" className="num">
                                                    Qty
                                                </th>
                                                <th scope="col" className="num">
                                                    Line total ({currency})
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lines.map((line) => (
                                                <tr key={line.id}>
                                                    <td className="rd-mono">{line.order_no}</td>
                                                    <td>
                                                        <Link
                                                            href={route('lead.view', line.lead_id)}
                                                            className="fw-medium"
                                                        >
                                                            {line.outlet ?? 'Unknown outlet'}
                                                        </Link>
                                                    </td>
                                                    <td className="rd-muted">{line.recorded_by}</td>
                                                    <td className="rd-muted text-nowrap">{line.date_label}</td>
                                                    <td className="num">
                                                        {formatQuantity(line.quantity)} {product.unit}
                                                    </td>
                                                    <td className="num fw-semibold">{formatMoney(line.line_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </div>

                    <aside className="rd-span-4 d-flex flex-column gap-4">
                        <section className="rd-panel" aria-labelledby="details-title">
                            <h2 id="details-title" className="rd-panel__title">
                                Details
                            </h2>
                            <dl className="prod-details">
                                <dt>SKU</dt>
                                <dd className="rd-mono">{product.sku}</dd>
                                <dt>Category</dt>
                                <dd>{product.category ?? <span className="rd-muted">None</span>}</dd>
                                <dt>Unit</dt>
                                <dd>{product.unit}</dd>
                                <dt>Unit price</dt>
                                <dd className="rd-num">
                                    {currency} {formatMoney(product.unit_price)}
                                </dd>
                                {product.created_label && (
                                    <>
                                        <dt>Added</dt>
                                        <dd>{product.created_label}</dd>
                                    </>
                                )}
                                {product.updated_label && (
                                    <>
                                        <dt>Last edited</dt>
                                        <dd>{product.updated_label}</dd>
                                    </>
                                )}
                            </dl>
                            <div className="prod-description">
                                <span className="prod-description__label">Description</span>
                                {product.description ? (
                                    <p>{product.description}</p>
                                ) : (
                                    <p className="rd-muted">
                                        No description yet.{' '}
                                        <Link href={route('product.edit', product.id)}>Add one</Link> so reps can pitch
                                        it.
                                    </p>
                                )}
                            </div>
                        </section>

                        <section className="rd-panel" aria-labelledby="availability-title">
                            <div className="rd-panel__head">
                                <h2 id="availability-title" className="rd-panel__title">
                                    Availability
                                </h2>
                                <span className={`rd-status ${product.is_active ? 'rd-status--good' : 'rd-muted'}`}>
                                    <i
                                        className={`mdi ${product.is_active ? 'mdi-check' : 'mdi-minus'}`}
                                        aria-hidden="true"
                                    />
                                    {product.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <ul className="rd-checks">
                                <li>
                                    <i
                                        className={`mdi ${product.is_active ? 'mdi-check is-good' : 'mdi-close is-bad'}`}
                                        aria-hidden="true"
                                    />
                                    {product.is_active ? 'On' : 'Not on'} the order form in the mobile app
                                </li>
                                <li>
                                    <i
                                        className={`mdi ${product.is_active ? 'mdi-check is-good' : 'mdi-close is-bad'}`}
                                        aria-hidden="true"
                                    />
                                    {product.is_active ? 'Included in' : 'Left out of'} outlet recommendations
                                </li>
                            </ul>
                        </section>

                        <section className="rd-panel" aria-labelledby="recommended-title">
                            <div>
                                <h2 id="recommended-title" className="rd-panel__title">
                                    Recommended to
                                </h2>
                                <p className="rd-panel__sub">
                                    Outlets that don&apos;t buy it yet, or buy too little, while similar outlets do.
                                </p>
                            </div>
                            {recommended.length === 0 ? (
                                <p className="rd-muted">Not recommended to any outlet right now.</p>
                            ) : (
                                <ul className="rd-rows prod-recommended">
                                    {recommended.map((item) => (
                                        <li key={item.lead_id}>
                                            <span className="prod-recommended__outlet">
                                                <Link href={route('lead.view', item.lead_id)}>{item.outlet}</Link>
                                                <small>
                                                    {item.prospect ? 'Prospect' : 'Customer'} &middot;{' '}
                                                    {item.status === 'top_up' ? 'buys too little' : 'not buying it'}{' '}
                                                    &middot; {item.buyers} of {item.neighbors_used} similar outlets buy
                                                    it
                                                </small>
                                            </span>
                                            <span className="rd-num fw-semibold text-nowrap">
                                                {currency} {formatNumber(item.value)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {recommended.length > 0 && (
                                <span className="rd-panel__sub">
                                    {recommendedCount > recommended.length &&
                                        `Top ${recommended.length} of ${pluralize(recommendedCount, 'outlet')}. `}
                                    Estimated extra spend per month if they order like their neighbours.
                                </span>
                            )}
                        </section>
                    </aside>
                </div>

                <RetireDialog
                    product={retiring ? product : null}
                    recommendedCount={recommendedCount}
                    onClose={() => setRetiring(false)}
                />
            </SurfacePage>
        </AppLayout>
    );
}
