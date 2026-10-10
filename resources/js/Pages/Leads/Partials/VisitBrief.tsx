import { useState } from 'react';
import { renderLines, sectionsOf } from '@/lib/aiSections';
import { assistantError, callAssistant, writtenWhen } from '@/lib/assistant';
import type { VisitBrief as Brief } from '@/types/leads';

interface VisitBriefProps {
    leadId: number;
    brief: Brief | null;
    /** Claude on Bedrock is set up; otherwise the brief comes from a template. */
    available: boolean;
    onFollowUp: () => void;
}

/**
 * The note a rep reads before a visit (OutletAssistantService::brief()):
 * written when they ask, kept until the outlet changes or the day turns.
 */
export default function VisitBrief({ leadId, brief: initial, available, onFollowUp }: VisitBriefProps) {
    const [brief, setBrief] = useState(initial);
    const [writing, setWriting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const write = async () => {
        setWriting(true);
        setError(null);
        try {
            setBrief(await callAssistant<Brief>('brief', leadId));
        } catch (caught) {
            setError(assistantError(caught, 'The brief could not be written. Please try again.'));
        } finally {
            setWriting(false);
        }
    };

    const writtenToday = brief !== null && new Date(brief.generated_at).toDateString() === new Date().toDateString();

    let source: string;
    if (!brief) {
        source = available
            ? 'Written when you ask, by Claude on Amazon Bedrock.'
            : 'Written from a template: AI is not set up.';
    } else if (brief.source === 'bedrock') {
        source = `Written by Claude (Amazon Bedrock) ${writtenWhen(brief.generated_at)}.`;
    } else {
        const why = brief.fallback === 'unavailable' ? 'Claude could not be reached' : 'AI not configured';
        source = `Template summary (${why}), ${writtenWhen(brief.generated_at)}.`;
    }

    return (
        <section className="rd-panel lead-card lead-brief" aria-labelledby="brief-title" aria-busy={writing}>
            <div className="lead-card__head">
                <h2 id="brief-title" className="rd-panel__title">
                    Visit brief
                </h2>
                {brief && !writing && (
                    <button
                        type="button"
                        className="rd-btn rd-btn--icon"
                        aria-label="Write the visit brief again"
                        title="Write it again"
                        onClick={write}
                    >
                        <i className="mdi mdi-refresh" aria-hidden="true" />
                    </button>
                )}
            </div>

            {writing ? (
                <div className="lead-brief__writing" role="status">
                    <span>Reading this outlet’s visits, orders and tasks…</span>
                    {[34, 92, 78, 30, 88, 64].map((width, index) => (
                        <span key={index} className="lead-brief__bar" style={{ width: `${width}%` }} />
                    ))}
                </div>
            ) : brief ? (
                <>
                    {brief.stale && (
                        <div className="lead-brief__stale">
                            <i className="mdi mdi-information-outline" aria-hidden="true" />
                            <span>
                                {writtenToday
                                    ? 'The outlet has changed since this brief was written.'
                                    : 'This brief was written on an earlier day.'}
                            </span>
                            <button type="button" className="rd-btn rd-btn--sm" onClick={write}>
                                Update
                            </button>
                        </div>
                    )}
                    <div className="lead-brief__sections">
                        {sectionsOf(brief.content).map((section, index) => (
                            <div key={index} className="lead-brief__section">
                                {section.label && <h3 className="lead-brief__label">{section.label}</h3>}
                                <div className="lead-brief__text">{renderLines(section.lines)}</div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    <p className="lead-brief__intro">
                        Before you go: a short note on what they buy, what happened last time and what to raise today.
                    </p>
                    <button type="button" className="rd-btn rd-btn--lg" onClick={write}>
                        <i className="mdi mdi-text-box-outline" aria-hidden="true" />
                        Write a visit brief
                    </button>
                </>
            )}

            {error && (
                <p className="rd-field__error lead-brief__error" role="alert">
                    <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                    {error}
                </p>
            )}

            <div className="lead-brief__foot">
                <p className="lead-brief__source">
                    {source} Uses this outlet’s visits, orders and tasks. Contact details are not sent.
                </p>
                <button type="button" className="rd-btn" onClick={onFollowUp}>
                    <i className="mdi mdi-send-outline" aria-hidden="true" />
                    Draft a follow-up message
                </button>
            </div>
        </section>
    );
}
