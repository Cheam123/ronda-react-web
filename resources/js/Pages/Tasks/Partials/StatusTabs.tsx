import clsx from 'clsx';
import { formatNumber } from '@/lib/format';

// On Hold (8) is no longer offered, so it has no tab.
export const STATUS_TABS = [
    { status: '1', label: 'New' },
    { status: '2', label: 'In progress' },
    { status: '3', label: 'Done' },
    { status: '4', label: 'Verified' },
    { status: '5', label: 'Completed' },
    { status: '6', label: 'Keep in view' },
    { status: '7', label: 'Rejected' },
];

interface StatusTabsProps {
    status: string;
    /** Tasks per status, with the other filters applied. */
    counts: Record<string, number | string>;
    onStatus: (status: string) => void;
}

/** One tab per status, with its count. */
export default function StatusTabs({ status, counts, onStatus }: StatusTabsProps) {
    return (
        <nav className="rd-tabs task-list__tabs" aria-label="Task status">
            {STATUS_TABS.map((tab) => {
                const active = status === tab.status;

                return (
                    <button
                        key={tab.status}
                        type="button"
                        className={clsx('rd-tabs__tab', active && 'is-active')}
                        aria-current={active ? 'true' : undefined}
                        onClick={() => onStatus(tab.status)}
                    >
                        {tab.label} <span className="rd-count">{formatNumber(Number(counts[tab.status] ?? 0))}</span>
                    </button>
                );
            })}
        </nav>
    );
}
