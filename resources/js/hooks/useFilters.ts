import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { compactParams } from '@/lib/input';

/** How long typing in the search box pauses before the list follows it. */
const SEARCH_DELAY = 400;

/**
 * State for a list page's GET filter form. `apply` reloads the page with
 * the filters in the query string (so the URL stays shareable and the
 * controller does the filtering, as before); `choose` changes some filters
 * and applies them at once; `reset` drops them all. A `search` value is
 * applied by itself shortly after typing stops, so no list needs Enter.
 */
export function useFilters<T extends Record<string, string | string[]>>(url: string, initial: T) {
    const [values, setValues] = useState<T>(initial);
    // The search the list on screen was loaded with.
    const searched = useRef(initial.search ?? '');

    const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
        setValues((current) => ({ ...current, [key]: value }));
    }, []);

    const apply = useCallback(
        (overrides: Partial<T> = {}) => {
            const next = { ...values, ...overrides };
            searched.current = next.search ?? '';
            router.get(url, compactParams(next), { preserveState: true, preserveScroll: true });
        },
        [url, values],
    );

    const choose = useCallback(
        (changes: Partial<T>) => {
            setValues((current) => ({ ...current, ...changes }));
            apply(changes);
        },
        [apply],
    );

    const reset = useCallback(() => router.get(url), [url]);

    const search = values.search;
    useEffect(() => {
        if (typeof search !== 'string' || search === searched.current) return;
        const timer = window.setTimeout(() => apply(), SEARCH_DELAY);
        return () => window.clearTimeout(timer);
    }, [search, apply]);

    return { values, set, apply, choose, reset };
}
