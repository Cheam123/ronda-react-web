import clsx from 'clsx';

interface MeterProps {
    value: number;
    /** The value that fills the bar; usually the largest in the list. */
    max: number;
    thin?: boolean;
    className?: string;
}

/** A horizontal bar for comparing a value with its neighbours. Decorative: the number sits beside it. */
export default function Meter({ value, max, thin = false, className }: MeterProps) {
    const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

    return (
        <div className={clsx('rd-meter', thin && 'rd-meter--thin', className)} aria-hidden="true">
            <div className="rd-meter__fill" style={{ width: `${percent}%` }} />
        </div>
    );
}
