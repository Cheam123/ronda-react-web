import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { RecordTimeline } from './types';

interface ReviewTimelineProps {
    timeline: RecordTimeline;
    submittedBy: string;
    /** The viewer can act on the current step. */
    canAct: boolean;
    waitingFor: string[];
}

type Tone = 'done' | 'rejected' | 'current' | 'later';

function Step({ tone, mark, children }: { tone: Tone; mark: string; children: ReactNode }) {
    return (
        <li className={clsx('form-progress__step', `is-${tone}`)}>
            <span className="form-progress__mark" aria-hidden="true">
                {mark}
            </span>
            <span className="form-progress__text">{children}</span>
        </li>
    );
}

/** "Progress": submitted, then each step with who acted and when. */
export default function ReviewTimeline({ timeline, submittedBy, canAct, waitingFor }: ReviewTimelineProps) {
    const { stages, current_id: currentId, legacy_reject: legacyReject, process_open: processOpen } = timeline;

    return (
        <ol className="form-progress">
            <Step tone="done" mark="✓">
                <span className="form-progress__name">Submitted</span>
                <span className="form-progress__detail">
                    {submittedBy}, {timeline.submitted_on}
                </span>
            </Step>

            {stages.map((stage, index) => {
                const done = stage.status === 'approved' || stage.status === 'completed';
                const rejected = stage.status === 'rejected';
                const current = stage.id === currentId;
                const tone: Tone = rejected ? 'rejected' : done ? 'done' : current ? 'current' : 'later';
                const tags = [
                    stage.is_fill ? 'fill in' : stage.approval_mode === 'all' ? 'everyone approves' : null,
                    stage.iteration >= 2 ? `round ${stage.iteration}` : null,
                ].filter(Boolean);

                return (
                    <Step key={stage.id} tone={tone} mark={rejected ? '✕' : done ? '✓' : String(index + 2)}>
                        <span className="form-progress__name">
                            {stage.name}
                            {tags.map((tag) => (
                                <span key={tag} className="form-progress__tag">
                                    {tag}
                                </span>
                            ))}
                        </span>
                        <span className="form-progress__detail">
                            {done
                                ? `${stage.is_fill ? 'Filled in' : 'Approved'} by ${stage.acted_by ?? 'someone'}, ${stage.acted_at}`
                                : rejected
                                  ? `Rejected by ${stage.acted_by ?? 'someone'}, ${stage.acted_at}`
                                  : current
                                    ? `Waiting on ${canAct ? 'you' : waitingFor.length ? waitingFor.join(', ') : 'the step'}`
                                    : 'Not started'}
                        </span>
                        {rejected && stage.remark && <span className="form-progress__remark">{stage.remark}</span>}
                    </Step>
                );
            })}

            {legacyReject && (
                <Step tone="rejected" mark="✕">
                    <span className="form-progress__name">Rejected</span>
                    <span className="form-progress__detail">By {legacyReject.by ?? 'someone'}</span>
                    {legacyReject.remark && <span className="form-progress__remark">{legacyReject.remark}</span>}
                </Step>
            )}

            {processOpen && <li className="form-progress__more">More steps may follow, depending on the answers.</li>}
        </ol>
    );
}
