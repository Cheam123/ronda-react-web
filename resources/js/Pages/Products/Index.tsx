import { Link, router, usePage } from '@inertiajs/react';
import type { FormEvent } from 'react';
import Select from '@/Components/form/Select';
import TextInput from '@/Components/form/TextInput';
import Button, { ButtonLink } from '@/Components/ui/Button';
import Card from '@/Components/ui/Card';
import DataTable, { EmptyRow } from '@/Components/ui/DataTable';
import Pagination from '@/Components/ui/Pagination';
import { useFilters } from '@/hooks/useFilters';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import { confirm } from '@/lib/dialogs';
import { formatMoney, truncate } from '@/lib/format';
import type { BreadcrumbProps, PageProps, Paginated, QueryParams } from '@/types';
import type { Product } from '@/types/catalogue';

const ACTIVE_OPTIONS = [
    { value: '1', label: 'Active' },
    { value: '0', label: 'Inactive' },
    { value: 'all', label: 'All' },
];

interface ProductsIndexProps extends BreadcrumbProps {
    products: Paginated<Product>;
    categories: string[];
    filters: QueryParams;
}

export default function ProductsIndex({ products, categories, filters, ...breadcrumb }: ProductsIndexProps) {
    const { currency } = usePage<PageProps>().props.app;
    const { values, set, apply, reset } = useFilters(route('product.index'), {
        search: filters.search ?? '',
        category: filters.category ?? '',
        active: filters.active ?? '1',
    });

    const search = (event: FormEvent) => {
        event.preventDefault();
        apply();
    };

    const deleteProduct = async (product: Product) => {
        const onOrders = (product.order_lines_count ?? 0) > 0;
        const confirmed = await confirm({
            title: onOrders ? 'Deactivate product?' : `Delete ${product.sku}?`,
            text: onOrders
                ? 'This product is on existing orders, so it will be deactivated instead of deleted. Continue?'
                : undefined,
            danger: true,
        });
        if (confirmed) {
            router.post(route('product.delete'), { id: product.id }, { preserveScroll: true });
        }
    };

    return (
        <AppLayout title="Products" breadcrumb={breadcrumbFrom(breadcrumb)}>
            <Card>
                <form onSubmit={search} className="row g-2 align-items-end mb-3">
                    <div className="col-md-4">
                        <TextInput
                            placeholder="Search name or SKU"
                            value={values.search}
                            onChange={(event) => set('search', event.target.value)}
                        />
                    </div>
                    <div className="col-md-3">
                        <Select
                            aria-label="Category"
                            placeholder="All categories"
                            options={categories.map((category) => ({ value: category, label: category }))}
                            value={values.category}
                            onChange={(event) => set('category', event.target.value)}
                        />
                    </div>
                    <div className="col-md-2">
                        <Select
                            aria-label="Status"
                            options={ACTIVE_OPTIONS}
                            value={values.active}
                            onChange={(event) => set('active', event.target.value)}
                        />
                    </div>
                    <div className="col-md-3 d-flex gap-2">
                        <Button type="submit" size="sm">
                            Search
                        </Button>
                        <Button variant="light" size="sm" onClick={reset}>
                            Reset
                        </Button>
                        <ButtonLink href={route('product.create')} size="sm" className="ms-auto">
                            Add
                        </ButtonLink>
                    </div>
                </form>

                <DataTable nowrap={false}>
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Unit</th>
                            <th className="num">Unit Price ({currency})</th>
                            <th>Status</th>
                            <th className="num">On orders</th>
                            <th style={{ width: 150 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {products.data.map((product) => (
                            <tr key={product.id}>
                                <td>{product.sku}</td>
                                <td>
                                    {product.name}
                                    {product.description && (
                                        <div className="text-muted custom-font-xsmall">
                                            {truncate(product.description, 90)}
                                        </div>
                                    )}
                                </td>
                                <td>{product.category}</td>
                                <td>{product.unit}</td>
                                <td className="num">{formatMoney(product.unit_price)}</td>
                                <td>{product.is_active ? 'Active' : 'Inactive'}</td>
                                <td className="num">{product.order_lines_count}</td>
                                <td className="text-nowrap">
                                    <Link
                                        className="btn btn-sm btn-primary custom-button-shadow me-1"
                                        href={route('product.edit', product.id!)}
                                    >
                                        Edit
                                    </Link>
                                    <Button variant="danger" size="sm" onClick={() => deleteProduct(product)}>
                                        Delete
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {products.data.length === 0 && <EmptyRow colSpan={8}>No products found.</EmptyRow>}
                    </tbody>
                </DataTable>

                <Pagination links={products.links} className="mt-2" />
            </Card>
        </AppLayout>
    );
}
