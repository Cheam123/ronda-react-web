import type { TaskDetail } from '@/types/tasks';
import type { TaskFormData } from './TaskFields';

const text = (value: string | number | null | undefined): string =>
    value === null || value === undefined ? '' : String(value);
const ids = (values: number[]): string[] => values.map(String);

/** A new task starts today at 9am, like the old form. */
export function blankTaskFormData(today: string): TaskFormData {
    return {
        subscriber: '',
        sub_subscriber: [],
        owner: [],
        viewer: [],
        alertind: '',
        title: '',
        task_start_date: today,
        task_start_time: '09:00',
        task_due_date: today,
        task_due_time: '09:00',
        task_appointment_date: '',
        task_appointment_time: '',
        invoice_no: '',
        sales: '',
        remark: '',
    };
}

/** An existing task's current values. */
export function taskFormData(task: TaskDetail): TaskFormData {
    return {
        subscriber: text(task.people.subscriber),
        sub_subscriber: ids(task.people.sub_subscribers),
        owner: ids(task.people.owners),
        viewer: ids(task.people.viewers),
        alertind: text(task.alert),
        title: task.title,
        task_start_date: text(task.start_date),
        task_start_time: text(task.start_time),
        task_due_date: text(task.due_date),
        task_due_time: text(task.due_time),
        task_appointment_date: text(task.appointment_date),
        task_appointment_time: text(task.appointment_time),
        invoice_no: text(task.invoice_no),
        sales: text(task.sales),
        remark: text(task.remark),
    };
}
