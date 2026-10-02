import { router } from '@inertiajs/react';
import { useCallback, useState } from 'react';
import { compactParams } from '@/lib/input';

/**
 * State for a list page's GET filter form. `apply` reloads the page with
 * the filters in the query string (so the URL stays shareable and the
 * controller does the filtering, as before); `choose` changes some filters
 * and applies them at once; `reset` drops them all.
 */
export function useFilters<T extends Record<string, string | string[]>>(url: string, initial: T) {
    const [values, setValues] = useState<T>(initial);

    const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
        setValues((current) => ({ ...current, [key]: value }));
    }, []);

    const apply = useCallback(
        (overrides: Partial<T> = {}) => {
            router.get(url, compactParams({ ...values, ...overrides }), { preserveState: true, preserveScroll: true });
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

    return { values, set, apply, choose, reset };
}
