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
    is_halal: boolean | null;
    /** Customer group keys the rep picked; empty when not stated. */
    main_customers?: string[];
    /** Drink kind keys that sell best there; empty when not stated. */
    best_selling_kinds?: string[];
    /** Goal keys (Leads::GOALS) the owner mentioned; empty when not stated. */
    improvement_goals?: string[];
    /** What a usual drink costs there, in RM; null when not stated. */
    typical_drink_price?: number | null;
    area: AreaProfile | null;
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
    /** The 8 customer groups, for "Main customers". */
    customerGroups: SelectOption<string>[];
    /** The 8 kinds of drink, for "Their best-selling drinks". */
    drinkKinds: SelectOption<string>[];
    /** What an outlet can want to improve. */
    goals: SelectOption<string>[];
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

/** What the rep did with a suggestion. */
export type FeedbackStatus = 'pitched' | 'accepted' | 'declined';

/** One row of a scanned menu: a drink we know, or a priced row we didn't recognise. */
export interface MenuItem {
    id: number;
    /** The row as it was read. */
    text: string;
    price: number | null;
    recipe_id: number | null;
    drink: string | null;
    /** False when the rep said it isn't on the menu. */
    kept: boolean;
    changed: boolean;
}

/** A product a drink idea needs, with a starting monthly quantity. */
export interface MenuIdeaProduct {
    product_id: number;
    name: string | null;
    unit: string | null;
    unit_price: number;
    /** Per serve, as people say it ("15 ml"). */
    amount: string | null;
    quantity: number;
    value: number;
    already_buys: boolean;
}

/** A drink the outlet could add to its menu (App\Services\Menu\MenuIdeas). */
export interface MenuIdea {
    recipe_id: number;
    slug: string;
    name: string;
    serve: 'hot' | 'iced' | 'either';
    category: string | null;
    description: string | null;
    /** How well it fits, 0 to 1: the average of `parts`. */
    score: number;
    parts: Record<string, number>;
    /** In plain words, why it suits. */
    reasons: string[];
    cost_per_serve: number;
    products: MenuIdeaProduct[];
    est_monthly_value: number;
}

/** One menu scan (MenuScanService::present). A draft has no ideas yet. */
export interface MenuScan {
    id: number;
    status: 'draft' | 'confirmed';
    source: 'phone' | 'typed' | 'textract';
    scanned_at: string;
    /** "14 Nov 2026" */
    scanned_label: string;
    scanned_by: string | null;
    price_level: string | null;
    price_label: string | null;
    /** The middle drink price on the menu. */
    median_price: number | null;
    matched: MenuItem[];
    unrecognised: MenuItem[];
    photos: { id: number; name: string; url: string }[];
    /** On a draft, every line that was read, in reading order: to compare with the photos. */
    lines: string[];
    ideas: MenuIdea[];
}

/** The outlet's menu: its newest confirmed scan, with what reps answered (MenuScanService::forLead). */
/** Each drink idea's newest answer, and why it was declined, by drink id. */
export interface IdeaAnswers {
    drink_feedback: Record<string, FeedbackStatus>;
    drink_reasons: Record<string, string>;
}

export interface OutletMenu extends MenuScan {
    answers: IdeaAnswers;
    /** Reasons a rep can give when declining: key => label. */
    decline_reasons: Record<string, string>;
    scan_count: number;
}

/** An outlet's drink ideas as they stand now (MenuScanService::ideasFor()). */
export interface DrinkIdeas {
    ideas: MenuIdea[];
    /** The menu the ideas used; null when the outlet has none. */
    menu_scan_id: number | null;
    /** What the ideas were worked out from, in words: "their menu", "what the owner told you"… */
    based_on: string[];
    answers: IdeaAnswers;
    /** Reasons a rep can give when declining: key => label. */
    decline_reasons: Record<string, string>;
}

/** What is known about where an outlet trades (Leads::areaProfile()). */
export interface AreaProfile {
    district: string | null;
    income_group: string | null;
    area_types: string[];
    nearby_total: number;
    source: 'seeded' | 'amazon' | 'district_only' | 'none';
    profiled_at: string;
    /** Where the customer groups come from: the rep's answer, or what is around the outlet. */
    customers_from?: 'rep' | 'area' | null;
    /** Who it serves, in words. */
    customer_groups?: string[];
    /** Each kind of area that shows around the outlet, biggest share first. */
    types: AreaTypeShown[];
    /** Two or more kinds of area are present. */
    mixed_use: boolean;
    /** Cafes, restaurants and fast food nearby: competition, not an area. */
    competitors: { count: number; nearest: number | null } | null;
    /** How far the live lookup searched, in metres; null for the seeded list. */
    radius: number | null;
    /** Distances were known, so closer places counted more. */
    weighted: boolean;
    /** The nearest places, nearest first. */
    places: { label: string; name: string | null; distance: number | null; competitor: boolean }[];
}

/** One kind of area around an outlet (Leads::areaProfile()). */
export interface AreaTypeShown {
    kind: string;
    /** e.g. "University" */
    label: string;
    /** e.g. "Students" */
    customers: string;
    level: 'present' | 'some';
    /** Share of the weighted places, 0 to 1. */
    share: number;
    count: number;
    /** Metres to the nearest one; null when distances aren't known. */
    nearest: number | null;
    /** What the area is like, from the area rules. */
    note: string | null;
}

/** OutletAssistantService::briefResource() */
export interface VisitBrief {
    /** Plain text in "Label:" sections with "- " bullets. */
    content: string;
    source: 'claude' | 'template';
    /** Why a template wrote it: Claude was off, or the call failed. */
    fallback: 'not_configured' | 'unavailable' | null;
    /** The outlet changed (or a day passed) since it was written. */
    stale: boolean;
    generated_at: string;
    generated_by: string | null;
}

/** One message in Ask Ronda; the browser keeps the chat. */
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export type FollowUpTopic = 'last_visit' | 'last_order';
