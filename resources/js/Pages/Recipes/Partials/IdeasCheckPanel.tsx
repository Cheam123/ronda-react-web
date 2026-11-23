import { router } from '@inertiajs/react';
import { useState } from 'react';
import type { IdeasCheck, IdeasFit } from '@/types/catalogue';

const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);

const WHEN = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
});

/**
 * "How the drink ideas behave": the newest ideas check across every outlet,
 * and what reps answered. Fit is how well the top ideas meet what the owner
 * said and suit the places around them, next to two simple ways of picking.
 */
export default function IdeasCheckPanel({ check }: { check: IdeasCheck | null }) {
    const [running, setRunning] = useState(false);

    const run = () =>
        router.post(
            route('recipe.ideasCheck'),
            {},
            { preserveScroll: true, onStart: () => setRunning(true), onFinish: () => setRunning(false) },
        );

    return (
        <section className="rd-panel ideas-check" aria-labelledby="ideas-check-title">
            <div className="ideas-check__head">
                <div>
                    <h2 id="ideas-check-title" className="rd-panel__title">
                        How the drink ideas behave
                    </h2>
                    <p className="rd-panel__sub">
                        {check
                            ? `Checked across ${check.outlets} outlets on ${WHEN.format(new Date(check.checked_at))}.`
                            : 'Run a check to see how the ideas behave across every outlet.'}
                    </p>
                </div>
                <button type="button" className="rd-btn rd-btn--sm" disabled={running} onClick={run}>
                    <i className="mdi mdi-refresh" aria-hidden="true" />
                    {running ? 'Checking…' : check ? 'Check again' : 'Run the check'}
                </button>
            </div>

            {check && (
                <>
                    <dl className="ideas-check__stats">
                        <div>
                            <dt>Outlets with ideas</dt>
                            <dd>
                                {check.with_ideas} <span className="rd-muted">of {check.outlets}</span>
                            </dd>
                        </div>
                        <div>
                            <dt>Drinks suggested</dt>
                            <dd>
                                {check.drinks_suggested} <span className="rd-muted">of {check.drinks_active}</span>
                            </dd>
                        </div>
                        <div>
                            <dt>Needs change the ideas</dt>
                            <dd>{pct(check.needs.changed)}</dd>
                        </div>
                        <div>
                            <dt>Accepted, of decided</dt>
                            <dd>{pct(check.answers.acceptance)}</dd>
                        </div>
                    </dl>

                    <table className="rd-table ideas-check__fit">
                        <caption>Fit, from 0 to 100%</caption>
                        <thead>
                            <tr>
                                <th scope="col">How well the ideas match</th>
                                <th scope="col">Top 3 ideas</th>
                                <th scope="col">Drinks for the outlet type</th>
                                <th scope="col">Any drink</th>
                            </tr>
                        </thead>
                        <tbody>
                            <FitRow label="What the owner said" fit={check.needs} />
                            <FitRow label="The places around them" fit={check.area} />
                        </tbody>
                    </table>

                    <div className="ideas-check__lists">
                        <div>
                            <h3 className="ideas-check__subtitle">Suggested most</h3>
                            <ul className="menu-rows">
                                {check.top_drinks.map((drink) => (
                                    <li key={drink.name}>
                                        <span className="menu-rows__drink">{drink.name}</span>
                                        <span className="menu-rows__text">{pct(drink.share)} of outlets</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h3 className="ideas-check__subtitle">What reps answered</h3>
                            <p className="ideas-check__answers">
                                {check.answers.pitched} pitched, {check.answers.accepted} accepted,{' '}
                                {check.answers.declined} declined
                            </p>
                            {Object.keys(check.answers.reasons).length > 0 && (
                                <ul className="menu-rows">
                                    {Object.entries(check.answers.reasons).map(([label, count]) => (
                                        <li key={label}>
                                            <span className="menu-rows__drink">{label}</span>
                                            <span className="menu-rows__text">{count} declined</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <p className="ideas-check__note">
                        Fit shows the ideas follow what is known about each outlet, not that outlets will buy them. Only
                        the reps&apos; answers show that, and on a demo database there are almost none.
                    </p>
                </>
            )}
        </section>
    );
}

function FitRow({ label, fit }: { label: string; fit: IdeasFit }) {
    return (
        <tr>
            <th scope="row">
                {label} <span className="rd-muted">({fit.outlets} outlets)</span>
            </th>
            <td>
                <strong>{pct(fit.engine)}</strong>
            </td>
            <td>{pct(fit.same_type)}</td>
            <td>{pct(fit.random)}</td>
        </tr>
    );
}
