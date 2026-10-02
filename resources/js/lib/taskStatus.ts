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
