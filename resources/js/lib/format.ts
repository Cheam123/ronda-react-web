/**
 * Number and text formatting shared by every page. Dates arrive from the
 * server already formatted in the app's timezone, so there is no date
 * formatting here on purpose.
 */

const numberFormatters = new Map<number, Intl.NumberFormat>();

function formatterFor(decimals: number): Intl.NumberFormat {
    let formatter = numberFormatters.get(decimals);
    if (!formatter) {
        formatter = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
        numberFormatters.set(decimals, formatter);
    }
    return formatter;
}

/** PHP's number_format(): thousands separated, fixed decimals. */
export function formatNumber(value: number | string | null | undefined, decimals = 0): string {
    const number = Number(value ?? 0);
    return formatterFor(decimals).format(Number.isFinite(number) ? number : 0);
}

/** A money amount without the currency prefix: 1,234.50 */
export function formatMoney(value: number | string | null | undefined): string {
    return formatNumber(value, 2);
}

/** Stat-tile values: 1,284 / 12.9K / 4.2M */
export function compactNumber(value: number | string | null | undefined): string {
    const number = Number(value ?? 0);
    const trim = (n: number) => formatNumber(n, 1).replace(/\.0$/, '');

    if (number >= 1_000_000) return `${trim(number / 1_000_000)}M`;
    if (number >= 10_000) return `${trim(number / 1_000)}K`;
    return formatNumber(number);
}

/** A quantity without trailing zeros: 2.50 -> 2.5, 3.00 -> 3 */
export function formatQuantity(value: number | string | null | undefined): string {
    return formatNumber(value, 2).replace(/\.?0+$/, '');
}

/** Laravel's Str::limit(): cut to `limit` characters and add an ellipsis. */
export function truncate(text: string | null | undefined, limit: number): string {
    if (!text) return '';
    return text.length > limit ? `${text.slice(0, limit).trimEnd()}...` : text;
}

/** "1 product" / "2 products" */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : plural}`;
}
