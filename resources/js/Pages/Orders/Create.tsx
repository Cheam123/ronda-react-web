import { useForm, usePage } from '@inertiajs/react';
import { useMemo, useState, type FormEvent } from 'react';
import Field from '@/Components/form/Field';
import type { OptionGroup } from '@/Components/form/Select';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import { FormFoot, FormRow, FormSection } from '@/Components/surface/FormSection';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import AppLayout from '@/Layouts/AppLayout';
import { formatMoney, pluralize } from '@/lib/format';
import type { PageProps } from '@/types';
import type { Product } from '@/types/catalogue';
import OrderLineRow, { type OrderLine } from './Partials/OrderLineRow';

const BLANK_LINE: OrderLine = { product_id: '', quantity: '' };
const REMARK_MAX = 1000;

/** The server drops blank rows before it numbers its errors ("lines.0.quantity"). */
const isBlank = (line: OrderLine) => line.product_id === '' && line.quantity === '';

interface CreateOrderProps {
    lead: { id: number; name: string | null; business_name: string | null; customer_id: string | null };
    products: Product[];
    today: string;
}

/**
 * Starting lines from the outlet's Suggested orders tab: ?suggested=12:6,40:2.5
 * (product id and quantity). Products no longer in the catalogue are skipped.
 */
function suggestedLines(url: string, products: Product[]): OrderLine[] {
    const param = new URLSearchParams(url.split('?')[1] ?? '').get('suggested') ?? '';
    const active = new Set(products.map((product) => String(product.id)));

    return param
        .split(',')
        .map((pair) => pair.split(':'))
        .filter(([id, quantity]) => active.has(id) && Number(quantity) > 0)
        .map(([id, quantity]) => ({ product_id: id, quantity: String(Number(quantity)), suggested: true }));
}

