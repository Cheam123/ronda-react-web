import type { DocumentFile } from './documents';

/**
 * Task statuses (Tasks::getTaskStatus): 1 New, 2 In Progress, 3 Done,
 * 4 Verified, 5 Completed, 6 KIV, 7 Rejected, 8 On Hold.
 */
export type TaskStatus = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** The task list's query string, handed back so links and posts keep it. */
export type TaskFilters = Record<string, string | string[] | undefined>;

export interface ActivityFile {
    id: number;
    filename: string;
    name: string;
    url: string;
}

/** One follow-up on a task's timeline (TaskCommentResource). */
export interface TaskActivity {
    id: number;
    author: string;
    mine: boolean;
    created_at: string;
    created_iso: string;
    /** Still inside the 15-minute window when the page was loaded. */
    can_modify: boolean;
    /** The raw text, for the edit box. */
    message: string;
    /** The stored HTML to display; null when the message is empty. */
    html: string | null;
    attachments: ActivityFile[];
    report_photos: ActivityFile[];
}

export type AgingTone = 'good' | 'warn' | 'danger';

/** A row of the task list (TaskListItemResource). */
export interface TaskListItem {
    id: number;
    reference: string;
    title: string;
    flagged: boolean;
    status: TaskStatus;
    status_label: string;
    /** Overdue: past due while the task is still New or In Progress (TaskRisk). */
    due: { date: string; time: string | null; overdue: boolean } | null;
    appointment: string | null;
    reminder: string | null;
    created_at: string | null;
    last_updated: string | null;
    aging: { tone: AgingTone; label: string };
    sales: string | null;
    lead: {
        id: number | null;
        name: string | null;
        mobile: string | null;
        customer_id: string | null;
        business_name: string | null;
        ife_area: string | null;
        source: string | null;
    };
    subscriber: {
        id: number;
        name: string | null;
        initials: string;
        rate: number | null;
        /** [date, outlet] of each open appointment. */
        appointments: [string, string][];
    } | null;
    sub_subscribers: string[];
    owners: string[];
    activities: TaskActivity[];
    can: {
        edit: boolean;
        delete: boolean;
        recycle: boolean;
        reactivate: boolean;
    };
}

/** The read-only lead block of the task pages (TaskLeadResource). */
export interface TaskLead {
    id: number;
    name: string | null;
    business_name: string | null;
    customer_id: string | null;
    mobile: string | null;
    email: string | null;
    source: string | null;
    business_category: string | null;
    address: string | null;
    state: string | null;
    city: string | null;
    postcode: string | null;
    ife_area: string | null;
    remark: string | null;
    created_by: string | null;
}

/** A task for its view and edit pages (TaskResource). */
export interface TaskDetail {
    id: number;
    reference: string;
    status: TaskStatus;
    status_label: string;
    title: string;
    alert: number | null;
    start_date: string | null;
    start_time: string | null;
    due_date: string | null;
    due_time: string | null;
    appointment_date: string | null;
    appointment_time: string | null;
    invoice_no: string | null;
    sales: number | string | null;
    /** Rich text (HTML). */
    remark: string | null;
    people: {
        subscriber: number | null;
        subscriber_name: string | null;
        sub_subscribers: number[];
        owners: number[];
        viewers: number[];
        creator: string | null;
        checker: string | null;
    };
    lead: TaskLead;
    documents: DocumentFile[];
}

/** Which status changes the signed-in user may make (Tasks::actionFlagsFor). */
export interface TaskActionFlags {
    can_accept_task: boolean;
    can_hold_task: boolean;
    can_done_task: boolean;
    can_verify_task: boolean;
    can_fallback_task: boolean;
    can_complete_task: boolean;
    can_reject_task: boolean;
    can_kiv_task: boolean;
}
