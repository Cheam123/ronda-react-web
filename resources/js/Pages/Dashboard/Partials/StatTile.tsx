import type { ReactNode } from 'react';

interface StatTileProps {
    label: ReactNode;
    value: ReactNode;
    note?: ReactNode;
}

/** One KPI tile: a label, a big number and a line of context. */
export default function StatTile({ label, value, note }: StatTileProps) {
    return (
        <div className="dash-tile">
            <div className="dash-tile__label">{label}</div>
            <div className="dash-tile__value">{value}</div>
            {note && <div className="dash-tile__note">{note}</div>}
        </div>
    );
}
