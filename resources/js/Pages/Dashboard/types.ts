/** DashboardService::summary(), as DashboardSummaryResource sends it. */
export interface DashboardSummary {
    scope: 'team' | 'personal';
    generated_at: string;
    generated_label: string;
    /** "7:42 AM" */
    time_label: string;
    /** "Wednesday, 30 September 2026" */
    date_label: string;
    tasks: {
        open: number;
        new: number;
        in_progress: number;
        overdue: number;
        at_risk: number;
        due_today: number;
        created_7d: number;
        done_7d: number;
        completed_7d: number;
    };
    forms: {
        submitted_7d: number;
        pending: number;
        approved: number;
        rejected: number;
    };
    visits: {
        last_7d: number;
        today: number;
        daily: VisitDay[];
    };
    orders: {
        month_count: number;
        month_value: number;
        last_7d: number;
        /** Against the same days of last month; null when last month had none. */
        change_pct: number | null;
    };
    attention: AttentionItem[];
    trend: TrendDay[];
    team: TeamMember[];
}

export type RiskLevel = 'overdue' | 'at_risk';

export interface AttentionItem {
    id: number;
    reference: string;
    title: string;
    lead: string | null;
    subscriber: string | null;
    status: string;
    level: RiskLevel;
    reason: string | null;
    due_at: string | null;
    due_label: string;
}

export interface TrendDay {
    date: string;
    label: string;
    created: number;
    done: number;
}

export interface VisitDay {
    date: string;
    label: string;
    count: number;
}

export interface TeamMember {
    user_id: number;
    name: string;
    role: string;
    open: number;
    overdue: number;
    at_risk: number;
    done_7d: number;
    visits_7d: number;
    forms_7d: number;
    orders_7d: number;
    /** Their two most urgent overdue or at-risk tasks, most urgent first. */
    urgent: AttentionItem[];
}

/** RecommendationService::topForUser(): a rep's outlets with the most to gain. */
export interface SuggestedOutlets {
    outlets: {
        lead_id: number;
        name: string | null;
        /** The first three suggested products, most backed first. */
        products: string[];
        product_count: number;
        gap_count: number;
        estimated_monthly_value: number;
    }[];
    /** How many of their outlets have suggestions at all. */
    total: number;
}

export interface DailyDigest {
    date_label: string;
    /** False when the 7:00 am run was missed and this is an older one. */
    is_today: boolean;
    source: string;
    content: string;
}

/** AdminDashboardService::summary(), as AdminDashboardResource sends it. */
export interface AdminSummary {
    generated_at: string;
    generated_label: string;
    date_label: string;
    sales: {
        month_value: number;
        month_count: number;
        month_outlets: number;
        previous_value: number;
        change_pct: number | null;
        /** "September" */
        month_label: string;
        daily: SalesDay[];
        categories: { name: string; value: number }[];
        top_products: TopProduct[];
    };
    outlets: {
        total: number;
        customers: number;
        new_month: number;
        without_area: number;
        without_area_names: string[];
    };
    /** Active users. */
    users: {
        active: number;
        admins: number;
        managers: number;
        reps: number;
        /** Without Telegram linked. */
        unlinked: number;
        unlinked_names: string[];
    };
    approvals: {
        pending: number;
        forms: number;
        slow: number;
        oldest_at: string | null;
        /** "3 days" */
        oldest_label: string | null;
    };
    stale_products: string[];
    areas: AreaCoverage[];
    activity: ActivityEvent[];
    /** Scheduled jobs that should have run by now and haven't. */
    missed_jobs: MissedJob[];
}

export interface MissedJob {
    job: 'digest' | 'recommendations';
    /** "7:00 am" */
    schedule: string;
    last_run: string | null;
    /** "Wednesday, 30 Sep" */
    last_label: string | null;
}

export interface SalesDay {
    date: string;
    /** "1" */
    day: string;
    /** "Tue 1 Sep" */
    label: string;
    value: number;
}

export interface TopProduct {
    id: number;
    name: string;
    sku: string;
    unit: string;
    quantity: number;
    value: number;
}

export interface AreaCoverage {
    id: number;
    name: string;
    outlets: number;
    reports_month: number;
}

export interface ActivityEvent {
    at: string;
    when: string;
    kind: 'order' | 'visit' | 'form' | 'task';
    who: string | null;
    what: string;
    amount: number | null;
}

/** DashboardService::riskCounts() */
export interface RiskCounts {
    overdue: number;
    at_risk: number;
}
