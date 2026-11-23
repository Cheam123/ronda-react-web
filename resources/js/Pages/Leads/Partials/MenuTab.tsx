import { Link, router, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useRef, useState } from 'react';
import { formatMoney, listWords, pluralize } from '@/lib/format';
import { errorMessage, postJson } from '@/lib/http';
import type { ApiEnvelope, PageProps, SelectOption } from '@/types';
import type { DrinkIdeas, FeedbackStatus, IdeaAnswers, MenuIdea, MenuItem, MenuScan, OutletMenu } from '@/types/leads';
import { DeclineReasons, OutcomeButtons } from './SuggestionOutcome';

const SERVE: Record<MenuIdea['serve'], string> = { hot: 'Hot', iced: 'Iced', either: 'Hot or iced' };

/** Reasons shown on a card before "more reasons"; the strongest come first. */
const REASONS_SHOWN = 3;

/** How a menu got here, for "Read from photos on 14 Nov 2026". */
const SOURCE_WORDS: Record<MenuScan['source'], string> = {
    phone: 'Scanned with the app',
    typed: 'Typed in',
    textract: 'Read from photos',
};

/** Photos of one menu read at a time, as on the phone. */
const MAX_PHOTOS = 4;

interface MenuTabProps {
    /** The outlet's drink ideas as they stand now, with or without a menu. */
    ideas: DrinkIdeas;
    /** The outlet's newest confirmed menu scan; null before the first one. */
    menu: OutletMenu | null;
    /** Drinks a row the reader didn't recognise can be named as. */
    drinks: SelectOption<number>[];
    /** Whether menu photos can be uploaded: Amazon Textract is set up on the server. */
    canReadPhotos: boolean;
    leadId: number;
    canOrder: boolean;
}

/** What the rep changed on a draft: rows to drop, and rows named as a drink. */
type Changes = Record<number, { kept?: boolean; recipe_id?: number | null }>;

/**
 * An outlet's drink ideas, and the drinks menu they use when there is one. The
 * ideas come from the menu, what the owner told the rep and the places around
 * the outlet. A menu is scanned with the mobile app, uploaded as photos (read
 * by Amazon Textract), or typed in here; either way it is checked before it counts.
 */
