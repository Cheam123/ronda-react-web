import { Link, router, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { Fragment, useState, type FormEvent } from 'react';
import SearchSelect from '@/Components/form/SearchSelect';
import Meter from '@/Components/surface/Meter';
import PageHeader from '@/Components/surface/PageHeader';
import Pager from '@/Components/surface/Pager';
import Segmented from '@/Components/surface/Segmented';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useFilters } from '@/hooks/useFilters';
import AppLayout from '@/Layouts/AppLayout';
import { formatMoney, formatNumber, formatQuantity, pluralize } from '@/lib/format';
import type { PageProps, Paginated, QueryParams } from '@/types';
import type { CategoryCount, ProductRow } from '@/types/catalogue';
import RetireDialog from './Partials/RetireDialog';

/** The category filter value for products without a category (ProductController::NO_CATEGORY). */
const NO_CATEGORY = '__none';

const SORT_OPTIONS = [
    { value: 'category', label: 'Category, then name' },
    { value: 'sold', label: 'Sold, last 30 days' },
    { value: 'price', label: 'Price, highest first' },
    { value: 'recent', label: 'Recently added' },
];

type Status = '1' | '0' | 'all';

interface ProductsIndexProps {
    products: Paginated<ProductRow>;
    categories: CategoryCount[];
    stats: { total: number; active: number; inactive: number; sold_30d: number; stale: number };
    filters: QueryParams;
}

