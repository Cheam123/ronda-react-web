import type { RiskLevel as Level } from '../types';

const LEVELS: Record<Level, { icon: string; label: string; tone: string }> = {
    overdue: { icon: 'mdi-alert-octagon', label: 'Overdue', tone: 'critical' },
    at_risk: { icon: 'mdi-alert', label: 'At risk', tone: 'serious' },
};

/** "Overdue" / "At risk": an icon and a word, never colour alone. */
export default function RiskLevel({ level }: { level: Level }) {
    const { icon, label, tone } = LEVELS[level];

    return (
        <span className={`rd-chip rd-chip--${tone}`}>
            <i className={`mdi ${icon}`} aria-hidden="true" />
            {label}
        </span>
    );
}
