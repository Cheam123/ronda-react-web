import { Link, useForm } from '@inertiajs/react';
import clsx from 'clsx';
import type { FormEvent, ReactNode } from 'react';
import { MultiChoices } from '@/Components/surface/MultiChoices';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import AppLayout from '@/Layouts/AppLayout';
import { formatDistance, listWords } from '@/lib/format';
import type { AreaRuleRow, AreaScoring } from '@/types/catalogue';

interface AreaRulesProps {
    rules: AreaRuleRow[];
    scoring: AreaScoring;
    options: {
        categories: { value: string; label: string }[];
        priceTiers: { value: string; label: string }[];
    };
}

type Field = 'categories' | 'price_tiers' | 'note';

function Section({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
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

/** Admin > Drinks > Area rules: which drinks suit each kind of area around an outlet. */
export default function AreaRules({ rules, scoring, options }: AreaRulesProps) {
    const { data, setData, post, processing, errors, isDirty } = useForm({
        rules: rules.map(({ kind, categories, price_tiers, note }) => ({ kind, categories, price_tiers, note })),
    });

    useUnsavedChanges(isDirty, 'the area rules');

    const change = (index: number, field: Field, value: string[] | string) =>
        setData(
            'rules',
            data.rules.map((rule, at) => (at === index ? { ...rule, [field]: value } : rule)),
        );
    const errorFor = (index: number, field: Field) =>
        (errors as Record<string, string | undefined>)[`rules.${index}.${field}`];

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        post(route('recipe.areaRules.update'), { preserveScroll: true });
    };

    return (
        <AppLayout title="Area rules">
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Admin' },
                        { label: 'Drinks', href: route('recipe.index') },
                        { label: 'Area rules' },
                    ]}
                    title="Area rules"
                    lede={`What suits each kind of area around an outlet. When a menu is scanned, drinks that fit the areas within ${formatDistance(scoring.radius)} rank higher. These are starting guesses to guide the ideas, not measured facts, so change them as reps learn what sells.`}
                />

                <div className="rd-grid">
                    <form className="rd-panel rd-panel--flush rd-span-8 prod-form" onSubmit={submit} noValidate>
                        {rules.map((rule, index) => {
                            const noteError = errorFor(index, 'note');
                            const noteId = `note-${rule.kind}`;

                            return (
                                <Section
                                    key={rule.kind}
                                    title={rule.label}
                                    intro={
                                        <>
                                            {rule.customers && <strong className="d-block">{rule.customers}</strong>}
                                            Made up of {listWords(rule.places.map((place) => place.toLowerCase()))}{' '}
                                            nearby.
                                        </>
                                    }
                                >
                                    <MultiChoices
                                        legend="Kinds of drink that suit it"
                                        hint="None chosen means any kind."
                                        options={options.categories}
                                        value={data.rules[index].categories}
                                        error={errorFor(index, 'categories')}
                                        onChange={(value) => change(index, 'categories', value)}
                                    />
                                    <MultiChoices
                                        legend="Price levels that suit it"
                                        hint="None chosen means any price."
                                        options={options.priceTiers}
                                        value={data.rules[index].price_tiers}
                                        error={errorFor(index, 'price_tiers')}
                                        onChange={(value) => change(index, 'price_tiers', value)}
                                    />
                                    <div className="rd-field">
                                        <label className="rd-field__label" htmlFor={noteId}>
                                            What the area is like
                                        </label>
                                        <input
                                            id={noteId}
                                            className={clsx('rd-input', noteError && 'is-invalid')}
                                            value={data.rules[index].note}
                                            maxLength={200}
                                            onChange={(event) => change(index, 'note', event.target.value)}
                                            aria-invalid={Boolean(noteError)}
                                            aria-describedby={`${noteId}-help`}
                                        />
                                        {noteError ? (
                                            <span className="rd-field__error" id={`${noteId}-help`}>
                                                {noteError}
                                            </span>
                                        ) : (
                                            <span className="rd-field__hint" id={`${noteId}-help`}>
                                                Optional. Shown on the outlet&apos;s area card.
                                            </span>
                                        )}
                                    </div>
                                </Section>
                            );
                        })}

                        <div className="prod-form__foot">
                            <Link href={route('recipe.index')} className="rd-btn rd-btn--quiet rd-btn--lg">
                                Back to drinks
                            </Link>
                            <span className="flex-grow-1" />
                            <button
                                type="submit"
                                className="rd-btn rd-btn--primary rd-btn--lg"
                                disabled={processing || !isDirty}
                            >
                                {processing && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                                Save rules
                            </button>
                        </div>
                    </form>

                    <aside className="rd-span-4 d-flex flex-column gap-4">
                        <section className="rd-panel" aria-labelledby="scoring-title">
                            <h2 id="scoring-title" className="rd-panel__title">
                                How the area is scored
                            </h2>
                            <ol className="area-steps">
                                <li>
                                    Places within {formatDistance(scoring.radius)} of the outlet are found with
                                    Amazon Location Service and grouped into these kinds of area. Cafés and restaurants count as
                                    competition, not as an area.
                                </li>
                                <li>
                                    Closer places count more. A place 200 m away counts about twice as much as one 600 m
                                    away.
                                </li>
                                <li>
                                    A kind of area with at least {scoring.present}% of the places is{' '}
                                    <strong>present</strong>. From {scoring.some}% it has <strong>some presence</strong>
                                    .
                                </li>
                                <li>
                                    A drink fits an area when its customers include the area&apos;s, and its kind and
                                    price level are ones chosen here. That fit counts double in a drink idea&apos;s
                                    score.
                                </li>
                            </ol>
                        </section>
                    </aside>
                </div>
            </SurfacePage>
        </AppLayout>
    );
}
