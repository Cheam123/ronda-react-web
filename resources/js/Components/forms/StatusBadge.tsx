import type { RecordStatus } from '@/types/forms';

const BADGES: Record<RecordStatus, { label: string; icon: string; className: string }> = {
    pending: { label: 'Pending', icon: 'mdi-clock-outline', className: 'bg-warning text-dark' },
    approved: { label: 'Approved', icon: 'mdi-check-circle-outline', className: 'bg-success' },
    rejected: { label: 'Rejected', icon: 'mdi-close-circle-outline', className: 'bg-danger' },
    closed: { label: 'Closed', icon: 'mdi-lock-outline', className: 'record-badge--closed' },
    cancelled: { label: 'Cancelled', icon: 'mdi-cancel', className: 'record-badge--cancelled' },
};

/** A record's status as a coloured badge. */
export default function StatusBadge({ status }: { status: string }) {
    const badge = BADGES[status as RecordStatus];

    if (!badge) {
        return <span className="badge bg-secondary px-3 py-2">{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
    }

    return (
        <span className={`badge px-3 py-2 ${badge.className}`}>
            <i className={`mdi ${badge.icon} me-1`} />
            {badge.label}
        </span>
    );
}
