/** Tasks::getTaskStatus() number => the .rd-chip modifier it is drawn with. */
const CHIP: Record<number, string> = {
    1: 'rd-chip--blue', // New Task
    2: 'rd-chip--indigo', // In Progress
    3: 'rd-chip--teal', // Done
    4: 'rd-chip--violet', // Verified
    5: 'rd-chip--good', // Completed
    6: 'rd-chip--serious', // KIV
    7: 'rd-chip--critical', // Rejected
    8: '', // On Hold
};

/** The chip classes for a task in the given status. */
export function taskStatusChip(status: number): string {
    return `rd-chip ${CHIP[status] ?? ''}`.trim();
}

/** Tasks::getTaskStatus() number => what the pages call it ("In progress", not "In Progress" or "KIV"). */
const LABEL: Record<number, string> = {
    1: 'New',
    2: 'In progress',
    3: 'Done',
    4: 'Verified',
    5: 'Completed',
    6: 'Keep in view',
    7: 'Rejected',
    8: 'On hold',
};

/** A task status in the pages' words; falls back to the server's label for a status it doesn't know. */
export function taskStatusLabel(status: number, fallback = ''): string {
    return LABEL[status] ?? fallback;
}
