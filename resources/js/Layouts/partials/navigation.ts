import type { Ability } from '@/types';

/**
 * The top navigation. Items carrying `abilities` show only to users holding
 * at least one of them; `active` lists the URL paths (Laravel request()->is()
 * patterns, * as a wildcard) that highlight the item.
 */
export interface NavLink {
    label: string;
    href: () => string;
    active: string[];
    abilities?: Ability[];
    /** Show the pending form-task count next to the label. */
    badge?: 'formTaskCount';
}

export interface NavGroup {
    label: string;
    icon: string;
    active: string[];
    abilities?: Ability[];
    href?: () => string;
    children?: NavLink[];
}

export const NAVIGATION: NavGroup[] = [
    {
        label: 'Dashboard',
        icon: 'mdi mdi-home-outline',
        href: () => '/index',
        active: ['/', 'index'],
        abilities: ['dashboard'],
    },
    {
        label: 'Outlets',
        icon: 'mdi mdi-storefront-outline',
        href: () => route('lead.index'),
        active: ['lead*'],
        abilities: ['view_lead', 'edit_lead', 'create_lead'],
    },
    {
        label: 'Tasks',
        icon: 'mdi mdi-format-list-checks',
        href: () => route('tasks.index2', { status: 'open' }),
        active: ['task/manage/*'],
        abilities: ['manage_task'],
    },
    {
        label: 'Visit reports',
        icon: 'mdi mdi-clipboard-text-outline',
        href: () => route('ifereport.index'),
        active: ['ifereport*'],
        abilities: ['ife_report'],
    },
    {
        // Everyone gets the menu: My records and Waiting on me are scoped to the
        // caller by the controller. The items inside carry their own gates.
        label: 'Forms',
        icon: 'mdi mdi-file-document-outline',
        active: ['form*'],
        children: [
            {
                label: 'Manage forms',
                href: () => route('form.index'),
                active: ['form', 'form/create*', 'form/edit*', 'form/preview*'],
                abilities: ['form_creation', 'form_admin'],
            },
            { label: 'Start a form', href: () => route('form.entry'), active: ['form/entry*', 'form/fill*'] },
            { label: 'My records', href: () => route('form.records.index'), active: ['form/records'] },
            {
                label: 'Waiting on me',
                href: () => route('form.tasks'),
                active: ['form/tasks*'],
                badge: 'formTaskCount',
            },
            {
                label: 'All records',
                href: () => route('form.records.all'),
                active: ['form/records/all*'],
                abilities: ['form_admin'],
            },
        ],
    },
    {
        label: 'Admin',
        icon: 'mdi mdi-tune-variant',
        active: ['users*', 'product*', 'recipe*', 'area*'],
        abilities: ['manage_user', 'manage_product', 'manage_area'],
        children: [
            { label: 'Users', href: () => route('users.index'), active: ['users*'], abilities: ['manage_user'] },
            {
                label: 'Products',
                href: () => route('product.index'),
                active: ['product*'],
                abilities: ['manage_product'],
            },
            {
                label: 'Drinks',
                href: () => route('recipe.index'),
                active: ['recipe*'],
                abilities: ['manage_product'],
            },
            { label: 'IFE areas', href: () => route('area.index'), active: ['area*'], abilities: ['manage_area'] },
        ],
    },
];

/** Laravel's request()->is(): does the current path match any pattern? */
export function matchesPath(url: string, patterns: string[]): boolean {
    const path = url.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '') || '/';

    return patterns.some((pattern) => {
        const regex = new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`);
        return regex.test(path);
    });
}

function escapeRegExp(text: string): string {
    return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}
