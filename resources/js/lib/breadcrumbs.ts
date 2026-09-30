import type { BreadcrumbProps } from '@/types';

/**
 * The header breadcrumb from the tmenu_part1..3 props the controllers pass:
 * part1 switches the trail on (it shows as "Home"), parts 2 and 3 follow.
 */
export function breadcrumbFrom({ tmenu_part1, tmenu_part2, tmenu_part3 }: BreadcrumbProps): string[] | null {
    if (!tmenu_part1) {
        return null;
    }

    return [tmenu_part2, tmenu_part3].filter((part): part is string => Boolean(part));
}
