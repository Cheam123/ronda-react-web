/** "▲ 12.4%" against a comparison period; nothing when there is nothing to compare with. */
export default function ChangeChip({ percent }: { percent: number | null }) {
    if (percent === null) {
        return null;
    }

    const up = percent >= 0;

    return (
        <span className={up ? 'rd-chip rd-chip--good' : 'rd-chip rd-chip--serious'}>
            <i className={`mdi ${up ? 'mdi-trending-up' : 'mdi-trending-down'}`} aria-hidden="true" />
            <span className="visually-hidden">{up ? 'Up' : 'Down'}</span>
            {Math.abs(percent).toFixed(1)}%
        </span>
    );
}
