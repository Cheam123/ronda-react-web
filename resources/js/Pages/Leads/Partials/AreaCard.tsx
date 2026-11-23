import { formatDistance, pluralize } from '@/lib/format';
import type { AreaProfile, AreaTypeShown } from '@/types/leads';

const INCOME = 'Income is the DOSM 2022 district median.';

function sourceNote(area: AreaProfile): string {
    switch (area.source) {
        case 'amazon':
            return `Places within ${formatDistance(area.radius ?? 1000)} come from Amazon Location Service (GrabMaps data). Closer places count more. ${INCOME}`;
        case 'seeded':
            return `Nearby places come from a seeded list for the Klang Valley, not a live lookup, so their distances aren't known and each counts the same. ${INCOME}`;
        case 'district_only':
            return `No nearby places are known for this pin, so only the district is used. ${INCOME}`;
        default:
            return 'Nothing is known about this location yet. Stamping the location on site can help.';
    }
}

/** "3 places, the nearest 400 m away" */
function evidence(count: number, nearest: number | null): string {
    const places = pluralize(count, 'place');
    return nearest === null ? places : `${places}, the nearest ${formatDistance(nearest)} away`;
}

const NOT_KNOWN = <span className="rd-muted">Not known</span>;

/** How strongly a kind of area shows: a chip with words, never colour alone. */
function Level({ type }: { type: AreaTypeShown }) {
    return type.level === 'present' ? (
        <span className="rd-chip rd-chip--good">Present</span>
    ) : (
        <span className="rd-chip">Some presence</span>
    );
}

/** What is known about where an outlet trades, and who it serves. */
export default function AreaCard({ area }: { area: AreaProfile | null }) {
    const customers = area?.customer_groups ?? [];
    const types = area?.types ?? [];
    const places = area?.places ?? [];

    return (
        <section className="rd-panel lead-card">
            <div className="lead-card__head">
                <h2 className="rd-panel__title">Area</h2>
                {area?.mixed_use && <span className="rd-chip rd-chip--brand">Mixed-use</span>}
            </div>
            {area === null ? (
                <p className="rd-muted mb-0">
                    Not looked at yet. It fills in after the outlet&apos;s location is saved.
                </p>
            ) : (
                <>
                    <dl className="rd-facts">
                        <dt>Around it</dt>
                        <dd>
                            {types.length > 0 ? (
                                <ul className="area-types">
                                    {types.map((type) => (
                                        <li key={type.kind} className="area-types__row">
                                            <span className="area-types__name">{type.label}</span>
                                            <Level type={type} />
                                            <span className="area-types__meta">
                                                {type.customers} &middot; {evidence(type.count, type.nearest)}
                                            </span>
                                            {type.note && <span className="area-types__note">{type.note}</span>}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                NOT_KNOWN
                            )}
                        </dd>
                        <dt>Cafés and restaurants</dt>
                        <dd>
                            {area.competitors && area.competitors.count > 0
                                ? `${evidence(area.competitors.count, area.competitors.nearest)}. They're competition, not customers.`
                                : area.source === 'amazon'
                                  ? 'None mapped nearby.'
                                  : NOT_KNOWN}
                        </dd>
                        <dt>Customers</dt>
                        <dd>
                            {customers.length > 0 ? (
                                <>
                                    <span className="lead-reasons">
                                        {customers.map((group) => (
                                            <span key={group} className="rd-chip">
                                                {group}
                                            </span>
                                        ))}
                                    </span>
                                    <span className="lead-profile__note d-block mt-1">
                                        {area.customers_from === 'rep'
                                            ? "The rep's answer on the outlet form."
                                            : 'From what is around it. The rep can name the main customers on the outlet form.'}
                                    </span>
                                </>
                            ) : (
                                NOT_KNOWN
                            )}
                        </dd>
                        <dt>District</dt>
                        <dd>{area.district ?? NOT_KNOWN}</dd>
                        <dt>Income group</dt>
                        <dd>{area.income_group ?? NOT_KNOWN}</dd>
                    </dl>
                    {places.length > 0 && (
                        <details className="area-places">
                            <summary>Nearest places ({places.length})</summary>
                            <ul>
                                {places.map((place, index) => (
                                    <li key={`${place.label}-${place.name ?? ''}-${index}`}>
                                        <span className="area-places__what">
                                            {place.label}
                                            {place.name && <span className="rd-muted"> &middot; {place.name}</span>}
                                        </span>
                                        {place.distance !== null && (
                                            <span className="area-places__far">{formatDistance(place.distance)}</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                    <p className="lead-profile__note">{sourceNote(area)}</p>
                </>
            )}
        </section>
    );
}
