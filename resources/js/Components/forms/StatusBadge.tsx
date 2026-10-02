import type { RecordStatus } from '@/types/forms';

/** A record's status as a chip. Pending reads "In review": it is with someone. */
export const RECORD_STATUS: Record<RecordStatus, { label: string; chip: string }> = {
    pending: { label: 'In review', chip: 'rd-chip rd-chip--blue' },
    approved: { label: 'Approved', chip: 'rd-chip rd-chip--good' },
    rejected: { label: 'Rejected', chip: 'rd-chip rd-chip--critical' },
    cancelled: { label: 'Cancelled', chip: 'rd-chip' },
    closed: { label: 'Closed', chip: 'rd-chip' },
};

export default function StatusBadge({ status }: { status: string }) {
    const badge = RECORD_STATUS[status as RecordStatus];

    if (!badge) {
        return <span className="rd-chip">{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
    }

    return (
        <span className={badge.chip}>
            {status === 'closed' ? (
                <i className="mdi mdi-lock-outline" aria-hidden="true" />
            ) : (
                <span className="rd-dot" />
            )}
            {badge.label}
        </span>
    );
}
