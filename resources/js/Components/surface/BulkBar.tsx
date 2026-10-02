import type { ReactNode } from 'react';
import { pluralize } from '@/lib/format';

interface BulkBarProps {
    /** How many rows are ticked; the bar shows only while this is above zero. */
    count: number;
    /** What a ticked row is ("outlet"), for the screen reader line. */
    noun: string;
    onClear: () => void;
    /** The actions: rd-btn buttons. */
    children: ReactNode;
}

/** A bar at the foot of the window with what can be done to the ticked rows. */
export default function BulkBar({ count, noun, onClear, children }: BulkBarProps) {
    if (count === 0) {
        return null;
    }

    return (
        <div className="rd-bulkbar" role="region" aria-label={`${pluralize(count, noun)} selected`}>
            <span className="rd-bulkbar__count" aria-live="polite">
                <strong>{count}</strong> selected
            </span>
            <span className="rd-bulkbar__sep" aria-hidden="true" />
            {children}
            <button type="button" className="rd-btn rd-btn--icon" aria-label="Clear the selection" onClick={onClear}>
                <i className="mdi mdi-close" aria-hidden="true" />
            </button>
        </div>
    );
}
