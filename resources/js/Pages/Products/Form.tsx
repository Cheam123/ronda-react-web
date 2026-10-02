import { Link, useForm, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useState, type FormEvent, type ReactNode } from 'react';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import { formatMoney, formatNumber, pluralize, truncate } from '@/lib/format';
import type { PageProps } from '@/types';
import type { CategoryOption, Product } from '@/types/catalogue';

interface ProductFormProps {
    /** A product without an id is a new one. */
    product: Product;
    categories: CategoryOption[];
    /** Units in use, plus the usual ones. */
    units: string[];
}

interface FieldProps {
    id?: string;
    label: ReactNode;
    required?: boolean;
    hint?: ReactNode;
    error?: string;
    children: ReactNode;
}

function Field({ id, label, required, hint, error, children }: FieldProps) {
    return (
        <div className="rd-field">
            <label className="rd-field__label" htmlFor={id}>
                {label}
                {required && (
                    <span className="rd-field__required" aria-hidden="true">
                        {' '}
                        *
                    </span>
                )}
            </label>
            {children}
            {error ? (
                <span className="rd-field__error" id={id ? `${id}-error` : undefined}>
                    {error}
                </span>
            ) : (
                hint && <span className="rd-field__hint">{hint}</span>
            )}
        </div>
    );
}

