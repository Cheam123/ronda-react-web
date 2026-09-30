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
        icon: 'uil-home-alt',
        href: () => '/index',
        active: ['/', 'index'],
        abilities: ['dashboard'],
    },
    {
        label: 'Lead/Customer',
        icon: 'mdi mdi-account-group-outline',
        href: () => route('lead.index'),
        active: ['v1/lead*'],
        abilities: ['view_lead', 'edit_lead', 'create_lead'],
    },
    {
        label: 'Task',
        icon: 'uil-graph-bar',
        href: () => route('tasks.index2', { status: 1 }),
        active: ['v1/task/manage/*'],
        abilities: ['manage_task'],
    },
    {
        label: 'IFE Report',
        icon: 'uil-clipboard-notes',
        href: () => route('ifereport.index'),
        active: ['v1/ifereport*'],
        abilities: ['ife_report'],
    },
    {
        // Everyone gets the menu: My Records and My Tasks are scoped to the
        // caller by the controller. The items inside carry their own gates.
        label: 'Form',
        icon: 'uil-clipboard-notes',
        active: ['v1/form*'],
        children: [
            {
                label: 'Form Creation',
                href: () => route('form.index'),
                active: ['v1/form', 'v1/form/create*', 'v1/form/edit*', 'v1/form/preview*'],
                abilities: ['form_creation', 'form_admin'],
            },
            { label: 'Available Forms', href: () => route('form.entry'), active: ['v1/form/entry*', 'v1/form/fill*'] },
            { label: 'My Records', href: () => route('form.records.index'), active: ['v1/form/records'] },
            {
                label: 'My Tasks',
                href: () => route('form.tasks'),
                active: ['v1/form/tasks*'],
                badge: 'formTaskCount',
            },
            {
                label: 'All Records',
                href: () => route('form.records.all'),
                active: ['v1/form/records/all*'],
                abilities: ['form_admin'],
            },
        ],
    },
    {
        label: 'Admin',
        icon: 'uil-users-alt',
        active: ['v1/users*', 'v1/product*', 'v1/area*'],
        abilities: ['manage_user', 'manage_product', 'manage_area'],
        children: [
            { label: 'Users', href: () => route('users.index'), active: ['v1/users*'], abilities: ['manage_user'] },
            {
                label: 'Products',
                href: () => route('product.index'),
                active: ['v1/product*'],
                abilities: ['manage_product'],
            },
            { label: 'IFE Areas', href: () => route('area.index'), active: ['v1/area*'], abilities: ['manage_area'] },
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
