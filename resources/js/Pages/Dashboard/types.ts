/** DashboardService::summary(), as DashboardSummaryResource sends it. */
export interface DashboardSummary {
    scope: 'team' | 'personal';
    generated_at: string;
    generated_label: string;
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
    };
    orders: {
        month_count: number;
        month_value: number;
    };
    attention: AttentionItem[];
    trend: TrendDay[];
    team: TeamMember[];
}

export interface AttentionItem {
    id: number;
    reference: string;
    title: string;
    lead: string | null;
    subscriber: string | null;
    status: string;
    level: 'overdue' | 'at_risk';
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
}

export interface DailyDigest {
    date_label: string;
    source: string;
    content: string;
}
