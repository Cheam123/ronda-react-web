import clsx from 'clsx';
import type { RecordTimeline } from './types';

interface ReviewTimelineProps {
    timeline: RecordTimeline;
    submittedBy: string;
    /** The viewer can act on the current step. */
    canAct: boolean;
    waitingFor: string[];
}

/** "Approval Progress": submitted, then each step with who acted and when. */
export default function ReviewTimeline({ timeline, submittedBy, canAct, waitingFor }: ReviewTimelineProps) {
    const { stages, current_id: currentId, legacy_reject: legacyReject, process_open: processOpen } = timeline;
    const totalSteps = 1 + stages.length + (legacyReject ? 1 : 0) + (processOpen ? 1 : 0);

    return (
        <div className="rs-timeline">
            <div className="rs-step">
                <div className="rs-step-rail">
                    <div className="rs-step-dot rs-step-dot--done">✓</div>
                    {totalSteps > 1 && <div className="rs-step-line rs-step-line--done" />}
                </div>
                <div className="rs-step-body">
                    <div className="rs-step-title">Submitted</div>
                    <div className="rs-step-sub rs-step-sub--muted">
                        {submittedBy} &middot; {timeline.submitted_on}
                    </div>
                </div>
            </div>

            {stages.map((stage, index) => {
                const done = stage.status === 'approved' || stage.status === 'completed';
                const rejected = stage.status === 'rejected';
                const current = stage.id === currentId;
                const last = index === stages.length - 1 && !legacyReject && !processOpen;

                return (
                    <div key={stage.id} className="rs-step">
                        <div className="rs-step-rail">
                            <div
                                className={clsx(
                                    'rs-step-dot',
                                    rejected
                                        ? 'rs-step-dot--rejected'
                                        : done
                                          ? 'rs-step-dot--done'
                                          : current
                                            ? 'rs-step-dot--current'
                                            : 'rs-step-dot--pending',
                                )}
                            >
                                {rejected ? '✕' : done ? '✓' : ''}
                            </div>
                            {!last && (
                                <div
                                    className={clsx(
                                        'rs-step-line',
                                        done ? 'rs-step-line--done' : 'rs-step-line--muted',
                                    )}
                                />
                            )}
                        </div>
                        <div className="rs-step-body">
                            <div className={clsx('rs-step-title', current && 'rs-step-title--current')}>
                                {stage.name}
                                {stage.is_fill ? (
                                    <span className="rs-step-tag">handler</span>
                                ) : (
                                    stage.approval_mode === 'all' && <span className="rs-step-tag">everyone</span>
                                )}
                                {stage.iteration >= 2 && <span className="rs-step-tag">round {stage.iteration}</span>}
                            </div>

                            {done ? (
                                <div className="rs-step-sub rs-step-sub--done">
                                    {stage.acted_by ?? 'N/A'} &middot; {stage.acted_at} &middot;{' '}
                                    {stage.is_fill ? 'Completed' : 'Approved'}
                                </div>
                            ) : rejected ? (
                                <>
                                    <div className="rs-step-sub rs-step-sub--rejected">
                                        {stage.acted_by ?? 'N/A'} &middot; {stage.acted_at} &middot; Rejected
                                    </div>
                                    {stage.remark && <div className="rs-step-remark">&quot;{stage.remark}&quot;</div>}
                                </>
                            ) : current ? (
                                <div className="rs-step-sub rs-step-sub--current">
                                    In progress &mdash;{' '}
                                    {canAct ? 'you' : waitingFor.length ? waitingFor.join(', ') : 'pending'}
                                </div>
                            ) : (
                                <div className="rs-step-sub rs-step-sub--muted">Pending</div>
                            )}
                        </div>
                    </div>
                );
            })}

            {legacyReject && (
                <div className="rs-step">
                    <div className="rs-step-rail">
                        <div className="rs-step-dot rs-step-dot--rejected">✕</div>
                    </div>
                    <div className="rs-step-body">
                        <div className="rs-step-title">Rejected</div>
                        <div className="rs-step-sub rs-step-sub--rejected">By {legacyReject.by}</div>
                        {legacyReject.remark && <div className="rs-step-remark">&quot;{legacyReject.remark}&quot;</div>}
                    </div>
                </div>
            )}

            {processOpen && (
                <div className="rs-step">
                    <div className="rs-step-rail">
                        <div className="rs-step-dot rs-step-dot--pending rs-step-dot--tentative" />
                    </div>
                    <div className="rs-step-body">
                        <div className="rs-step-title text-muted">More steps may follow</div>
                        <div className="rs-step-sub rs-step-sub--muted">
                            Decided by the answers as the flow continues
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
