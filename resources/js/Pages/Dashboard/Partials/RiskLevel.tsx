import clsx from 'clsx';

const LEVELS = {
    overdue: { icon: 'mdi mdi-alert-octagon', label: 'Overdue' },
    at_risk: { icon: 'mdi mdi-alert', label: 'At risk' },
};

/** "Overdue" / "At risk" with its warning icon. */
export default function RiskLevel({ level }: { level: keyof typeof LEVELS }) {
    const { icon, label } = LEVELS[level];

    return (
        <span className={clsx('dash-level', `dash-level--${level}`)}>
            <i className={icon} /> {label}
        </span>
    );
}
