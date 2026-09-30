import clsx from 'clsx';
import Select from '@/Components/form/Select';

// On Hold (8) is no longer offered, so it has no tab.
const TABS = [
    { status: '1', label: 'New Task' },
    { status: '2', label: 'Inprogress' },
    { status: '3', label: 'Done' },
    { status: '4', label: 'Verified' },
    { status: '5', label: 'Completed' },
    { status: '6', label: 'Keep In View' },
    { status: '7', label: 'Rejected' },
];

const SORT_BY = [
    { value: 'last_follow_up', label: 'Sort By Last Updated Date' },
    { value: 'reminder_date', label: 'Sort By Reminder Date' },
    { value: 'due_date', label: 'Sort By Due Date' },
    { value: 'created_at', label: 'Sort By Created Date' },
    { value: 'inprogress_date', label: 'Sort By In Progress Date' },
    { value: 'complete_date', label: 'Sort By In Completed Date' },
    { value: 'kiv_date', label: 'Sort By KIV Date' },
    { value: 'reject_date', label: 'Sort By Rejected Date' },
];

const SORT_MODE = [
    { value: 'desc', label: '🔽 Desc' },
    { value: 'asc', label: '🔼 Asc' },
];

interface StatusTabsProps {
    status: string;
    /** Tasks per status, for the tab labels. */
    counts: Record<string, number | string>;
    sortBy: string;
    sortMode: string;
    onStatus: (status: string) => void;
    onSort: (sortBy: string, sortMode: string) => void;
}

/** One tab per status with its count, and the sort order. */
export default function StatusTabs({ status, counts, sortBy, sortMode, onStatus, onSort }: StatusTabsProps) {
    return (
        <div className="task-tabs">
            <div className="nav nav-pills task-tabs__pills" role="tablist">
                {TABS.map((tab) => {
                    const count = Number(counts[tab.status] ?? 0);
                    return (
                        <button
                            key={tab.status}
                            type="button"
                            role="tab"
                            aria-selected={status === tab.status}
                            className={clsx('btn btn-sm nav-link', status === tab.status ? 'active' : 'inactive')}
                            onClick={() => onStatus(tab.status)}
                        >
                            {tab.label}
                            {count > 0 && ` ( ${count} )`}
                        </button>
                    );
                })}
            </div>
            <div className="task-tabs__sort">
                <Select
                    aria-label="Sort by"
                    options={SORT_BY}
                    value={sortBy}
                    // Due dates read soonest first, so that sort starts ascending.
                    onChange={(event) =>
                        onSort(event.target.value, event.target.value === 'due_date' ? 'asc' : sortMode)
                    }
                />
                <Select
                    aria-label="Sort order"
                    options={SORT_MODE}
                    value={sortMode}
                    onChange={(event) => onSort(sortBy, event.target.value)}
                />
            </div>
        </div>
    );
}
