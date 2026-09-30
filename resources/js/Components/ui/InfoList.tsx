import clsx from 'clsx';
import type { ReactNode } from 'react';

export type InfoItem = [label: ReactNode, value: ReactNode];

interface InfoListProps {
    items: InfoItem[];
    className?: string;
}

/** Compact "Label : value" rows inside a table cell (lead and task summaries). */
export default function InfoList({ items, className }: InfoListProps) {
    return (
        <table className={clsx('info-list', className)}>
            <tbody>
                {items.map(([label, value], index) => (
                    <tr key={index}>
                        <td className="info-list__label">{label}</td>
                        <td className="info-list__sep">{label ? ':' : ''}</td>
                        <td className="info-list__value">{value}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
