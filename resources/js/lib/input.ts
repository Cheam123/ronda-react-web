import type { KeyboardEvent } from 'react';

/**
 * Keyboard guards for inputs that only take digits (mobile numbers,
 * postcodes, customer IDs). Control keys and shortcuts still work.
 */
export function digitsOnly(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.ctrlKey || event.metaKey || event.key.length > 1) {
        return;
    }
    if (!/^\d$/.test(event.key)) {
        event.preventDefault();
    }
}

/** Drop empty values so filter URLs stay short: {a: '', b: '1'} -> {b: '1'} */
export function compactParams<T extends Record<string, unknown>>(params: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
    ) as Partial<T>;
}
