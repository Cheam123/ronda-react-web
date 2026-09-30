import { useForm, usePage } from '@inertiajs/react';
import { useMemo, type FormEvent } from 'react';
import Field from '@/Components/form/Field';
import FormActions from '@/Components/form/FormActions';
import type { OptionGroup } from '@/Components/form/Select';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import Button from '@/Components/ui/Button';
import Card from '@/Components/ui/Card';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import SectionHeader from '@/Components/ui/SectionHeader';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import { formatMoney } from '@/lib/format';
import type { BreadcrumbProps, PageProps } from '@/types';
import type { Product } from '@/types/catalogue';
import OrderLineRow, { type OrderLine } from './Partials/OrderLineRow';

const BLANK_LINE: OrderLine = { product_id: '', quantity: '' };

interface CreateOrderProps extends BreadcrumbProps {
    lead: { id: number; name: string | null; business_name: string | null; customer_id: string | null };
    products: Product[];
    today: string;
}

/** Record what an outlet ordered (lead.orders.store). */
export default function CreateOrder({ lead, products, today, ...breadcrumb }: CreateOrderProps) {
    const { currency } = usePage<PageProps>().props.app;
    const { data, setData, post, processing } = useForm({
        order_date: today,
        remark: '',
        lines: [BLANK_LINE],
    });

    const productsById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);

    const productGroups = useMemo<OptionGroup[]>(() => {
        const groups = new Map<string, OptionGroup>();
        products.forEach((product) => {
            const label = product.category || 'Other';
            if (!groups.has(label)) groups.set(label, { label, options: [] });
            groups.get(label)!.options.push({ value: String(product.id), label: `${product.name} (${product.sku})` });
        });
        return [...groups.values()];
    }, [products]);

    const total = data.lines.reduce((sum, line) => {
        const product = productsById.get(line.product_id);
        const quantity = Number(line.quantity) || 0;
        return product && quantity > 0 ? sum + (product.unit_price ?? 0) * quantity : sum;
    }, 0);

    const updateLine = (index: number, line: OrderLine) =>
        setData(
            'lines',
            data.lines.map((current, i) => (i === index ? line : current)),
        );

    // The last line is emptied rather than removed so the table is never empty.
    const removeLine = (index: number) =>
        setData('lines', data.lines.length > 1 ? data.lines.filter((_, i) => i !== index) : [BLANK_LINE]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('lead.orders.store', lead.id));
    };

    return (
        <AppLayout title="Record Order" breadcrumb={breadcrumbFrom(breadcrumb)}>
            <Card>
                <ErrorSummary />

                <div className="mb-3">
                    <SectionHeader title="Outlet" />
                    <div className="m-2">
                        <b>{lead.business_name || lead.name}</b>
                        {lead.business_name && <span className="text-muted"> ({lead.name})</span>}
                        {lead.customer_id && <> &middot; Customer ID {lead.customer_id}</>}
                    </div>
                </div>

                {products.length === 0 ? (
                    <div className="alert alert-warning">
                        There are no active products in the catalogue yet. An Admin can add them under Admin &rsaquo;
                        Products.
                    </div>
                ) : (
                    <form onSubmit={submit}>
                        <div className="row mb-2">
                            <Field label="Order date" htmlFor="order_date" className="col-md-3">
                                <TextInput
                                    id="order_date"
                                    type="date"
                                    max={today}
                                    value={data.order_date}
                                    onChange={(event) => setData('order_date', event.target.value)}
                                />
                            </Field>
                        </div>

                        <SectionHeader title="Products" />
                        <div className="m-2 overflow-auto">
                            <table className="table table-sm custom-font-small mb-1 data-table">
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: 260 }}>Product</th>
                                        <th style={{ width: 120 }}>Quantity</th>
                                        <th className="num" style={{ width: 140 }}>
                                            Unit price ({currency})
                                        </th>
                                        <th className="num" style={{ width: 140 }}>
                                            Line total ({currency})
                                        </th>
                                        <th style={{ width: 40 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.lines.map((line, index) => (
                                        <OrderLineRow
                                            key={index}
                                            line={line}
                                            product={productsById.get(line.product_id)}
                                            productGroups={productGroups}
                                            onChange={(changed) => updateLine(index, changed)}
                                            onRemove={() => removeLine(index)}
                                        />
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={3} className="num">
                                            <b>Total</b>
                                        </td>
                                        <td className="num">
                                            <b>{formatMoney(total)}</b>
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                            <Button
                                variant="outline-primary"
                                size="sm"
                                shadow={false}
                                onClick={() => setData('lines', [...data.lines, BLANK_LINE])}
                            >
                                + Add product
                            </Button>
                            <div className="text-muted custom-font-xsmall mt-1">
                                Prices come from the catalogue when the order is saved.
                            </div>
                        </div>

                        <Field label="Remark" htmlFor="remark" className="mt-2">
                            <TextArea
                                id="remark"
                                rows={2}
                                maxLength={1000}
                                value={data.remark}
                                onChange={(event) => setData('remark', event.target.value)}
                            />
                        </Field>

                        <FormActions
                            backHref={route('lead.view', lead.id)}
                            submitLabel="Save order"
                            processing={processing}
                        />
                    </form>
                )}
            </Card>
        </AppLayout>
    );
}
