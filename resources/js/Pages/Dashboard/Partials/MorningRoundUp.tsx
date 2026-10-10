import { router } from '@inertiajs/react';
import clsx from 'clsx';
import { useState } from 'react';
import { renderLines, sectionsOf, type AiSection } from '@/lib/aiSections';
import type { DailyDigest } from '../types';

// The digest's sections (DailyDigestService): Summary, Focus alerts, Team, Focus today.
function SectionBlock({ section }: { section: AiSection }) {
    return (
        <div className="dash-roundup__section">
            {section.label && <h3 className="dash-roundup__label">{section.label}</h3>}
            <div className="dash-roundup__text">{renderLines(section.lines)}</div>
        </div>
    );
}

interface MorningRoundUpProps {
    digest: DailyDigest | null;
    status: string | null;
    className?: string;
}

/**
 * The AI daily brief managers see (DailyDigestService), across the top of the
 * team dashboard: the summary, what to focus on today, and the rest on request.
 */
export default function MorningRoundUp({ digest, status, className }: MorningRoundUpProps) {
    const [regenerating, setRegenerating] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const sections = digest ? sectionsOf(digest.content) : [];
    const named = (name: string) => sections.find((section) => section.label?.toLowerCase() === name);
    const summary = named('summary') ?? sections.find((section) => section.label === null);
    const focus = named('focus today');
    const rest = sections.filter((section) => section !== summary && section !== focus);

    const regenerate = () => {
        router.post(
            route('dashboard.digest'),
            {},
            {
                preserveScroll: true,
                onStart: () => setRegenerating(true),
                onFinish: () => setRegenerating(false),
            },
        );
    };

    return (
        <section className={clsx('dash-roundup', className)} aria-labelledby="roundup-title">
            <div className="dash-roundup__main">
                <div className="dash-roundup__head">
                    <span className="rd-icon rd-icon--lg rd-icon--dark">
                        <i className="mdi mdi-creation" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 id="roundup-title" className="dash-roundup__title">
                            Morning Round-Up
                        </h2>
                        {digest && (
                            <p className="dash-roundup__source">
                                {digest.date_label} &middot;{' '}
                                {digest.source === 'bedrock'
                                    ? 'Written by Claude (Amazon Bedrock)'
                                    : 'Template summary (Bedrock not configured or unavailable)'}
                            </p>
                        )}
                    </div>
                </div>

                {status && (
                    <div className="dash-roundup__status" role="status">
                        {status}
                    </div>
                )}

                {!digest ? (
                    <p className="dash-roundup__empty">
                        No Morning Round-Up yet. It is written at 7:00 AM each day. Press Regenerate to write one now.
                    </p>
                ) : summary ? (
                    <div className="dash-roundup__summary">{renderLines(summary.lines)}</div>
                ) : (
                    // Not in the usual shape: show it all rather than guess.
                    sections.map((section, index) => <SectionBlock key={index} section={section} />)
                )}
            </div>

            <div className="dash-roundup__side">
                {focus && <SectionBlock section={focus} />}

                <div className="dash-roundup__actions">
                    <button
                        type="button"
                        className="rd-btn rd-btn--sm"
                        title="Write today's Morning Round-Up again from the latest figures"
                        disabled={regenerating}
                        onClick={regenerate}
                    >
                        {regenerating ? (
                            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                        ) : (
                            <i className="mdi mdi-refresh" aria-hidden="true" />
                        )}
                        Regenerate
                    </button>
                    {summary && rest.length > 0 && (
                        <button
                            type="button"
                            className="dash-roundup__more"
                            aria-expanded={expanded}
                            aria-controls="roundup-rest"
                            onClick={() => setExpanded((open) => !open)}
                        >
                            {expanded ? 'Show less' : 'Read the whole round-up'}
                            <i className={`mdi mdi-chevron-${expanded ? 'up' : 'down'}`} aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>

            {summary && rest.length > 0 && (
                <div id="roundup-rest" className="dash-roundup__rest" hidden={!expanded}>
                    {rest.map((section, index) => (
                        <SectionBlock key={index} section={section} />
                    ))}
                </div>
            )}
        </section>
    );
}
