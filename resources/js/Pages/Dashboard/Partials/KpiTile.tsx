import clsx from 'clsx';
import type { ReactNode } from 'react';

interface KpiTileProps {
    label: ReactNode;
    /** An mdi-* icon in a tinted square before the label. */
    icon?: string;
    tone?: 'brand' | 'serious' | 'critical' | 'good' | 'neutral';
    value: ReactNode;
    note?: ReactNode;
    /** Beside the value: a sparkline, avatars. */
    aside?: ReactNode;
    /** Under a rule at the bottom: a comparison, a link. */
    foot?: ReactNode;
}

/** One headline figure with its context. */
export default function KpiTile({ label, icon, tone = 'brand', value, note, aside, foot }: KpiTileProps) {
    return (
        <article className="rd-kpi">
            <div className="rd-kpi__label">
                {icon && (
                    <span className={clsx('rd-icon', tone !== 'brand' && `rd-icon--${tone}`)}>
                        <i className={`mdi ${icon}`} aria-hidden="true" />
                    </span>
                )}
                {label}
            </div>
            <div className="rd-kpi__body">
                <div>
                    <div className="rd-kpi__value">{value}</div>
                    {note && <div className="rd-kpi__note">{note}</div>}
                </div>
                {aside}
            </div>
            {foot && <div className="rd-kpi__foot">{foot}</div>}
        </article>
    );
}
