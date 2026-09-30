import clsx from 'clsx';
import type { ReactNode } from 'react';

interface DataTableProps {
    children: ReactNode;
    className?: string;
    /** Keep every cell on one line and scroll sideways instead (default). */
    nowrap?: boolean;
}

/**
 * The app's list table: dark header row, a rule under every row and a soft
 * shadow, scrolling sideways on narrow screens. Callers write the <thead>
 * and <tbody> themselves so cells stay free-form.
 */
export default function DataTable({ children, className, nowrap = true }: DataTableProps) {
    return (
        <div className={clsx('data-table-scroll', nowrap && 'text-nowrap')}>
            <table className={clsx('table table-sm custom-font-small data-table', className)}>{children}</table>
        </div>
    );
}

/** A full-width row for "nothing to show". */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
    return (
        <tr>
            <td colSpan={colSpan} className="text-muted py-3 text-wrap">
                {children}
            </td>
        </tr>
    );
}
