import { ResponseSections } from '@/Components/forms/ResponseField';
import { pluralize } from '@/lib/format';
import type { PreviousRound } from './types';

/**
 * "Earlier rounds": what was filled in before the process looped back.
 * Each round folds away, newest first.
 */
export default function PreviousRoundsCard({
    rounds,
    onImageClick,
}: {
    rounds: PreviousRound[];
    onImageClick: (src: string) => void;
}) {
    if (rounds.length === 0) return null;

    return (
        <section className="rd-panel rd-panel--flush form-record__card" aria-labelledby="earlier-rounds">
            <div className="form-record__card-head">
                <h2 id="earlier-rounds" className="rd-panel__title">
                    Earlier rounds
                </h2>
                <span className="rd-muted">{pluralize(rounds.length, 'round')} before this one</span>
            </div>
            {rounds.map((round) => (
                <details key={round.iteration} className="form-round">
                    <summary className="form-round__summary">
                        <span className="rd-chip">Round {round.iteration}</span>
                        <span className="rd-muted">
                            {round.actors || 'Someone'}
                            {round.closed_at && `, ${round.closed_at}`} · {pluralize(round.field_count, 'field')}
                        </span>
                        <i className="mdi mdi-chevron-down form-round__chevron" aria-hidden="true" />
                    </summary>
                    <div className="form-round__body">
                        {round.sections.length > 0 ? (
                            <ResponseSections sections={round.sections} onImageClick={onImageClick} />
                        ) : (
                            <p className="rd-muted">Nothing was filled in this round.</p>
                        )}
                    </div>
                </details>
            ))}
        </section>
    );
}