/** Record what an outlet ordered (lead.orders.store). */
export default function CreateOrder({ lead, products, today }: CreateOrderProps) {
    const { url, props } = usePage<PageProps>();
    const { currency } = props.app;
    const [started] = useState(() => suggestedLines(url, products));
    const { data, setData, post, transform, processing, errors, isDirty } = useForm({
        order_date: today,
        remark: '',
        lines: started.length > 0 ? started : [BLANK_LINE],
    });
    const outlet = lead.business_name || lead.name || 'Unnamed outlet';

    useUnsavedChanges(isDirty || started.length > 0, outlet);

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

    const counted = data.lines.filter((line) => productsById.has(line.product_id) && Number(line.quantity) > 0);
    const total = counted.reduce(
        (sum, line) => sum + (productsById.get(line.product_id)?.unit_price ?? 0) * Number(line.quantity),
        0,
    );

    // Server error keys count only the lines that were posted; map them back to the rows on screen.
    const lineErrors = useMemo(() => {
        const errorBag = errors as Record<string, string | undefined>;
        const posted = data.lines.map((line, index) => (isBlank(line) ? -1 : index)).filter((index) => index >= 0);
        const byRow: Record<number, { product?: string; quantity?: string }> = {};
        posted.forEach((row, sent) => {
            const product = errorBag[`lines.${sent}.product_id`];
            const quantity = errorBag[`lines.${sent}.quantity`];
            if (product || quantity) byRow[row] = { product, quantity };
        });
        return { byRow, posted };
    }, [errors, data.lines]);

    const fieldId = (key: string) => {
        const match = key.match(/^lines\.(\d+)\.(product_id|quantity)$/);
        if (!match) return key.replace(/\./g, '-');
        const row = lineErrors.posted[Number(match[1])] ?? Number(match[1]);
        return `lines-${row}-${match[2]}`;
    };

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
        // "suggested" only marks the row on screen.
        transform((current) => ({
            ...current,
            lines: current.lines.map(({ product_id, quantity }) => ({ product_id, quantity })),
        }));
        post(route('lead.orders.store', lead.id));
    };

    return (
        <AppLayout title="Record an order">
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Outlets', href: route('lead.index') },
                        { label: outlet, href: route('lead.view', lead.id) },
                        { label: 'Record an order' },
                    ]}
                    title="Record an order"
                    lede={`What ${outlet} ordered${lead.customer_id ? ` (${lead.customer_id})` : ''}. Prices come from the catalogue when you save.`}
                />

                <ErrorSummary fieldId={fieldId} />

                {products.length === 0 ? (
                    <p className="rd-notice">
                        <i className="mdi mdi-alert-outline" aria-hidden="true" />
                        There are no active products in the catalogue yet. An Admin can add them under Admin &rsaquo;
                        Products.
                    </p>
                ) : (
                    <div className="rd-form-page">
                        <form className="rd-form" onSubmit={submit} noValidate>
                            <FormSection title="Order" intro="When they ordered.">
                                <FormRow columns="minmax(0, 220px)">
                                    <Field label="Order date" htmlFor="order_date" required error={errors.order_date}>
                                        <TextInput
                                            id="order_date"
                                            type="date"
                                            large
                                            max={today}
                                            value={data.order_date}
                                            onChange={(event) => setData('order_date', event.target.value)}
                                        />
                                    </Field>
                                </FormRow>
                            </FormSection>

                            <FormSection
                                title="Products"
                                intro={
                                    started.length > 0
                                        ? `Started from ${pluralize(started.length, 'suggested product')}. Change or remove any line.`
                                        : 'One line per product. Quantities in the product’s unit.'
                                }
                                wide
                            >
                                <div className="rd-scroll">
                                    <table className="rd-table rd-table--stack order-lines">
                                        <thead>
                                            <tr>
                                                <th scope="col">Product</th>
                                                <th scope="col">Quantity</th>
                                                <th scope="col" className="num">
                                                    Unit price ({currency})
                                                </th>
                                                <th scope="col" className="num">
                                                    Line total ({currency})
                                                </th>
                                                <th scope="col" className="rd-col-actions">
                                                    <span className="visually-hidden">Remove</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.lines.map((line, index) => (
                                                <OrderLineRow
                                                    key={index}
                                                    index={index}
                                                    line={line}
                                                    product={productsById.get(line.product_id)}
                                                    productGroups={productGroups}
                                                    errors={lineErrors.byRow[index] ?? {}}
                                                    currency={currency}
                                                    onChange={(changed) => updateLine(index, changed)}
                                                    onRemove={() => removeLine(index)}
                                                />
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan={3} className="num">
                                                    Total
                                                </td>
                                                <td className="num">{formatMoney(total)}</td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                <div>
                                    <button
                                        type="button"
                                        className="rd-btn"
                                        onClick={() => setData('lines', [...data.lines, BLANK_LINE])}
                                    >
                                        <i className="mdi mdi-plus" aria-hidden="true" />
                                        Add a product
                                    </button>
                                </div>
                            </FormSection>

                            <FormSection title="Remark" intro="Delivery notes, a promotion, anything unusual.">
                                <Field label="Remark" htmlFor="remark" error={errors.remark}>
                                    <TextArea
                                        id="remark"
                                        maxLength={REMARK_MAX}
                                        value={data.remark}
                                        onChange={(event) => setData('remark', event.target.value)}
                                    />
                                    <span className="rd-form__counter">
                                        {data.remark.length} / {REMARK_MAX}
                                    </span>
                                </Field>
                            </FormSection>

                            <FormFoot
                                cancelHref={route('lead.view', lead.id)}
                                submitLabel="Save order"
                                processing={processing}
                            />
                        </form>

                        <aside className="rd-form-page__aside">
                            <section className="rd-panel order-summary" aria-labelledby="order-summary-title">
                                <h2 id="order-summary-title" className="rd-panel__title">
                                    This order
                                </h2>
                                <span className="order-summary__total">
                                    {currency} {formatMoney(total)}
                                </span>
                                <span className="rd-panel__sub">
                                    {counted.length > 0 ? pluralize(counted.length, 'product') : 'No products yet'}
                                </span>
                            </section>
                        </aside>
                    </div>
                )}
            </SurfacePage>
        </AppLayout>
    );
}
