import { useForm, usePage } from '@inertiajs/react';
import type { FormEvent } from 'react';
import Field from '@/Components/form/Field';
import FormActions from '@/Components/form/FormActions';
import Switch from '@/Components/form/Switch';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import Card from '@/Components/ui/Card';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import SectionHeader from '@/Components/ui/SectionHeader';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import type { BreadcrumbProps, PageProps } from '@/types';
import type { Product } from '@/types/catalogue';

interface ProductFormProps extends BreadcrumbProps {
    /** A product without an id is a new one. */
    product: Product;
    categories: string[];
}

export default function ProductForm({ product, categories, ...breadcrumb }: ProductFormProps) {
    const { currency } = usePage<PageProps>().props.app;
    const { data, setData, post, processing, errors } = useForm({
        sku: product.sku ?? '',
        name: product.name ?? '',
        category: product.category ?? '',
        unit: product.unit ?? '',
        unit_price: product.unit_price?.toString() ?? '',
        description: product.description ?? '',
        is_active: product.is_active,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(product.id ? route('product.update', product.id) : route('product.store'));
    };

    return (
        <AppLayout title="Products" breadcrumb={breadcrumbFrom(breadcrumb)}>
            <Card>
                <ErrorSummary />
                <form onSubmit={submit}>
                    <SectionHeader title="Product Detail" />
                    <div className="m-2">
                        <div className="row">
                            <Field label="SKU" htmlFor="sku" required className="col-md-3">
                                <TextInput
                                    id="sku"
                                    maxLength={50}
                                    required
                                    value={data.sku}
                                    onChange={(event) => setData('sku', event.target.value)}
                                    invalid={Boolean(errors.sku)}
                                />
                            </Field>
                            <Field label="Name" htmlFor="name" required className="col-md-6">
                                <TextInput
                                    id="name"
                                    maxLength={150}
                                    required
                                    value={data.name}
                                    onChange={(event) => setData('name', event.target.value)}
                                    invalid={Boolean(errors.name)}
                                />
                            </Field>
                            <Field label="Category" htmlFor="category" className="col-md-3">
                                <TextInput
                                    id="category"
                                    maxLength={50}
                                    list="product-categories"
                                    placeholder="e.g. Coffee Beans"
                                    value={data.category}
                                    onChange={(event) => setData('category', event.target.value)}
                                />
                                <datalist id="product-categories">
                                    {categories.map((category) => (
                                        <option key={category} value={category} />
                                    ))}
                                </datalist>
                            </Field>
                        </div>
                        <div className="row">
                            <Field label="Unit" htmlFor="unit" required className="col-md-3">
                                <TextInput
                                    id="unit"
                                    maxLength={20}
                                    required
                                    placeholder="kg, bottle, box, unit"
                                    value={data.unit}
                                    onChange={(event) => setData('unit', event.target.value)}
                                    invalid={Boolean(errors.unit)}
                                />
                            </Field>
                            <Field label={`Unit Price (${currency})`} htmlFor="unit_price" required className="col-md-3">
                                <TextInput
                                    id="unit_price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    value={data.unit_price}
                                    onChange={(event) => setData('unit_price', event.target.value)}
                                    invalid={Boolean(errors.unit_price)}
                                />
                            </Field>
                            <div className="col-md-3 d-flex align-items-end pb-3">
                                <Switch
                                    id="is_active"
                                    checked={data.is_active}
                                    onChange={(checked) => setData('is_active', checked)}
                                    label="Active (offered on orders and recommended)"
                                />
                            </div>
                        </div>
                        <Field label="Description" htmlFor="description">
                            <TextArea
                                id="description"
                                maxLength={2000}
                                value={data.description}
                                onChange={(event) => setData('description', event.target.value)}
                            />
                        </Field>
                    </div>

                    <FormActions backHref={route('product.index')} submitLabel="Save" processing={processing} />
                </form>
            </Card>
        </AppLayout>
    );
}
