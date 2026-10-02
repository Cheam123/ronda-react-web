import type { SelectOption } from '.';

/** A row of the lead list (LeadListResource). */
export interface LeadListItem {
    id: number;
    name: string | null;
    business_name: string | null;
    customer_id: string | null;
    mobile: string | null;
    email: string | null;
    location: string;
    upline_name: string;
    presales_name: string;
    closing_sales_name: string;
    ife_area: string | null;
    ife_area_id: number | null;
    created_by: string | null;
    assignee: string | null;
    assignee_id: number | null;
    created_date: string | null;
    created_time: string | null;
    /** "28 Sep 2026" */
    created_label: string | null;
    deletable: boolean;
    taskable: boolean;
}

/** A lead for its form (LeadResource). */
export interface Lead {
    id: number;
    name: string | null;
    business_name: string | null;
    customer_id: string | null;
    receiving_date: string | null;
    mobile: string | null;
    email: string | null;
    source: number | null;
    business_category: number | null;
    address: string | null;
    state_id: number | null;
    city_id: number | null;
    postcode: string | null;
    ife_area_id: number | null;
    size_band: string | null;
    seats: number | null;
    segment: string | null;
    /** Location stamp as JSON, '' when never captured. */
    gps: string;
    remark: string | null;
    /** Who the outlet is assigned to (the last task subscriber). */
    assignee: string | null;
    assignee_id: number | null;
    created_by: string | null;
    /** Whether a new task may be raised on it now. */
    taskable: boolean;
}

export interface IfeAreaOption extends SelectOption<number> {
    description: string | null;
}

export interface CityOption extends SelectOption<number> {
    state_id: number;
}

/** Dropdown options the lead form needs (LeadController::formOptions). */
export interface LeadFormOptions {
    ifeAreas: IfeAreaOption[];
    states: SelectOption<number>[];
    cities: CityOption[];
    sources: SelectOption<number>[];
    businessCategories: SelectOption<number>[];
    sizeBands: SelectOption<string>[];
    segments: SelectOption<string>[];
}

/** A task on a lead's "Task Histories" (TaskSummaryResource). */
export interface TaskSummary {
    id: number;
    reference: string;
    title: string;
    lead_source: string | null;
    business_category: string | null;
    appointment: string | null;
    status: number;
    status_label: string;
    status_date: string | null;
    subscriber: string | null;
    sub_subscribers: string[];
    checker: string | null;
    creator: string | null;
    owners: string[];
    last_updated: string | null;
}

export interface Visit {
    id: number;
    visited_at: string;
    visited_by: string | null;
    status: string | null;
    summary: string;
    followup_date: string | null;
    followup_plan: string | null;
}

export interface Order {
    id: number;
    order_no: string;
    order_date: string;
    cancelled: boolean;
    remark: string | null;
    total_amount: number;
    recorded_by: string | null;
    lines: { quantity: number; unit: string | null; product: string | null }[];
}

/** RecommendationService::forLead() */
export interface Recommendation {
    status: string;
    similar_outlets?: number;
    gap_count?: number;
    estimated_monthly_value?: number;
    items?: RecommendationItem[];
    explanation?: {
        why: string | null;
        opening_line: string | null;
        source: string;
    };
}

export interface RecommendationItem {
    name: string;
    sku: string;
    status: 'gap' | 'topup';
    buyers: number;
    neighbors_used: number;
    support: number;
    recommended_qty: number;
    current_qty: number;
    unit: string;
    est_monthly_value: number;
}
