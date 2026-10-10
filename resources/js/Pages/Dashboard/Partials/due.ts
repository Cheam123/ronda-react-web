import type { AttentionItem } from '../types';

/** "45 min", "5 h", "3 days" */
function span(hours: number): string {
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
    if (hours < 48) return `${Math.round(hours)} h`;
    return `${Math.round(hours / 24)} days`;
}

/** How far past or ahead of its due time a task is, relative to when the figures were taken. */
export function dueText(item: AttentionItem, now: string): { main: string; sub: string | null } {
    if (!item.due_at) {
        return { main: item.reason ?? '', sub: null };
    }

    const hours = (Date.parse(item.due_at) - Date.parse(now)) / 3_600_000;
    if (hours < 0) {
        return { main: `${span(-hours)} overdue`, sub: item.due_label };
    }

    // At risk because most of its time is used up: say so rather than repeat the date.
    const byElapsed = item.reason && item.reason.includes('%') ? item.reason : null;

    return { main: `In ${span(hours)}`, sub: byElapsed ?? item.due_label };
}