export default function ProductsIndex({ products, categories, stats, filters }: ProductsIndexProps) {
    const { currency } = usePage<PageProps>().props.app;
    const [retiring, setRetiring] = useState<ProductRow | null>(null);
    const { values, set, apply, reset } = useFilters(route('product.index'), {
        search: filters.search ?? '',
        category: filters.category ?? '',
        active: filters.active ?? '1',
        sort: filters.sort ?? 'category',
        stale: filters.stale ?? '',
    });

    const choose = (key: keyof typeof values, value: string) => {
        set(key, value);
        apply({ [key]: value });
    };

    const search = (event: FormEvent) => {
        event.preventDefault();
        apply();
    };

    const reactivate = (product: ProductRow) => {
        router.post(route('product.activate', product.id), {}, { preserveScroll: true });
    };

    const rows = products.data;
    const bestSeller = Math.max(0, ...rows.map((product) => product.sold_value));
    const grouped = filters.sort === 'category' || !filters.sort;
    const categoryTotal = categories.reduce((sum, category) => sum + category.count, 0);
    const filtered = Boolean(filters.search || filters.category || filters.stale);

    // Group headings when sorted by category: products, and what they sold, per category on this page.
    const groupOf = (product: ProductRow) => product.category ?? 'Uncategorised';
    const groupTotals = rows.reduce<Record<string, { count: number; value: number }>>((totals, product) => {
        const group = (totals[groupOf(product)] ??= { count: 0, value: 0 });
        group.count += 1;
        group.value += product.sold_value;
        return totals;
    }, {});

    return (
        <AppLayout title="Products">
            <SurfacePage>
                <PageHeader
                    crumbs={[{ label: 'Admin' }, { label: 'Products' }]}
                    title="Products"
                    lede="The catalogue reps order from and the recommender suggests. A product that is on past orders is deactivated, never deleted, so order history keeps its lines."
                    actions={
                        <Link href={route('product.create')} className="rd-btn rd-btn--primary rd-btn--lg">
                            <i className="mdi mdi-plus" aria-hidden="true" />
                            Add product
                        </Link>
                    }
                />

                <section className="rd-panel rd-panel--flush prod-summary" aria-label="Catalogue summary">
                    <div className="prod-summary__cell">
                        <span className="prod-summary__label">Active products</span>
                        <span className="prod-summary__value">
                            {stats.active} <span className="rd-kpi__of">of {stats.total}</span>
                        </span>
                    </div>
                    <div className="prod-summary__cell">
                        <span className="prod-summary__label">Categories</span>
                        <span className="prod-summary__value">
                            {categories.filter((category) => category.name).length}
                        </span>
                    </div>
                    <div className="prod-summary__cell">
                        <span className="prod-summary__label">Sold in the last 30 days</span>
                        <span className="prod-summary__value">
                            {currency} {formatNumber(stats.sold_30d)}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="prod-summary__cell"
                        aria-pressed={values.stale === '1'}
                        onClick={() => choose('stale', values.stale === '1' ? '' : '1')}
                    >
                        <span
                            className={clsx('prod-summary__label', stats.stale > 0 && 'prod-summary__label--serious')}
                        >
                            {stats.stale > 0 && <i className="mdi mdi-alert" aria-hidden="true" />}
                            Not ordered in 90 days
                        </span>
                        <span className="d-flex align-items-baseline justify-content-between gap-2">
                            <span className="prod-summary__value">{stats.stale}</span>
                            {stats.stale > 0 && (
                                <span className="prod-summary__action">
                                    {values.stale === '1' ? 'Show all' : 'Show them'}
                                </span>
                            )}
                        </span>
                    </button>
                </section>

                <section className="rd-panel rd-panel--flush prod-list" aria-label="Products">
                    <nav className="rd-tabs prod-list__tabs" aria-label="Category">
                        <button
                            type="button"
                            className={clsx('rd-tabs__tab', values.category === '' && 'is-active')}
                            aria-current={values.category === '' ? 'true' : undefined}
                            onClick={() => choose('category', '')}
                        >
                            All <span className="rd-count">{categoryTotal}</span>
                        </button>
                        {categories.map((category) => {
                            const value = category.name ?? NO_CATEGORY;

                            return (
                                <button
                                    key={value}
                                    type="button"
                                    className={clsx('rd-tabs__tab', values.category === value && 'is-active')}
                                    aria-current={values.category === value ? 'true' : undefined}
                                    onClick={() => choose('category', value)}
                                >
                                    {category.name ?? 'Uncategorised'}{' '}
                                    <span className="rd-count">{category.count}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <form className="prod-list__toolbar" role="search" onSubmit={search}>
                        <label className="rd-search">
                            <i className="mdi mdi-magnify" aria-hidden="true" />
                            <input
                                type="search"
                                className="rd-input"
                                aria-label="Search products"
                                placeholder="Search by name or SKU, then press Enter"
                                value={values.search}
                                onChange={(event) => set('search', event.target.value)}
                            />
                        </label>
                        <Segmented<Status>
                            label="Status"
                            value={values.active as Status}
                            onChange={(value) => choose('active', value)}
                            options={[
                                { value: '1', label: `Active ${stats.active}` },
                                { value: '0', label: `Inactive ${stats.inactive}` },
                                { value: 'all', label: `All ${stats.total}` },
                            ]}
                        />
                        {values.stale === '1' && (
                            <button
                                type="button"
                                className="rd-chip rd-chip--serious border-0"
                                onClick={() => choose('stale', '')}
                            >
                                Not ordered in 90 days
                                <i className="mdi mdi-close" aria-hidden="true" />
                                <span className="visually-hidden">Remove this filter</span>
                            </button>
                        )}
                        <div className="prod-list__sort">
                            <label htmlFor="products-sort">Sort by</label>
                            <SearchSelect
                                id="products-sort"
                                compact
                                options={SORT_OPTIONS}
                                clearable={false}
                                searchable={false}
                                value={values.sort}
                                onChange={(value) => choose('sort', value)}
                            />
                        </div>
                    </form>

                    <div className="rd-scroll">
                        <table className="rd-table prod-table">
                            <thead>
                                <tr>
                                    <th scope="col">Product</th>
                                    <th scope="col">Unit</th>
                                    <th scope="col" className="num">
                                        Unit price ({currency})
                                    </th>
                                    <th scope="col">Sold, last 30 days</th>
                                    <th scope="col" className="num">
                                        Outlets
                                    </th>
                                    <th scope="col" className="num">
                                        Order lines
                                    </th>
                                    <th scope="col">Status</th>
                                    <th scope="col" className="num">
                                        <span className="visually-hidden">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((product, index) => {
                                    const group = groupOf(product);
                                    const startsGroup = grouped && (index === 0 || groupOf(rows[index - 1]) !== group);

                                    return (
                                        <Fragment key={product.id}>
                                            {startsGroup && (
                                                <tr className="prod-group">
                                                    <th colSpan={8} scope="colgroup">
                                                        {group}{' '}
                                                        <span>
                                                            &middot; {pluralize(groupTotals[group].count, 'product')}
                                                        </span>
                                                        <span className="prod-table__group-value">
                                                            {currency} {formatNumber(groupTotals[group].value)} in 30
                                                            days
                                                        </span>
                                                    </th>
                                                </tr>
                                            )}
                                            <ProductTableRow
                                                product={product}
                                                bestSeller={bestSeller}
                                                currency={currency}
                                                onRetire={setRetiring}
                                                onReactivate={reactivate}
                                            />
                                        </Fragment>
                                    );
                                })}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="text-center py-5 rd-muted">
                                            No products match.{' '}
                                            {filtered && (
                                                <button
                                                    type="button"
                                                    className="btn btn-link p-0 align-baseline"
                                                    onClick={reset}
                                                >
                                                    Clear the filters
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="prod-list__foot">
                        <span>
                            {products.total > 0
                                ? `Showing ${products.from}–${products.to} of ${pluralize(products.total, 'product')}`
                                : 'No products'}
                        </span>
                        <Pager links={products.links} />
                    </div>
                </section>

                <RetireDialog
                    product={retiring}
                    recommendedCount={retiring?.recommended_count ?? 0}
                    onClose={() => setRetiring(null)}
                />
            </SurfacePage>
        </AppLayout>
    );
}

interface ProductTableRowProps {
    product: ProductRow;
    bestSeller: number;
    currency: string;
    onRetire: (product: ProductRow) => void;
    onReactivate: (product: ProductRow) => void;
}

function ProductTableRow({ product, bestSeller, currency, onRetire, onReactivate }: ProductTableRowProps) {
    const neverOrdered = product.order_lines_count === 0;

    return (
        <tr className={clsx(!product.is_active && 'is-inactive')}>
            <td>
                <div className="prod-table__name">
                    <Link href={route('product.view', product.id)}>{product.name}</Link>
                    <span className="prod-table__sub">
                        <span className="rd-mono" style={{ fontSize: 11 }}>
                            {product.sku}
                        </span>
                        {product.stale && (
                            <span className="prod-stale">
                                <i className="mdi mdi-alert" aria-hidden="true" />
                                No orders in 90 days
                            </span>
                        )}
                    </span>
                </div>
            </td>
            <td>{product.unit}</td>
            <td className="num">{formatMoney(product.unit_price)}</td>
            <td>
                <div className="prod-table__sold">
                    <Meter value={product.sold_value} max={bestSeller} thin />
                    <span className="prod-table__sold-figures">
                        <span className="fw-medium">
                            {product.sold_value > 0 ? `${currency} ${formatNumber(product.sold_value)}` : '—'}
                        </span>
                        <small>
                            {product.sold_qty > 0 ? `${formatQuantity(product.sold_qty)} ${product.unit}` : 'none sold'}
                        </small>
                    </span>
                </div>
            </td>
            <td className="num">{product.outlets}</td>
            <td className="num">{product.order_lines_count}</td>
            <td>
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
            </td>
            <td>
                <div className="prod-table__actions">
                    <Link
                        href={route('product.edit', product.id)}
                        className="rd-btn rd-btn--icon"
                        aria-label={`Edit ${product.name}`}
                        title="Edit"
                    >
                        <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                    </Link>
                    {!product.is_active && (
                        <button
                            type="button"
                            className="rd-btn rd-btn--icon rd-btn--icon-good"
                            aria-label={`Reactivate ${product.name}`}
                            title="Reactivate"
                            onClick={() => onReactivate(product)}
                        >
                            <i className="mdi mdi-restore" aria-hidden="true" />
                        </button>
                    )}
                    {product.is_active && !neverOrdered && (
                        <button
                            type="button"
                            className="rd-btn rd-btn--icon"
                            aria-label={`Deactivate ${product.name}`}
                            title="Deactivate (it is on past orders)"
                            onClick={() => onRetire(product)}
                        >
                            <i className="mdi mdi-archive-outline" aria-hidden="true" />
                        </button>
                    )}
                    {neverOrdered && (
                        <button
                            type="button"
                            className="rd-btn rd-btn--icon rd-btn--icon-danger"
                            aria-label={`Delete ${product.name}`}
                            title="Delete (never ordered)"
                            onClick={() => onRetire(product)}
                        >
                            <i className="mdi mdi-delete-outline" aria-hidden="true" />
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}