export default function MenuTab({ ideas, menu, drinks, canReadPhotos, leadId, canOrder }: MenuTabProps) {
    const { currency } = usePage<PageProps>().props.app;
    const [typing, setTyping] = useState(false);
    const [text, setText] = useState('');
    const [draft, setDraft] = useState<MenuScan | null>(null);
    const [changes, setChanges] = useState<Changes>({});
    const [busy, setBusy] = useState(false);
    const [readingPhotos, setReadingPhotos] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [answers, setAnswers] = useState<IdeaAnswers>(ideas.answers);
    const [saving, setSaving] = useState<number | null>(null);
    const photoInput = useRef<HTMLInputElement>(null);

    const readPhotos = async (files: File[]) => {
        if (files.length === 0) return;
        if (files.length > MAX_PHOTOS) {
            setError(`Choose up to ${MAX_PHOTOS} photos of one menu.`);
            return;
        }
        const form = new FormData();
        files.forEach((file) => form.append('file[]', file));
        setReadingPhotos(true);
        setError(null);
        try {
            const response = await postJson<ApiEnvelope<{ scan: MenuScan }>>(route('lead.menuScans.store', leadId), form);
            setDraft(response.data?.scan ?? null);
            setChanges({});
        } catch (caught) {
            setError(errorMessage(caught, 'The photos could not be read. Please try again.'));
        } finally {
            setReadingPhotos(false);
        }
    };

    const read = async () => {
        setBusy(true);
        setError(null);
        try {
            const response = await postJson<ApiEnvelope<{ scan: MenuScan }>>(route('lead.menuScans.store', leadId), {
                text,
            });
            setDraft(response.data?.scan ?? null);
            setChanges({});
            setTyping(false);
        } catch (caught) {
            setError(errorMessage(caught, 'The menu could not be read. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const confirm = async () => {
        if (!draft) return;
        setBusy(true);
        setError(null);
        try {
            await postJson(route('lead.menuScans.confirm', draft.id), {
                items: Object.entries(changes).map(([id, change]) => ({ id: Number(id), ...change })),
            });
            setDraft(null);
            setText('');
            // The page's own props carry the menu and the ideas; the tab remounts on the new scan.
            router.reload({ only: ['menu', 'drinkIdeas'] });
        } catch (caught) {
            setError(errorMessage(caught, 'The menu could not be saved. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const answer = async (recipeId: number, status: FeedbackStatus | 'cleared', reason?: string) => {
        setSaving(recipeId);
        setError(null);
        try {
            const response = await postJson<ApiEnvelope<IdeaAnswers>>(route('lead.recommendations.feedback', leadId), {
                recipe_id: recipeId,
                menu_scan_id: ideas.menu_scan_id,
                status,
                reason,
            });
            if (response.data) setAnswers(response.data);
        } catch (caught) {
            setError(errorMessage(caught, 'Your answer could not be saved. Please try again.'));
        } finally {
            setSaving(null);
        }
    };

    if (draft) {
        return (
            <div className="menu-tab">
                <Check draft={draft} drinks={drinks} changes={changes} onChange={setChanges} />
                {error && (
                    <p className="rd-status rd-status--critical" role="alert">
                        {error}
                    </p>
                )}
                <div className="menu-tab__actions">
                    <button type="button" className="rd-btn rd-btn--primary" disabled={busy} onClick={confirm}>
                        {busy ? 'Saving…' : 'Save menu'}
                    </button>
                    <button type="button" className="rd-btn" disabled={busy} onClick={() => setDraft(null)}>
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    if (typing) {
        return (
            <div className="menu-tab">
                <div className="rd-field">
                    <label className="rd-field__label" htmlFor="menu-text">
                        The drinks menu
                    </label>
                    <textarea
                        id="menu-text"
                        className="rd-input"
                        rows={10}
                        placeholder={'Latte 10\nIced Vanilla Latte 12\nMatcha Latte 13'}
                        value={text}
                        aria-describedby="menu-text-help"
                        onChange={(event) => setText(event.target.value)}
                    />
                    <span className="rd-field__hint" id="menu-text-help">
                        One drink per line, with its price if you have it. You check what was found before it is saved.
                    </span>
                </div>
                {error && (
                    <p className="rd-status rd-status--critical" role="alert">
                        {error}
                    </p>
                )}
                <div className="menu-tab__actions">
                    <button
                        type="button"
                        className="rd-btn rd-btn--primary"
                        disabled={busy || text.trim() === ''}
                        onClick={read}
                    >
                        {busy ? 'Reading…' : 'Read menu'}
                    </button>
                    <button type="button" className="rd-btn" disabled={busy} onClick={() => setTyping(false)}>
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    const onMenu = menu ? menu.matched.filter((item) => item.kept) : [];

    return (
        <div className="menu-tab">
            {error && (
                <p className="rd-status rd-status--critical" role="alert">
                    {error}
                </p>
            )}

            <section aria-labelledby="menu-ideas-title">
                <h3 id="menu-ideas-title" className="menu-tab__title">
                    Drink ideas <span className="rd-muted">{ideas.ideas.length}</span>
                </h3>
                {ideas.based_on.length > 0 && (
                    <p className="lead-activity__note">Based on {listWords(ideas.based_on)}.</p>
                )}
                {ideas.ideas.length === 0 ? (
                    <p className="lead-activity__note">
                        {ideas.based_on.length === 0
                            ? 'Too little is known about this outlet for drink ideas yet. Fill in what the outlet needs, or add its menu.'
                            : 'No drink ideas right now. None of the drinks suits this outlet well enough, or the ones that would were declined lately.'}
                    </p>
                ) : (
                    <div className="menu-ideas">
                        {ideas.ideas.map((idea) => (
                            <IdeaCard
                                key={idea.recipe_id}
                                idea={idea}
                                leadId={leadId}
                                canOrder={canOrder}
                                currency={currency}
                                status={answers.drink_feedback[idea.recipe_id]}
                                reason={answers.drink_reasons[idea.recipe_id]}
                                declineReasons={ideas.decline_reasons}
                                busy={saving === idea.recipe_id}
                                onAnswer={(status, reason) => answer(idea.recipe_id, status, reason)}
                            />
                        ))}
                    </div>
                )}
            </section>

            <section aria-labelledby="menu-on-title">
                <div className="menu-tab__head">
                    <h3 id="menu-on-title" className="menu-tab__title">
                        Their menu {menu && <span className="rd-muted">{onMenu.length}</span>}
                    </h3>
                    <div className="menu-tab__add">
                        {canReadPhotos && (
                            <>
                                <input
                                    ref={photoInput}
                                    type="file"
                                    accept="image/jpeg,image/png"
                                    multiple
                                    hidden
                                    onChange={(event) => {
                                        const files = Array.from(event.target.files ?? []);
                                        event.target.value = '';
                                        void readPhotos(files);
                                    }}
                                />
                                <button
                                    type="button"
                                    className="rd-btn rd-btn--sm"
                                    disabled={readingPhotos}
                                    onClick={() => photoInput.current?.click()}
                                >
                                    <i className="mdi mdi-camera-outline" aria-hidden="true" />
                                    {readingPhotos ? 'Reading the photos…' : 'Add from photos'}
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            className="rd-btn rd-btn--sm"
                            disabled={readingPhotos}
                            onClick={() => setTyping(true)}
                        >
                            <i className="mdi mdi-keyboard-outline" aria-hidden="true" />
                            {menu ? 'Add a newer menu by typing' : 'Add a menu by typing'}
                        </button>
                    </div>
                </div>
                {readingPhotos && (
                    <p className="rd-status" role="status">
                        Amazon Textract is reading the photos. This can take up to half a minute.
                    </p>
                )}
                <p className="lead-activity__note">
                    {menu
                        ? `${SOURCE_WORDS[menu.source]} on ${menu.scanned_label}${menu.scanned_by ? ` by ${menu.scanned_by}` : ''}${
                              menu.price_label && menu.median_price !== null
                                  ? `. ${menu.price_label} prices: the middle drink is ${currency} ${formatMoney(menu.median_price)}.`
                                  : '. No prices were read.'
                          }`
                        : `No menu yet. Scan the drinks menu with the mobile app on your next visit, or ${canReadPhotos ? 'add photos of it or ' : ''}type it in here. With a menu, the ideas leave out drinks they already sell.`}
                </p>
                {!menu ? null : onMenu.length === 0 ? (
                    <p className="lead-activity__note">None of your drinks were found on this menu.</p>
                ) : (
                    <ul className="menu-rows">
                        {onMenu.map((item) => (
                            <li key={item.id}>
                                <span className="menu-rows__drink">{item.drink}</span>
                                <span className="menu-rows__text">{item.text}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {menu && menu.unrecognised.length > 0 && (
                <section aria-labelledby="menu-unknown-title">
                    <h3 id="menu-unknown-title" className="menu-tab__title">
                        Not recognised <span className="rd-muted">{menu.unrecognised.length}</span>
                    </h3>
                    <p className="lead-activity__note">
                        Rows with a price that match none of your drinks: drinks you don&apos;t list, or food.
                    </p>
                    <ul className="menu-rows">
                        {menu.unrecognised.map((item) => (
                            <li key={item.id}>
                                <span className="menu-rows__text">{item.text}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {menu && menu.photos.length > 0 && (
                <section aria-labelledby="menu-photos-title">
                    <h3 id="menu-photos-title" className="menu-tab__title">
                        Photos
                    </h3>
                    <ul className="menu-photos">
                        {menu.photos.map((photo, index) => (
                            <li key={photo.id}>
                                <a href={photo.url} target="_blank" rel="noreferrer">
                                    <img src={photo.url} alt={`Menu photo ${index + 1}`} loading="lazy" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

/** The draft: what was found, for the rep to correct before it is saved. */
function Check({
    draft,
    drinks,
    changes,
    onChange,
}: {
    draft: MenuScan;
    drinks: SelectOption<number>[];
    changes: Changes;
    onChange: (next: Changes) => void;
}) {
    const set = (item: MenuItem, change: Changes[number]) =>
        onChange({ ...changes, [item.id]: { ...changes[item.id], ...change } });

    return (
        <>
            {draft.photos.length > 0 && (
                <section aria-labelledby="menu-check-photos-title">
                    <h3 id="menu-check-photos-title" className="menu-tab__title">
                        The photos
                    </h3>
                    <ul className="menu-photos">
                        {draft.photos.map((photo, index) => (
                            <li key={photo.id}>
                                <a href={photo.url} target="_blank" rel="noreferrer">
                                    <img src={photo.url} alt={`Menu photo ${index + 1}`} />
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {draft.lines.length > 0 && (
                <details className="menu-lines">
                    <summary>
                        Everything that was read <span className="rd-muted">{pluralize(draft.lines.length, 'line')}</span>
                    </summary>
                    <ol>
                        {draft.lines.map((line, index) => (
                            <li key={index}>{line}</li>
                        ))}
                    </ol>
                </details>
            )}

            <section aria-labelledby="menu-check-title">
                <h3 id="menu-check-title" className="menu-tab__title">
                    Check what was found
                </h3>
                <p className="lead-activity__note">
                    Untick a drink that isn&apos;t really on their menu. Nothing is saved until you choose Save menu.
                </p>
                {draft.matched.length === 0 ? (
                    <p className="lead-activity__note">None of your drinks were found.</p>
                ) : (
                    <ul className="menu-rows menu-rows--check">
                        {draft.matched.map((item) => (
                            <li key={item.id}>
                                <label>
                                    <input
                                        type="checkbox"
                                        className="rd-check"
                                        checked={changes[item.id]?.kept ?? item.kept}
                                        onChange={(event) => set(item, { kept: event.target.checked })}
                                    />
                                    <span className="menu-rows__drink">{item.drink}</span>
                                </label>
                                <span className="menu-rows__text">{item.text}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {draft.unrecognised.length > 0 && (
                <section aria-labelledby="menu-check-unknown-title">
                    <h3 id="menu-check-unknown-title" className="menu-tab__title">
                        Not recognised
                    </h3>
                    <p className="lead-activity__note">
                        If one of these is a drink you list under another name, say which. Leave the rest.
                    </p>
                    <ul className="menu-rows menu-rows--check">
                        {draft.unrecognised.map((item) => (
                            <li key={item.id}>
                                <span className="menu-rows__text">{item.text}</span>
                                <select
                                    className="rd-input rd-input--md menu-rows__pick"
                                    aria-label={`Which drink is "${item.text}"?`}
                                    value={changes[item.id]?.recipe_id ?? ''}
                                    onChange={(event) =>
                                        set(item, { recipe_id: event.target.value ? Number(event.target.value) : null })
                                    }
                                >
                                    <option value="">Not one of our drinks</option>
                                    {drinks.map((drink) => (
                                        <option key={drink.value} value={drink.value}>
                                            {drink.label}
                                        </option>
                                    ))}
                                </select>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
}

/** One drink idea: why it suits, what it needs, and what the rep did with it. */
function IdeaCard({
    idea,
    leadId,
    canOrder,
    currency,
    status,
    reason,
    declineReasons,
    busy,
    onAnswer,
}: {
    idea: MenuIdea;
    leadId: number;
    canOrder: boolean;
    currency: string;
    status: FeedbackStatus | undefined;
    reason: string | undefined;
    declineReasons: Record<string, string>;
    busy: boolean;
    onAnswer: (status: FeedbackStatus | 'cleared', reason?: string) => void;
}) {
    const [allReasons, setAllReasons] = useState(false);
    const toOrder = idea.products.filter((product) => !product.already_buys);
    const has = idea.products.filter((product) => product.already_buys);
    const orderHref = route('lead.orders.create', {
        id: leadId,
        suggested: toOrder.map((product) => `${product.product_id}:${product.quantity}`).join(','),
    });

    return (
        <article
            className={clsx('drink-card', status === 'declined' && 'drink-card--declined')}
            aria-labelledby={`idea-${idea.recipe_id}`}
        >
            <div className="drink-card__head">
                <div className="d-flex flex-column gap-1">
                    <h4 id={`idea-${idea.recipe_id}`} className="drink-card__name m-0">
                        {idea.name}
                    </h4>
                    <span className="drink-card__meta">
                        {SERVE[idea.serve]} &middot; {currency} {formatMoney(idea.cost_per_serve)} of ingredients per
                        serve
                    </span>
                </div>
            </div>
            {idea.description && <p className="drink-card__description">{idea.description}</p>}
            {idea.reasons.length > 0 && (
                <ul className="menu-reasons" id={`idea-${idea.recipe_id}-reasons`}>
                    {(allReasons ? idea.reasons : idea.reasons.slice(0, REASONS_SHOWN)).map((text) => (
                        <li key={text}>
                            <i className="mdi mdi-check" aria-hidden="true" />
                            {text}
                        </li>
                    ))}
                </ul>
            )}
            {idea.reasons.length > REASONS_SHOWN && (
                <button
                    type="button"
                    className="menu-reasons__more"
                    aria-expanded={allReasons}
                    aria-controls={`idea-${idea.recipe_id}-reasons`}
                    onClick={() => setAllReasons(!allReasons)}
                >
                    {allReasons ? 'Fewer reasons' : `${idea.reasons.length - REASONS_SHOWN} more reasons`}
                </button>
            )}
            {has.length > 0 && (
                <p className="drink-card__has">
                    <span>Already buys</span> {has.map((product) => product.name).join(', ')}
                </p>
            )}
            {toOrder.length > 0 && (
                <p className="drink-card__needs">
                    <span>Needs</span>{' '}
                    {toOrder.map((product, index) => (
                        <span key={product.product_id}>
                            {index > 0 && ', '}
                            {product.name}{' '}
                            <span className="rd-muted">
                                ({product.quantity} {product.unit} a month)
                            </span>
                        </span>
                    ))}
                </p>
            )}
            {toOrder.length === 0 && (
                <p className="drink-card__needs">
                    <span>Needs</span> nothing new. They already buy everything it takes.
                </p>
            )}
            <div className="drink-card__foot">
                {canOrder && toOrder.length > 0 && (
                    <Link href={orderHref} className="rd-btn rd-btn--sm">
                        <i className="mdi mdi-cart-plus" aria-hidden="true" />
                        Order {pluralize(toOrder.length, 'product')}
                    </Link>
                )}
                {toOrder.length > 0 && (
                    <span className="drink-card__meta">
                        About {currency} {formatMoney(idea.est_monthly_value)} a month to start
                    </span>
                )}
            </div>
            <OutcomeButtons name={idea.name} status={status} busy={busy} onPick={(next) => onAnswer(next)} />
            {status === 'declined' && (
                <DeclineReasons
                    name={idea.name}
                    reasons={declineReasons}
                    value={reason}
                    busy={busy}
                    onPick={(picked) => onAnswer('declined', picked)}
                />
            )}
        </article>
    );
}
