/**
 * Props every page receives from HandleInertiaRequests::share().
 */

export type Ability =
    | 'dashboard'
    | 'view_lead'
    | 'create_lead'
    | 'edit_lead'
    | 'manage_task'
    | 'add_task'
    | 'create_task'
    | 'ife_report'
    | 'manage_ife_report'
    | 'manage_user'
    | 'form_creation'
    | 'form_admin'
    | 'manage_product'
    | 'manage_area'
    | 'record_order'
    | 'manage_order';

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    gender: 'M' | 'F' | null;
    type: number;
    typeLabel: string;
}

/** A SweetAlert2 config queued by the controllers' alert()->... helper. */
export type FlashAlert = Record<string, unknown>;

export interface Flash {
    success: string | null;
    error: string | null;
    status: string | null;
    alert: FlashAlert | null;
}

export interface SharedProps {
    app: {
        name: string;
        currency: string;
    };
    csrfToken: string;
    auth: {
        user: AuthUser | null;
        can: Partial<Record<Ability, boolean>>;
    };
    navigation: {
        formTaskCount: number;
    };
    flash: Flash;
    errors: Record<string, string>;
}

export type PageProps<T extends Record<string, unknown> = Record<string, unknown>> = T & SharedProps;

/** The header breadcrumb pieces the controllers pass as tmenu_part1..3. */
export interface BreadcrumbProps {
    tmenu_part1?: string;
    tmenu_part2?: string;
    tmenu_part3?: string;
}

/** A Laravel LengthAwarePaginator serialised by toArray(). */
export interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    from: number | null;
    to: number | null;
    total: number;
    links: PaginationLink[];
    path: string;
    first_page_url: string;
    last_page_url: string;
    next_page_url: string | null;
    prev_page_url: string | null;
}

export interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

/** A Laravel query string, as the controllers hand it back to filter forms. */
export type QueryParams = Record<string, string | undefined>;

export interface SelectOption<V extends string | number = string | number> {
    value: V;
    label: string;
}

/** The {status, message, data} envelope Controller::response_* returns. */
export interface ApiEnvelope<T = unknown> {
    status: 'ok' | 'error';
    message: string | null;
    data?: T;
    errors?: Record<string, string[]>;
    redirectTo?: string | null;
}
