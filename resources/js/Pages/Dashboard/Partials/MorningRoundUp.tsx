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
 * An old one (the 7:00 am run was missed) is folded away behind a line saying
 * so, because its figures disagree with the live ones below it.
 */
export default function MorningRoundUp({ digest, status, className }: MorningRoundUpProps) {
    const [regenerating, setRegenerating] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const stale = digest !== null && !digest.is_today;
    const sections = digest ? sectionsOf(digest.content) : [];
    const named = (name: string) => sections.find((section) => section.label?.toLowerCase() === name);
    const summary = named('summary') ?? sections.find((section) => section.label === null);
    const focus = named('focus today');
    const rest = stale ? sections : sections.filter((section) => section !== summary && section !== focus);

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

    const regenerateButton = (
        <button
            type="button"
            className="rd-btn rd-btn--sm"
            title="Write today's Morning Round-Up from the latest figures"
            disabled={regenerating}
            onClick={regenerate}
        >
            {regenerating ? (
                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            ) : (
                <i className="mdi mdi-refresh" aria-hidden="true" />
            )}
            {stale || !digest ? 'Write today’s now' : 'Regenerate'}
        </button>
    );

    const moreButton = rest.length > 0 && (stale || summary) && (
        <button
            type="button"
            className="dash-roundup__more"
            aria-expanded={expanded}
            aria-controls="roundup-rest"
            onClick={() => setExpanded((open) => !open)}
        >
            {expanded ? 'Show less' : stale ? 'Read the old round-up' : 'Read the whole round-up'}
            <i className={`mdi mdi-chevron-${expanded ? 'up' : 'down'}`} aria-hidden="true" />
        </button>
    );

    return (
        <section
            className={clsx('dash-roundup', (stale || !digest) && 'dash-roundup--folded', className)}
            aria-labelledby="roundup-title"
        >
            <div className="dash-roundup__main">
                <div className="dash-roundup__head">
                    <span className="rd-icon rd-icon--lg rd-icon--dark">
                        <i className="mdi mdi-creation" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 id="roundup-title" className="dash-roundup__title">
                            Morning Round-Up
                        </h2>
                        {digest && !stale && (
                            <p className="dash-roundup__source">
                                {digest.date_label} &middot;{' '}
                                {digest.source === 'bedrock'
                                    ? 'Written by Claude (Amazon Bedrock)'
                                    : 'Template summary (Bedrock not configured or unavailable)'}
                            </p>
                        )}
                    </div>
                    {stale && (
                        <span className="rd-chip rd-chip--serious">
                            <i className="mdi mdi-calendar-alert" aria-hidden="true" />
                            Not written today
                        </span>
                    )}
                </div>

                {status && (
                    <div className="dash-roundup__status" role="status">
                        {status}
                    </div>
                )}

                {!digest ? (
                    <p className="dash-roundup__lede">
                        No Morning Round-Up yet. It is written at 7:00 am each day, or now if you ask for it.
                    </p>
                ) : stale ? (
                    <p className="dash-roundup__lede">
                        Today’s round-up hasn’t been written. The last one is from {digest.date_label}, and its figures
                        are out of date, so it is folded away. The figures below are live.
                    </p>
                ) : summary ? (
                    <div className="dash-roundup__summary">{renderLines(summary.lines)}</div>
                ) : (
                    // Not in the usual shape: show it all rather than guess.
                    sections.map((section, index) => <SectionBlock key={index} section={section} />)
                )}

                {(stale || !digest) && (
                    <div className="dash-roundup__actions">
                        {regenerateButton}
                        {moreButton}
                    </div>
                )}
            </div>

            {digest && !stale && (
                <div className="dash-roundup__side">
                    {focus && <SectionBlock section={focus} />}
                    <div className="dash-roundup__actions">
                        {regenerateButton}
                        {moreButton}
                    </div>
                </div>
            )}

            {rest.length > 0 && (stale || summary) && (
                <div id="roundup-rest" className="dash-roundup__rest" hidden={!expanded}>
                    {stale && <p className="dash-roundup__source dash-roundup__from">From {digest?.date_label}</p>}
                    {rest.map((section, index) => (
                        <SectionBlock key={index} section={section} />
                    ))}
                </div>
            )}
        </section>
    );
}
