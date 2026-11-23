import type { FormDataKeys, FormDataValues } from '@inertiajs/core';
import { Link, useForm, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useMemo, type FormEvent, type ReactNode } from 'react';
import SearchSelect from '@/Components/form/SearchSelect';
import { Choices } from '@/Components/surface/Choices';
import { MultiChoices } from '@/Components/surface/MultiChoices';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import AppLayout from '@/Layouts/AppLayout';
import { formatMoney, pluralize } from '@/lib/format';
import type { PageProps } from '@/types';
import type { IngredientOption, Recipe, RecipeOptions } from '@/types/catalogue';

interface RecipeFormProps {
    /** A drink without an id is a new one. */
    recipe: Recipe;
    /** Active products, the only ones a drink can use. */
    products: IngredientOption[];
    options: RecipeOptions;
}

interface IngredientRow {
    product_id: string;
    quantity: string;
    amount_label: string;
}

const MAX_INGREDIENTS = 12;

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

export default function RecipeForm({ recipe, products, options }: RecipeFormProps) {
    const { currency } = usePage<PageProps>().props.app;
    const isNew = !recipe.id;
    const form = useForm({
        name: recipe.name ?? '',
        // Typed as one line, sent as a list.
        aliases: (recipe.aliases ?? []).join(', '),
        category: recipe.category ?? '',
        description: recipe.description ?? '',
        serve: recipe.serve ?? 'iced',
        customer_groups: recipe.customer_groups ?? [],
        outlet_types: (recipe.outlet_types ?? []).map(String),
        price_tier: recipe.price_tier ?? '',
        is_active: recipe.is_active,
        everyday: recipe.everyday,
        ingredients: (recipe.ingredients.length
            ? recipe.ingredients.map((ingredient) => ({
                  product_id: String(ingredient.product_id),
                  quantity: String(ingredient.quantity),
                  amount_label: ingredient.amount_label ?? '',
              }))
            : [{ product_id: '', quantity: '', amount_label: '' }]) as IngredientRow[],
    });
    const { data, post, processing, errors, transform, isDirty } = form;
    const fieldErrors = errors as Record<string, string | undefined>;

    useUnsavedChanges(isDirty, recipe.name ?? undefined);

    const setData = <K extends FormDataKeys<typeof data>>(field: K, value: FormDataValues<typeof data, K>) => {
        form.setData(field, value);
        form.clearErrors(field);
    };

    const byId = useMemo(() => new Map(products.map((product) => [String(product.value), product])), [products]);

    // Products by category, as on the order form.
    const groups = useMemo(() => {
        const map = new Map<string, IngredientOption[]>();
        products.forEach((product) => {
            const key = product.category ?? 'Uncategorised';
            map.set(key, [...(map.get(key) ?? []), product]);
        });

        return [...map.entries()].map(([label, items]) => ({
            label,
            options: items.map((item) => ({ value: item.value, label: item.label })),
        }));
    }, [products]);

    const setIngredient = (index: number, change: Partial<IngredientRow>) => {
        form.setData(
            'ingredients',
            data.ingredients.map((row, i) => (i === index ? { ...row, ...change } : row)),
        );
        Object.keys(change).forEach((key) => form.clearErrors(`ingredients.${index}.${key}` as never));
        form.clearErrors('ingredients' as never);
    };

    const addIngredient = () =>
        form.setData('ingredients', [...data.ingredients, { product_id: '', quantity: '', amount_label: '' }]);

    const removeIngredient = (index: number) =>
        form.setData(
            'ingredients',
            data.ingredients.filter((_, i) => i !== index),
        );

    // Worked out as the admin types, from each product's unit price.
    const chosen = data.ingredients
        .map((row) => ({ row, product: byId.get(row.product_id) }))
        .filter((entry) => entry.product);
    const costPerServe = chosen.reduce(
        (sum, { row, product }) => sum + (parseFloat(row.quantity) || 0) * (product?.unit_price ?? 0),
        0,
    );
    const notHalal = chosen.filter(({ product }) => product?.is_halal === false).map(({ product }) => product!.label);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const addAnother = isNew && submitter?.value === 'another';
        transform((values) => ({
            ...values,
            add_another: addAnother,
            aliases: values.aliases
                .split(',')
                .map((alias) => alias.trim())
                .filter(Boolean),
            ingredients: values.ingredients.filter((row) => row.product_id !== '' || row.quantity !== ''),
        }));
        post(isNew ? route('recipe.store') : route('recipe.update', recipe.id!));
    };

    const title = isNew ? 'Add drink' : `Edit ${recipe.name}`;
    const backHref = isNew ? route('recipe.index') : route('recipe.view', recipe.id!);
    const groupLabel = (key: string) => options.customerGroups.find((group) => group.value === key)?.label ?? key;

    return (
        <AppLayout title={title}>
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Admin' },
                        { label: 'Drinks', href: route('recipe.index') },
                        ...(isNew ? [] : [{ label: recipe.name ?? '', href: route('recipe.view', recipe.id!) }]),
                        { label: isNew ? 'Add drink' : 'Edit' },
                    ]}
                    title={title}
                    lede="A drink is a recipe made from catalogue products, tagged with who it suits."
                />

                <div className="rd-grid">
                    <form className="rd-panel rd-panel--flush rd-span-8 prod-form" onSubmit={submit} noValidate>
                        <Section title="The drink" intro="How reps and outlet owners will know it.">
                            <div className="rd-field">
                                <label className="rd-field__label" htmlFor="name">
                                    Name
                                    <span className="rd-field__required" aria-hidden="true">
                                        {' '}
                                        *
                                    </span>
                                </label>
                                <input
                                    id="name"
                                    className={clsx('rd-input', errors.name && 'is-invalid')}
                                    maxLength={120}
                                    required
                                    placeholder="e.g. Iced Vanilla Latte"
                                    value={data.name}
                                    aria-invalid={Boolean(errors.name)}
                                    aria-describedby={errors.name ? 'name-error' : undefined}
                                    onChange={(event) => setData('name', event.target.value)}
                                />
                                {errors.name && (
                                    <span className="rd-field__error" id="name-error">
                                        {errors.name}
                                    </span>
                                )}
                            </div>
                            <div className="rd-field">
                                <label className="rd-field__label" htmlFor="aliases">
                                    Other names
                                </label>
                                <input
                                    id="aliases"
                                    className={clsx('rd-input', errors.aliases && 'is-invalid')}
                                    maxLength={400}
                                    placeholder="e.g. Vanilla Latte, Latte Vanilla"
                                    value={data.aliases}
                                    aria-describedby="aliases-help"
                                    onChange={(event) => setData('aliases', event.target.value)}
                                />
                                {errors.aliases ? (
                                    <span className="rd-field__error" id="aliases-help">
                                        {errors.aliases}
                                    </span>
                                ) : (
                                    <span className="rd-field__hint" id="aliases-help">
                                        Optional. What a menu may call it, separated by commas. A scanned menu is
                                        matched on these and the name.
                                    </span>
                                )}
                            </div>
                            <Choices
                                legend="Kind of drink"
                                hint="A menu with none of a kind has a gap there."
                                options={options.categories}
                                value={data.category}
                                error={errors.category}
                                onChange={(value) => setData('category', value)}
                            />
                            <Choices
                                legend="Served"
                                required
                                options={options.serves}
                                value={data.serve}
                                error={errors.serve}
                                onChange={(value) => setData('serve', (value || 'either') as typeof data.serve)}
                            />
                            <div className="rd-field">
                                <label className="rd-field__label" htmlFor="description">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    className={clsx('rd-input', errors.description && 'is-invalid')}
                                    rows={3}
                                    maxLength={1000}
                                    placeholder="One line a rep could say to the owner."
                                    value={data.description}
                                    onChange={(event) => setData('description', event.target.value)}
                                />
                                {errors.description ? (
                                    <span className="rd-field__error">{errors.description}</span>
                                ) : (
                                    <span className="rd-field__hint">Optional. Shown on the drink idea.</span>
                                )}
                            </div>
                        </Section>

                        <Section
                            title="Recipe"
                            intro="What goes into one serve. Only active products can be used. The quantity, in the product's own unit, works out the cost per serve."
                        >
                            <div className="rcp-ingredients" role="group" aria-labelledby="ingredients-legend">
                                <span id="ingredients-legend" className="rd-field__label">
                                    Products{' '}
                                    <span className="rd-field__required" aria-hidden="true">
                                        *
                                    </span>
                                </span>
                                {data.ingredients.map((row, index) => {
                                    const product = byId.get(row.product_id);
                                    const productError = fieldErrors[`ingredients.${index}.product_id`];
                                    const quantityError = fieldErrors[`ingredients.${index}.quantity`];
                                    const amountError = fieldErrors[`ingredients.${index}.amount_label`];

                                    return (
                                        <div key={index} className="rcp-ingredient">
                                            <div className="rcp-ingredient__product">
                                                <SearchSelect
                                                    id={`ingredient-${index}`}
                                                    ariaLabel={`Product ${index + 1}`}
                                                    options={[]}
                                                    groups={groups}
                                                    placeholder="Choose a product…"
                                                    value={row.product_id}
                                                    invalid={Boolean(productError)}
                                                    onChange={(value) => setIngredient(index, { product_id: value })}
                                                />
                                                {productError && (
                                                    <span className="rd-field__error">{productError}</span>
                                                )}
                                            </div>
                                            <div className="rcp-ingredient__amount">
                                                <input
                                                    className={clsx('rd-input', amountError && 'is-invalid')}
                                                    aria-label={`Amount for product ${index + 1}, as people say it`}
                                                    placeholder="e.g. 18 g"
                                                    maxLength={40}
                                                    value={row.amount_label}
                                                    onChange={(event) =>
                                                        setIngredient(index, { amount_label: event.target.value })
                                                    }
                                                />
                                            </div>
                                            <div className="rcp-ingredient__qty">
                                                <div className={clsx('rd-affix', quantityError && 'is-invalid')}>
                                                    <input
                                                        type="number"
                                                        inputMode="decimal"
                                                        step="any"
                                                        min="0"
                                                        aria-label={`Quantity per serve for product ${index + 1}, in ${product?.unit ?? 'its unit'}`}
                                                        placeholder="0.018"
                                                        value={row.quantity}
                                                        onChange={(event) =>
                                                            setIngredient(index, { quantity: event.target.value })
                                                        }
                                                    />
                                                    <span className="rd-affix__end">{product?.unit ?? 'unit'}</span>
                                                </div>
                                                {quantityError && (
                                                    <span className="rd-field__error">{quantityError}</span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="rd-btn rd-btn--icon rcp-ingredient__remove"
                                                aria-label={`Remove product ${index + 1}`}
                                                title="Remove"
                                                disabled={data.ingredients.length === 1}
                                                onClick={() => removeIngredient(index)}
                                            >
                                                <i className="mdi mdi-close" aria-hidden="true" />
                                            </button>
                                        </div>
                                    );
                                })}
                                {fieldErrors.ingredients && (
                                    <span className="rd-field__error">{fieldErrors.ingredients}</span>
                                )}
                                <div className="rcp-ingredients__foot">
                                    <button
                                        type="button"
                                        className="rd-btn rd-btn--quiet"
                                        disabled={data.ingredients.length >= MAX_INGREDIENTS}
                                        onClick={addIngredient}
                                    >
                                        <i className="mdi mdi-plus" aria-hidden="true" />
                                        Add a product
                                    </button>
                                    <span className="rd-field__hint">
                                        Amount is how people say it (18 g). Quantity is in the product&apos;s unit: 18 g
                                        from a kg bag is 0.018.
                                    </span>
                                </div>
                            </div>
                        </Section>

                        <Section
                            title="Who it suits"
                            intro="The outlets and customers this drink is for. Anything left empty counts as any."
                        >
                            <MultiChoices
                                legend="Main customers"
                                hint="Who would order it."
                                options={options.customerGroups}
                                value={data.customer_groups}
                                error={errors.customer_groups}
                                onChange={(value) => setData('customer_groups', value)}
                            />
                            <MultiChoices
                                legend="Types of outlet"
                                options={options.outletTypes.map((type) => ({
                                    value: String(type.value),
                                    label: type.label,
                                }))}
                                value={data.outlet_types}
                                error={errors.outlet_types}
                                onChange={(value) => setData('outlet_types', value)}
                            />
                            <Choices
                                legend="Price level"
                                options={options.priceTiers}
                                value={data.price_tier}
                                error={errors.price_tier}
                                onChange={(value) => setData('price_tier', value)}
                            />
                        </Section>

                        <Section
                            title="Availability"
                            intro="Turn it off to retire a drink without losing what reps said about it."
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
                                        {data.is_active ? 'On the drinks list.' : 'Retired. Past feedback keeps it.'}
                                    </p>
                                </div>
                            </div>
                            <div className="prod-form__availability">
                                <button
                                    id="everyday"
                                    type="button"
                                    role="switch"
                                    className="rd-switch"
                                    aria-checked={data.everyday}
                                    aria-describedby="everyday-help"
                                    onClick={() => setData('everyday', !data.everyday)}
                                />
                                <div>
                                    <label htmlFor="everyday">Everyday drink</label>
                                    <p id="everyday-help">
                                        {data.everyday
                                            ? 'Most outlets already serve it, so it is suggested only when their menu lacks it.'
                                            : 'Suggested to any outlet it suits.'}
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
                                {isNew ? 'Save drink' : 'Save changes'}
                            </button>
                        </div>
                    </form>

                    <aside className="rd-span-4 d-flex flex-column gap-4">
                        <section className="rd-panel" aria-labelledby="summary-title">
                            <div>
                                <h2 id="summary-title" className="rd-panel__title">
                                    Per serve
                                </h2>
                                <p className="rd-panel__sub">Worked out from the recipe as you type</p>
                            </div>
                            <dl className="rcp-summary">
                                <dt>Cost of ingredients</dt>
                                <dd>
                                    {currency} {formatMoney(costPerServe)}
                                </dd>
                                <dt>Products</dt>
                                <dd>{pluralize(chosen.length, 'product')}</dd>
                                <dt>Halal</dt>
                                <dd>
                                    {chosen.length === 0 ? (
                                        '—'
                                    ) : notHalal.length === 0 ? (
                                        <span className="rd-chip rd-chip--good">
                                            <i className="mdi mdi-check" aria-hidden="true" />
                                            Yes
                                        </span>
                                    ) : (
                                        <span className="rd-chip rd-chip--serious">
                                            <i className="mdi mdi-alert-outline" aria-hidden="true" />
                                            No
                                        </span>
                                    )}
                                </dd>
                            </dl>
                            {notHalal.length > 0 && (
                                <p className="rd-status rd-status--serious">
                                    <i className="mdi mdi-information-outline" aria-hidden="true" />
                                    {notHalal.join(', ')} {notHalal.length === 1 ? 'is' : 'are'} not halal, so this
                                    drink is not halal.
                                </p>
                            )}
                        </section>

                        <section className="rd-panel" aria-labelledby="preview-title">
                            <div>
                                <h2 id="preview-title" className="rd-panel__title">
                                    Preview
                                </h2>
                                <p className="rd-panel__sub">How the drink reads at a glance</p>
                            </div>
                            <div className="drink-card drink-card--preview" aria-hidden="true">
                                <div className="drink-card__head">
                                    <span className={clsx('drink-card__name', !data.name && 'rd-muted')}>
                                        {data.name || 'Drink name'}
                                    </span>
                                    <span className="rd-chip">
                                        {options.serves.find((s) => s.value === data.serve)?.label}
                                    </span>
                                </div>
                                {data.description && <p className="drink-card__description">{data.description}</p>}
                                {data.customer_groups.length > 0 && (
                                    <div className="lead-reasons">
                                        <span className="lead-reason">
                                            For {data.customer_groups.map(groupLabel).join(', ').toLowerCase()}
                                        </span>
                                    </div>
                                )}
                                <p className="drink-card__needs">
                                    <span>Needs</span> {chosen.map(({ product }) => product!.label).join(', ') || '—'}
                                </p>
                            </div>
                        </section>
                    </aside>
                </div>
            </SurfacePage>
        </AppLayout>
    );
}
