import Accordion from 'react-bootstrap/Accordion';
import { ResponseSections } from '@/Components/forms/ResponseField';
import { pluralize } from '@/lib/format';
import type { PreviousRound } from './types';

/**
 * "Earlier rounds": what previous handlers filled in before the process
 * looped back. Collapsed by default, newest first.
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
        <div className="rs-card">
            <div className="rs-card-head">
                <div className="rs-card-title">
                    <i className="mdi mdi-history me-1 text-muted" />
                    Earlier rounds
                </div>
                <span className="rs-card-meta">{pluralize(rounds.length, 'round')} before this one</span>
            </div>
            <div className="rs-card-body pt-3">
                <Accordion flush>
                    {rounds.map((round) => (
                        <Accordion.Item key={round.iteration} eventKey={String(round.iteration)} className="border-0">
                            <Accordion.Header className="previous-round__header">
                                <span className="rs-tag me-2">Round {round.iteration}</span>
                                <span className="text-muted fw-normal">
                                    {round.actors || 'Handler'}
                                    {round.closed_at && ` · ${round.closed_at}`} ·{' '}
                                    {pluralize(round.field_count, 'field')}
                                </span>
                            </Accordion.Header>
                            <Accordion.Body className="px-0 pt-0">
                                {round.sections.length > 0 ? (
                                    <ResponseSections sections={round.sections} onImageClick={onImageClick} />
                                ) : (
                                    <div className="rs-empty py-3">
                                        <p className="mb-0">Nothing was recorded in this round.</p>
                                    </div>
                                )}
                            </Accordion.Body>
                        </Accordion.Item>
                    ))}
                </Accordion>
            </div>
        </div>
    );
}
