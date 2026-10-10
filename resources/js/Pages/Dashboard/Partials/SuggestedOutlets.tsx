import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import Initials from '@/Components/surface/Initials';
import { formatMoney } from '@/lib/format';
import type { SuggestedOutlets as Suggestions } from '../types';

interface SuggestedOutletsProps {
    suggestions: Suggestions;
    currency: string;
    className?: string;
}

/** "Oat Milk, Hazelnut Syrup and 1 more" */
function productLine(products: string[], count: number): string {
    const shown = products.slice(0, 2);
    const more = count - shown.length;

    return more > 0 ? `${shown.join(', ')} and ${more} more` : shown.join(', ');
}

/**
 * On a rep's dashboard: their outlets whose suggested orders are worth the
 * most a month, each opening that outlet's Suggested orders tab.
 */
export default function SuggestedOutlets({ suggestions, currency, className }: SuggestedOutletsProps) {
    const { outlets, total } = suggestions;

    return (
        <section className={clsx('rd-panel dash-suggested', className)} aria-labelledby="suggested-title">
            <div className="rd-panel__head">
                <div>
                    <h2 id="suggested-title" className="rd-panel__title">
                        Suggested orders
                    </h2>
                    <p className="rd-panel__sub">Your outlets with the most to gain, from what similar outlets buy</p>
                </div>
            </div>

            {outlets.length === 0 ? (
                <p className="dash-suggested__empty">
                    No new product suggestions today. Keep recording orders to help Ronda learn.
                </p>
            ) : (
                <ul className="dash-suggested__list">
                    {outlets.map((outlet) => (
                        <li key={outlet.lead_id}>
                            <Link
                                href={route('lead.view', { id: outlet.lead_id, tab: 'suggested' })}
                                className="dash-suggested__row"
                            >
                                <Initials name={outlet.name ?? '?'} colorKey={outlet.lead_id} />
                                <span className="dash-suggested__text">
                                    <span className="dash-suggested__name">{outlet.name ?? 'Unnamed outlet'}</span>
                                    <span className="dash-suggested__products">
                                        {productLine(outlet.products, outlet.product_count)}
                                    </span>
                                </span>
                                <span className="dash-suggested__value">
                                    <span>
                                        {currency} {formatMoney(outlet.estimated_monthly_value)}
                                    </span>
                                    <small>a month</small>
                                </span>
                                <i className="mdi mdi-chevron-right dash-suggested__go" aria-hidden="true" />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            <p className="dash-suggested__foot">
                {total > outlets.length && `The top ${outlets.length} of your ${total} outlets with suggestions. `}
                Worked out every night from confirmed orders.
            </p>
        </section>
    );
}