function Section({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
    return (
        <div className="prod-form__section">
            <div className="prod-form__intro">
                <h2>{title}</h2>
                <p>{intro}</p>
            </div>
            <div className="prod-form__fields">{children}</div>
        </div>
    );
}

export default function ProductForm({ product, categories, units }: ProductFormProps) {
    const { currency } = usePage<PageProps>().props.app;
    const isNew = !product.id;
    const form = useForm({
        sku: product.sku ?? '',
        name: product.name ?? '',
        category: product.category ?? '',
        unit: product.unit ?? '',
        unit_price: product.unit_price?.toString() ?? '',
        description: product.description ?? '',
        is_active: product.is_active,
    });
    const { data, post, processing, errors, transform } = form;

    // Editing a field clears its error from the last save.
    const setData = <K extends keyof typeof data>(field: K, value: (typeof data)[K]) => {
        form.setData(field, value);
        form.clearErrors(field);
    };

    const categoryNames = categories.map((category) => category.name);
    const [newCategory, setNewCategory] = useState(data.category !== '' && !categoryNames.includes(data.category));
    const customUnit = units.includes(data.unit) ? '' : data.unit;
    const range = categories.find((category) => category.name === data.category);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const addAnother = isNew && submitter?.value === 'another';
        transform((form) => ({ ...form, add_another: addAnother }));
        post(isNew ? route('product.store') : route('product.update', product.id!));
    };

    const pickCategory = (name: string) => {
        setNewCategory(false);
        setData('category', data.category === name ? '' : name);
    };

    const title = isNew ? 'Add product' : `Edit ${product.name}`;
    const backHref = isNew ? route('product.index') : route('product.view', product.id!);

    return (
        <AppLayout title={isNew ? 'Add product' : `Edit ${product.name}`}>
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Admin' },
                        { label: 'Products', href: route('product.index') },
                        ...(isNew ? [] : [{ label: product.name ?? '', href: route('product.view', product.id!) }]),
                        { label: isNew ? 'Add product' : 'Edit' },
                    ]}
                    title={title}
                    lede={
                        isNew
                            ? "An active product shows up on the reps' order form straight away, and in recommendations once outlets start ordering it."
                            : 'Changes apply to new orders. Orders already recorded keep their price and lines.'
                    }
                />

                <div className="rd-grid">
                    <form className="rd-panel rd-panel--flush rd-span-8 prod-form" onSubmit={submit} noValidate>
                        <Section title="Identity" intro="How reps find the product and how it prints on orders.">
                            <div className="prod-form__pair">
                                <Field
                                    id="sku"
                                    label="SKU"
                                    required
                                    error={errors.sku}
                                    hint="Letters, numbers and dashes. Saved in capitals."
                                >
                                    <input
                                        id="sku"
                                        className={clsx('rd-input rd-input--mono', errors.sku && 'is-invalid')}
                                        maxLength={50}
                                        required
                                        autoComplete="off"
                                        spellCheck={false}
                                        value={data.sku}
                                        aria-invalid={Boolean(errors.sku)}
                                        aria-describedby={errors.sku ? 'sku-error' : undefined}
                                        onChange={(event) => setData('sku', event.target.value.toUpperCase())}
                                    />
                                </Field>
                                <Field id="name" label="Name" required error={errors.name} hint="Up to 150 characters">
                                    <input
                                        id="name"
                                        className={clsx('rd-input', errors.name && 'is-invalid')}
                                        maxLength={150}
                                        required
                                        value={data.name}
                                        aria-invalid={Boolean(errors.name)}
                                        aria-describedby={errors.name ? 'name-error' : undefined}
                                        onChange={(event) => setData('name', event.target.value)}
                                    />
                                </Field>
                            </div>
                        </Section>

                        <Section
                            title="Category and unit"
                            intro="Categories group the catalogue and the sales figures. The unit is what one quantity means on an order."
                        >
                            <fieldset>
                                <legend>Category</legend>
                                <div className="rd-choices">
                                    {categories.map((category) => (
                                        <button
                                            key={category.name}
                                            type="button"
                                            className="rd-choice"
                                            aria-pressed={!newCategory && data.category === category.name}
                                            onClick={() => pickCategory(category.name)}
                                        >
                                            {category.name}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        className="rd-choice rd-choice--add"
                                        aria-pressed={newCategory}
                                        onClick={() => {
                                            setNewCategory(true);
                                            if (categoryNames.includes(data.category)) setData('category', '');
                                        }}
                                    >
                                        <i className="mdi mdi-plus" aria-hidden="true" />
                                        New category
                                    </button>
                                </div>
                                {newCategory && (
                                    <Field id="category" label="New category name" error={errors.category}>
                                        <input
                                            id="category"
                                            className={clsx('rd-input', errors.category && 'is-invalid')}
                                            maxLength={50}
                                            placeholder="e.g. Pastries"
                                            autoFocus={data.category === ''}
                                            value={data.category}
                                            onChange={(event) => setData('category', event.target.value)}
                                        />
                                    </Field>
                                )}
                                {!newCategory && data.category === '' && (
                                    <span className="rd-field__hint">
                                        Optional. Without one it is listed as Uncategorised.
                                    </span>
                                )}
                            </fieldset>

                            <fieldset>
                                <legend>
                                    Unit{' '}
                                    <span className="rd-field__required" aria-hidden="true">
                                        *
                                    </span>
                                </legend>
                                <div className="rd-choices">
                                    {units.map((unit) => (
                                        <button
                                            key={unit}
                                            type="button"
                                            className="rd-choice rd-choice--square"
                                            aria-pressed={data.unit === unit}
                                            onClick={() => setData('unit', unit)}
                                        >
                                            {unit}
                                        </button>
                                    ))}
                                    <input
                                        className={clsx('rd-input rd-input--sm', errors.unit && 'is-invalid')}
                                        style={{ width: 130 }}
                                        aria-label="Another unit"
                                        placeholder="Other…"
                                        maxLength={20}
                                        value={customUnit}
                                        onChange={(event) => setData('unit', event.target.value)}
                                    />
                                </div>
                                {errors.unit && <span className="rd-field__error">{errors.unit}</span>}
                            </fieldset>
                        </Section>

                        <Section
                            title="Price"
                            intro="Orders keep the price they were recorded at, so changing it later leaves past orders alone."
                        >
                            <Field
                                id="unit_price"
                                label="Unit price"
                                required
                                error={errors.unit_price}
                                hint={
                                    range &&
                                    `${range.name} ${range.count === 1 ? 'sells' : 'sell'} for ${currency} ${formatMoney(range.min_price)}${
                                        range.max_price !== range.min_price
                                            ? ` to ${currency} ${formatMoney(range.max_price)}`
                                            : ''
                                    } today (${pluralize(range.count, 'product')}).`
                                }
                            >
                                <div className={clsx('rd-affix', errors.unit_price && 'is-invalid')}>
                                    <span className="rd-affix__start">{currency}</span>
                                    <input
                                        id="unit_price"
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={data.unit_price}
                                        aria-invalid={Boolean(errors.unit_price)}
                                        aria-describedby={errors.unit_price ? 'unit_price-error' : undefined}
                                        onChange={(event) => setData('unit_price', event.target.value)}
                                    />
                                    <span className="rd-affix__end">per {data.unit || 'unit'}</span>
                                </div>
                            </Field>
                        </Section>

                        <Section
                            title="Description"
                            intro="Optional. Reps read it when they pitch the product, and it helps the recommendation write-ups."
                        >
                            <Field id="description" label="Description" error={errors.description}>
                                <textarea
                                    id="description"
                                    className={clsx('rd-input', errors.description && 'is-invalid')}
                                    rows={4}
                                    maxLength={2000}
                                    value={data.description}
                                    onChange={(event) => setData('description', event.target.value)}
                                />
                                <span className="prod-form__counter">
                                    {formatNumber(data.description.length)} / 2,000
                                </span>
                            </Field>
                        </Section>

                        <Section
                            title="Availability"
                            intro="Turn it off to stop offering a product without losing its history."
                        >
                            <div className="prod-form__availability">
                                <button
                                    id="is_active"
                                    type="button"
                                    role="switch"
                                    className="rd-switch"
                                    aria-checked={data.is_active}
                                    aria-describedby="is_active-help"
                                    onClick={() => setData('is_active', !data.is_active)}
                                />
                                <div>
                                    <label htmlFor="is_active">{data.is_active ? 'Active' : 'Inactive'}</label>
                                    <p id="is_active-help">
                                        {data.is_active
                                            ? 'Offered on the order form and included in outlet recommendations.'
                                            : 'Hidden from the order form and recommendations. Past orders keep it.'}
                                    </p>
                                </div>
                            </div>
                        </Section>

                        <div className="prod-form__foot">
                            <Link href={backHref} className="rd-btn rd-btn--quiet rd-btn--lg">
                                Cancel
                            </Link>
                            <span className="flex-grow-1" />
                            {isNew && (
                                <button
                                    type="submit"
                                    value="another"
                                    className="rd-btn rd-btn--lg"
                                    disabled={processing}
                                >
                                    Save and add another
                                </button>
                            )}
                            <button
                                type="submit"
                                value="save"
                                className="rd-btn rd-btn--primary rd-btn--lg"
                                disabled={processing}
                            >
                                {processing && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                                {isNew ? 'Save product' : 'Save changes'}
                            </button>
                        </div>
                    </form>

                    <aside className="rd-span-4 d-flex flex-column gap-4">
                        <section className="rd-panel" aria-labelledby="preview-title">
                            <div>
                                <h2 id="preview-title" className="rd-panel__title">
                                    Preview
                                </h2>
                                <p className="rd-panel__sub">How reps see it on the order form in the mobile app</p>
                            </div>
                            <div className="prod-preview" aria-hidden="true">
                                <div className="prod-preview__bar">
                                    <span className="fw-semibold">New order</span>
                                    <span>{data.category || 'Uncategorised'}</span>
                                </div>
                                <div className="prod-preview__card">
                                    <div className="prod-preview__top">
                                        <div className="d-flex flex-column gap-1" style={{ minWidth: 0 }}>
                                            <span
                                                className={clsx(
                                                    'prod-preview__name',
                                                    !data.name && 'prod-preview__placeholder',
                                                )}
                                            >
                                                {data.name || 'Product name'}
                                            </span>
                                            <span className="rd-mono rd-muted" style={{ fontSize: 11 }}>
                                                {data.sku || 'SKU'}
                                            </span>
                                        </div>
                                        <span className="prod-preview__price">
                                            {currency} {formatMoney(data.unit_price || 0)}
                                            <small> / {data.unit || 'unit'}</small>
                                        </span>
                                    </div>
                                    {data.description && (
                                        <p className="prod-preview__description">{truncate(data.description, 120)}</p>
                                    )}
                                    <div className="prod-preview__qty">
                                        Quantity
                                        <span className="prod-preview__stepper">
                                            <span>−</span>
                                            <span>1</span>
                                            <span>+</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {!data.is_active && (
                                <p className="rd-status rd-status--serious">
                                    <i className="mdi mdi-eye-off-outline" aria-hidden="true" />
                                    Inactive products don&apos;t appear on the order form.
                                </p>
                            )}
                        </section>

                        <section className="rd-panel" aria-labelledby="after-title">
                            <h2 id="after-title" className="rd-panel__title">
                                {isNew ? 'After you save' : 'Good to know'}
                            </h2>
                            <ul className="rd-checks">
                                {isNew ? (
                                    <>
                                        <li>
                                            <i className="mdi mdi-check is-good" aria-hidden="true" />
                                            Reps can add it to orders straight away
                                            {!data.is_active && ' once it is active'}
                                        </li>
                                        <li>
                                            <i className="mdi mdi-clock-outline is-info" aria-hidden="true" />
                                            Recommendations pick it up at the nightly refresh, once outlets have ordered
                                            it
                                        </li>
                                        <li>
                                            <i className="mdi mdi-tag-outline is-info" aria-hidden="true" />
                                            {data.category
                                                ? `It is listed under ${data.category} in the catalogue and sales figures`
                                                : 'Without a category it is listed as Uncategorised'}
                                        </li>
                                    </>
                                ) : (
                                    <>
                                        <li>
                                            <i className="mdi mdi-receipt is-info" aria-hidden="true" />
                                            {(product.order_lines_count ?? 0) > 0
                                                ? `It is on ${pluralize(product.order_lines_count ?? 0, 'order line')}. Those keep the price they were recorded at.`
                                                : 'It has not been ordered yet.'}
                                        </li>
                                        <li>
                                            <i className="mdi mdi-clock-outline is-info" aria-hidden="true" />
                                            Recommendations use the new details from the next nightly refresh
                                        </li>
                                    </>
                                )}
                            </ul>
                        </section>
                    </aside>
                </div>
            </SurfacePage>
        </AppLayout>
    );
}
