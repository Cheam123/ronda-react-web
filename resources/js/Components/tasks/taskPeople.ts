import type { TaskDetail } from '@/types/tasks';

/** Who acts at each step, by name, for "who's next" lines and dialogs. */
export interface TaskPeopleNames {
    assignee: string | null;
    checker: string | null;
    /** "Aina Rahman" or "Aina Rahman and Hafiz Azmi". */
    owners: string | null;
}

/** "A", "A and B", "A, B and C". */
function listOf(names: string[]): string | null {
    if (names.length === 0) return null;
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function taskPeopleNames(task: TaskDetail): TaskPeopleNames {
    return {
        assignee: task.people.subscriber_name,
        checker: task.people.checker,
        owners: listOf(task.people.owner_names),
    };
}
