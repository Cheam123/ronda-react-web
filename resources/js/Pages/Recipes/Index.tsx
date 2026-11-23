import { Link, router, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useState, type FormEvent } from 'react';
import Dialog from '@/Components/surface/Dialog';
import PageHeader from '@/Components/surface/PageHeader';
import Segmented from '@/Components/surface/Segmented';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useFilters } from '@/hooks/useFilters';
import AppLayout from '@/Layouts/AppLayout';
import { formatMoney, pluralize } from '@/lib/format';
import type { PageProps, QueryParams } from '@/types';
import type { IdeasCheck, RecipeOptions, RecipeRow } from '@/types/catalogue';
import IdeasCheckPanel from './Partials/IdeasCheckPanel';

type Status = '1' | '0' | 'all';

/** A menu line no drink matched, with the drink it could be another name for. */
function UnrecognisedRow({
    row,
    drinks,
}: {
    row: { text: string; menus: number };
    drinks: { value: number; label: string }[];
}) {
    const [drink, setDrink] = useState('');

    return (
        <li>
            <span>
                <span className="menu-rows__drink">{row.text}</span>{' '}
                <span className="menu-rows__text">on {pluralize(row.menus, 'menu')}</span>
            </span>
            <span className="d-inline-flex flex-wrap align-items-center gap-2">
                <select
                    className="rd-input rd-input--md menu-rows__pick"
                    aria-label={`Which drink is "${row.text}" another name for?`}
                    value={drink}
                    onChange={(event) => setDrink(event.target.value)}
                >
                    <option value="">Another name for…</option>
                    {drinks.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    className="rd-btn rd-btn--sm"
                    disabled={drink === ''}
                    onClick={() =>
                        router.post(route('recipe.alias', Number(drink)), { alias: row.text }, { preserveScroll: true })
                    }
                >
                    Add
                </button>
            </span>
        </li>
    );
}

interface RecipesIndexProps {
    recipes: RecipeRow[];
    stats: { total: number; active: number; menus: number };
    /** Menu rows no drink matched, most common first. */
    unrecognised: { text: string; menus: number }[];
    /** Drinks a row can become another name for. */
    drinkOptions: { value: number; label: string }[];
    /** The newest "ideas:check" result; null before the first one. */
    ideasCheck: IdeasCheck | null;
    filters: QueryParams;
    options: RecipeOptions;
}

export default function RecipesIndex({
    recipes,
    stats,
    unrecognised,
    drinkOptions,
    ideasCheck,
    filters,
    options,
}: RecipesIndexProps) {
    const { currency } = usePage<PageProps>().props.app;
    const [removing, setRemoving] = useState<RecipeRow | null>(null);
    const { values, set, apply, reset } = useFilters(route('recipe.index'), {
        search: filters.search ?? '',
        active: filters.active ?? '1',
        group: filters.group ?? '',
    });

    const choose = (key: keyof typeof values, value: string) => {
        set(key, value);
        apply({ [key]: value });
    };

    const search = (event: FormEvent) => {
        event.preventDefault();
        apply();
    };

    const groupLabel = (key: string) => options.customerGroups.find((group) => group.value === key)?.label ?? key;
    const tierLabel = (key: string | null) => options.priceTiers.find((tier) => tier.value === key)?.label;
    const serveLabel = (key: string) => options.serves.find((serve) => serve.value === key)?.label ?? key;
    /** "Fruit tea · " in front of how it is served; nothing when the kind isn't set. */
    const kindLabel = (key: string | null) => {
        const label = options.categories.find((category) => category.value === key)?.label;
        return label ? `${label} \u00b7 ` : '';
    };
    const filtered = Boolean(filters.search || filters.group);

    return (
        <AppLayout title="Drinks">
            <SurfacePage>
                <PageHeader
                    crumbs={[{ label: 'Home', href: '/index' }, { label: 'Admin' }, { label: 'Drinks' }]}
                    title="Drinks"
                    lede="Drinks outlets could add to their menu, made from catalogue products, each tagged with who it suits. A drink reps have answered on is deactivated, not deleted."
                    actions={
                        <>
                            <Link href={route('recipe.areaRules')} className="rd-btn rd-btn--lg">
                                <i className="mdi mdi-map-marker-radius-outline" aria-hidden="true" />
                                Area rules
                            </Link>
                            <Link href={route('recipe.create')} className="rd-btn rd-btn--primary rd-btn--lg">
                                <i className="mdi mdi-plus" aria-hidden="true" />
                                Add drink
                            </Link>
                        </>
                    }
                />

                <section className="rd-panel rd-panel--flush prod-summary" aria-label="Drinks summary">
                    <div className="prod-summary__cell">
                        <span className="prod-summary__label">Active drinks</span>
                        <span className="prod-summary__value">
                            {stats.active} <span className="rd-kpi__of">of {stats.total}</span>
                        </span>
                    </div>
                    <div className="prod-summary__cell">
                        <span className="prod-summary__label">Outlets with a scanned menu</span>
                        <span className="prod-summary__value">{stats.menus}</span>
                    </div>
                </section>

                <section className="rd-panel rd-panel--flush prod-list" aria-label="Drinks">
                    <nav className="rd-tabs prod-list__tabs" aria-label="Main customers">
                        <button
                            type="button"
                            className={clsx('rd-tabs__tab', values.group === '' && 'is-active')}
                            aria-pressed={values.group === ''}
                            onClick={() => choose('group', '')}
                        >
                            All customers
                        </button>
                        {options.customerGroups.map((group) => (
                            <button
                                key={group.value}
                                type="button"
                                className={clsx('rd-tabs__tab', values.group === group.value && 'is-active')}
                                aria-pressed={values.group === group.value}
                                onClick={() => choose('group', group.value)}
                            >
                                {group.label}
                            </button>
                        ))}
                    </nav>

                    <form className="prod-list__toolbar" role="search" onSubmit={search}>
                        <label className="rd-search">
                            <i className="mdi mdi-magnify" aria-hidden="true" />
                            <input
                                type="search"
                                className="rd-input"
                                aria-label="Search drinks"
                                placeholder="Search by name"
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
                                { value: '0', label: `Inactive ${stats.total - stats.active}` },
                                { value: 'all', label: `All ${stats.total}` },
                            ]}
                        />
                    </form>

                    <div className="rd-scroll">
                        <table className="rd-table rd-table--stack prod-table rcp-table">
                            <thead>
                                <tr>
                                    <th scope="col">Drink</th>
                                    <th scope="col">Main customers</th>
                                    <th scope="col">Price level</th>
                                    <th scope="col" className="num">
                                        Cost per serve ({currency})
                                    </th>
                                    <th scope="col" className="num">
                                        On menus
                                    </th>
                                    <th scope="col">Status</th>
                                    <th scope="col" className="num">
                                        <span className="visually-hidden">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {recipes.map((recipe) => (
                                    <tr key={recipe.id} className={clsx(!recipe.is_active && 'is-inactive')}>
                                        <td className="rd-cell-main">
                                            <div className="prod-table__name">
                                                <Link href={route('recipe.view', recipe.id)}>{recipe.name}</Link>
                                                <span className="prod-table__sub">
                                                    {kindLabel(recipe.category)}
                                                    {serveLabel(recipe.serve)} &middot;{' '}
                                                    {recipe.ingredients.map((ingredient) => ingredient.name).join(', ')}
                                                    {!recipe.is_halal && (
                                                        <span className="rd-chip rd-chip--serious rcp-table__halal">
                                                            Not halal
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </td>
                                        <td data-label="Main customers">
                                            {recipe.customer_groups.length
                                                ? recipe.customer_groups.map(groupLabel).join(', ')
                                                : 'Any'}
                                        </td>
                                        <td data-label="Price level">{tierLabel(recipe.price_tier) ?? 'Any'}</td>
                                        <td className="num" data-label={`Cost per serve (${currency})`}>
                                            {formatMoney(recipe.cost_per_serve)}
                                        </td>
                                        <td className="num" data-label="On menus">
                                            {recipe.on_menus > 0 ? recipe.on_menus : '—'}
                                        </td>
                                        <td data-label="Status">
                                            {recipe.is_active ? (
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
                                        <td className="rd-col-actions">
                                            <div className="prod-table__actions">
                                                <Link
                                                    href={route('recipe.edit', recipe.id)}
                                                    className="rd-btn rd-btn--icon"
                                                    aria-label={`Edit ${recipe.name}`}
                                                    title="Edit"
                                                >
                                                    <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                                                </Link>
                                                {recipe.is_active ? (
                                                    <button
                                                        type="button"
                                                        className="rd-btn rd-btn--icon rd-btn--icon-danger"
                                                        aria-label={`Remove ${recipe.name}`}
                                                        title="Remove"
                                                        onClick={() => setRemoving(recipe)}
                                                    >
                                                        <i className="mdi mdi-delete-outline" aria-hidden="true" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="rd-btn rd-btn--icon rd-btn--icon-good"
                                                        aria-label={`Make ${recipe.name} active again`}
                                                        title="Make active again"
                                                        onClick={() =>
                                                            router.post(
                                                                route('recipe.activate', recipe.id),
                                                                {},
                                                                { preserveScroll: true },
                                                            )
                                                        }
                                                    >
                                                        <i className="mdi mdi-restore" aria-hidden="true" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {recipes.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center py-5 rd-muted">
                                            {filtered ? (
                                                <>
                                                    No drinks match.{' '}
                                                    <button
                                                        type="button"
                                                        className="btn btn-link p-0 align-baseline"
                                                        onClick={reset}
                                                    >
                                                        Clear the filters
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    No drinks yet.{' '}
                                                    <Link href={route('recipe.create')}>Add the first one</Link>.
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="prod-list__foot">
                        <span>{pluralize(recipes.length, 'drink')}</span>
                    </div>
                </section>

                <IdeasCheckPanel check={ideasCheck} />

                {unrecognised.length > 0 && (
                    <section className="rd-panel" aria-labelledby="unrecognised-title">
                        <div>
                            <h2 id="unrecognised-title" className="rd-panel__title">
                                Menu lines we didn&apos;t recognise
                            </h2>
                            <p className="rd-panel__sub">
                                Rows on scanned menus that matched no drink, most common first. If one is a drink you
                                list under another name, add it, and new scans will recognise it.
                            </p>
                        </div>
                        <ul className="menu-rows">
                            {unrecognised.map((row) => (
                                <UnrecognisedRow key={row.text} row={row} drinks={drinkOptions} />
                            ))}
                        </ul>
                    </section>
                )}

                <Dialog
                    show={removing !== null}
                    onHide={() => setRemoving(null)}
                    title={removing ? `Remove ${removing.name}?` : ''}
                    icon="mdi-delete-outline"
                    tone="critical"
                    footer={
                        <>
                            <button type="button" className="rd-btn rd-btn--quiet" onClick={() => setRemoving(null)}>
                                Keep it
                            </button>
                            <button
                                type="button"
                                className="rd-btn rd-btn--danger"
                                onClick={() => {
                                    if (removing) {
                                        router.post(
                                            route('recipe.delete'),
                                            { id: removing.id },
                                            { onFinish: () => setRemoving(null) },
                                        );
                                    }
                                }}
                            >
                                Remove
                            </button>
                        </>
                    }
                >
                    <p>If reps have answered on it, it is deactivated instead of deleted, so their answers keep it.</p>
                </Dialog>
            </SurfacePage>
        </AppLayout>
    );
}
