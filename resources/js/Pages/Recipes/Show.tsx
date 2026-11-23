import { Link, router, usePage } from '@inertiajs/react';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import { formatMoney, pluralize } from '@/lib/format';
import type { PageProps } from '@/types';
import type { Recipe, RecipeOptions } from '@/types/catalogue';

interface RecipeShowProps {
    recipe: Recipe & { id: number; name: string };
    feedback: { pitched: number; accepted: number; declined: number; reasons: { reason: string; count: number }[] };
    options: RecipeOptions;
}

export default function RecipeShow({ recipe, feedback, options }: RecipeShowProps) {
    const { currency } = usePage<PageProps>().props.app;
    const groupLabel = (key: string) => options.customerGroups.find((group) => group.value === key)?.label ?? key;
    const serve = options.serves.find((option) => option.value === recipe.serve)?.label ?? recipe.serve;
    const tier = options.priceTiers.find((option) => option.value === recipe.price_tier)?.label ?? 'Any';
    const types = recipe.outlet_types.map((id) => options.typeLabels[id] ?? String(id));
    const answered = feedback.pitched + feedback.accepted + feedback.declined;

    return (
        <AppLayout title={recipe.name}>
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Admin' },
                        { label: 'Drinks', href: route('recipe.index') },
                        { label: recipe.name },
                    ]}
                    title={recipe.name}
                    lede={recipe.description ?? undefined}
                    actions={
                        <>
                            {!recipe.is_active && (
                                <button
                                    type="button"
                                    className="rd-btn rd-btn--lg"
                                    onClick={() => router.post(route('recipe.activate', recipe.id))}
                                >
                                    <i className="mdi mdi-restore" aria-hidden="true" />
                                    Make active again
                                </button>
                            )}
                            <Link href={route('recipe.edit', recipe.id)} className="rd-btn rd-btn--primary rd-btn--lg">
                                <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                                Edit drink
                            </Link>
                        </>
                    }
                />

                <div className="rd-grid">
                    <div className="rd-span-8 d-flex flex-column gap-4">
                        <section className="rd-panel" aria-labelledby="recipe-title">
                            <div className="d-flex align-items-start justify-content-between gap-3">
                                <div>
                                    <h2 id="recipe-title" className="rd-panel__title">
                                        Recipe, per serve
                                    </h2>
                                    <p className="rd-panel__sub">
                                        {serve} &middot; {pluralize(recipe.ingredients.length, 'product')} &middot;{' '}
                                        {currency} {formatMoney(recipe.cost_per_serve)} of ingredients
                                    </p>
                                </div>
                                {recipe.is_halal ? (
                                    <span className="rd-chip rd-chip--good">
                                        <i className="mdi mdi-check" aria-hidden="true" />
                                        Halal
                                    </span>
                                ) : (
                                    <span className="rd-chip rd-chip--serious">
                                        <i className="mdi mdi-alert-outline" aria-hidden="true" />
                                        Not halal
                                    </span>
                                )}
                            </div>
                            <table className="rd-table rcp-recipe">
                                <thead>
                                    <tr>
                                        <th scope="col">Product</th>
                                        <th scope="col">Amount</th>
                                        <th scope="col" className="num">
                                            Cost ({currency})
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recipe.ingredients.map((ingredient) => (
                                        <tr key={ingredient.product_id}>
                                            <td>
                                                <Link href={route('product.view', ingredient.product_id)}>
                                                    {ingredient.name}
                                                </Link>
                                                {!ingredient.is_active && (
                                                    <span className="rd-chip ms-2">Inactive</span>
                                                )}
                                                {ingredient.is_halal === false && (
                                                    <span className="rd-chip rd-chip--serious ms-2">Not halal</span>
                                                )}
                                            </td>
                                            <td>
                                                {ingredient.amount_label ?? '—'}{' '}
                                                <span className="rd-muted">
                                                    ({ingredient.quantity} {ingredient.unit})
                                                </span>
                                            </td>
                                            <td className="num">
                                                {formatMoney(ingredient.quantity * ingredient.unit_price)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {!recipe.is_halal && (
                                <p className="rd-status rd-status--serious">
                                    <i className="mdi mdi-information-outline" aria-hidden="true" />
                                    Not halal: one or more of its products is marked not halal.
                                </p>
                            )}
                        </section>
                    </div>

                    <aside className="rd-span-4 d-flex flex-column gap-4">
                        <section className="rd-panel" aria-labelledby="menu-title">
                            <h2 id="menu-title" className="rd-panel__title">
                                On a menu
                            </h2>
                            <dl className="rcp-summary">
                                <dt>Kind of drink</dt>
                                <dd>
                                    {options.categories.find((option) => option.value === recipe.category)?.label ??
                                        'Not set'}
                                </dd>
                                <dt>Other names</dt>
                                <dd>{recipe.aliases.length ? recipe.aliases.join(', ') : 'None'}</dd>
                            </dl>
                        </section>

                        <section className="rd-panel" aria-labelledby="suits-title">
                            <h2 id="suits-title" className="rd-panel__title">
                                Who it suits
                            </h2>
                            <dl className="rcp-summary">
                                <dt>Main customers</dt>
                                <dd>
                                    {recipe.customer_groups.length
                                        ? recipe.customer_groups.map(groupLabel).join(', ')
                                        : 'Any'}
                                </dd>
                                <dt>Types of outlet</dt>
                                <dd>{types.length ? types.join(', ') : 'Any'}</dd>
                                <dt>Price level</dt>
                                <dd>{tier}</dd>
                                <dt>Status</dt>
                                <dd>{recipe.is_active ? 'Active' : 'Inactive'}</dd>
                            </dl>
                        </section>

                        <section className="rd-panel" aria-labelledby="answers-title">
                            <div>
                                <h2 id="answers-title" className="rd-panel__title">
                                    What reps said
                                </h2>
                                <p className="rd-panel__sub">Each outlet&apos;s latest answer on this drink</p>
                            </div>
                            {answered === 0 ? (
                                <p className="rd-muted mb-0">No answers yet.</p>
                            ) : (
                                <>
                                    <dl className="rcp-summary">
                                        <dt>Pitched</dt>
                                        <dd>{feedback.pitched}</dd>
                                        <dt>Accepted</dt>
                                        <dd>{feedback.accepted}</dd>
                                        <dt>Declined</dt>
                                        <dd>{feedback.declined}</dd>
                                    </dl>
                                    {feedback.reasons.length > 0 && (
                                        <>
                                            <h3 className="rcp-subhead">Why it was declined</h3>
                                            <ul className="rcp-reasons">
                                                {feedback.reasons.map((row) => (
                                                    <li key={row.reason}>
                                                        <span>{row.reason}</span>
                                                        <span className="rd-muted">{row.count}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </>
                                    )}
                                </>
                            )}
                        </section>
                    </aside>
                </div>
            </SurfacePage>
        </AppLayout>
    );
}
