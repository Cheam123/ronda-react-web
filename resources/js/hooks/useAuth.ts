import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';
import type { Ability, PageProps } from '@/types';

/**
 * The signed-in user and their abilities (User::ABILITIES). Checks here only
 * decide what to show; the controllers still enforce every permission.
 */
export function useAuth() {
    const { auth } = usePage<PageProps>().props;

    const can = useCallback((...abilities: Ability[]) => abilities.some((ability) => auth.can[ability] === true), [auth]);

    return { user: auth.user, can };
}
