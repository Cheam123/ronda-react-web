import { postJson } from './http';
import type { TaskActivity } from '@/types/tasks';

/**
 * The follow-up log on a task (TaskController's chat_* endpoints). They
 * answer {type, message} instead of the usual envelope, and report
 * failures with type "error" and a 200 status.
 */

/** A follow-up can be edited or deleted this long after it was posted. */
export const EDIT_WINDOW_MINUTES = 15;

interface ChatReply {
    type: 'success' | 'error';
    message: string;
}

async function send(url: string, data: FormData | Record<string, unknown>): Promise<void> {
    const reply = await postJson<ChatReply>(url, data);
    if (reply.type !== 'success') {
        throw new Error(reply.message || 'Something went wrong. Please try again.');
    }
}

/**
 * Post a follow-up with its attachments. `extra` carries the optional new
 * due date the Comment tab sends along (task_due_date / task_due_time).
 */
export function logActivity(taskId: number, message: string, files: File[], extra: Record<string, string> = {}) {
    const form = new FormData();
    form.append('task_id', String(taskId));
    form.append('chat_message', message);
    files.forEach((file, index) => form.append(`file-${index}`, file, file.name));
    Object.entries(extra).forEach(([key, value]) => form.append(key, value));

    return send(route('chat.store'), form);
}

export function updateActivity(activityId: number, message: string) {
    return send(route('chat.update'), { id: activityId, chat_message: message });
}

/** Deletes the follow-up, or only clears its text when it has attachments. */
export function deleteActivity(activityId: number) {
    return send(route('chat.delete'), { id: activityId });
}

export function markActivitiesRead(taskId: number) {
    return postJson(route('chat.markedasread'), { id: taskId });
}

/** Whether the author may still edit or delete it, right now. */
export function isStillEditable(activity: TaskActivity, now = Date.now()): boolean {
    return activity.can_modify && now - Date.parse(activity.created_iso) <= EDIT_WINDOW_MINUTES * 60_000;
}
