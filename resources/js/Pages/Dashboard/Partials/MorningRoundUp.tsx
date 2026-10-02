import { router } from '@inertiajs/react';
import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import type { DailyDigest } from '../types';

/**
 * The digest is plain text: "- " lines are bullets, short lines ending in
 * ":" are headings, anything else a paragraph.
 */
function renderDigest(content: string): ReactNode[] {
    const blocks: ReactNode[] = [];
    let bullets: string[] = [];

    const flushBullets = () => {
        if (bullets.length > 0) {
            blocks.push(
                <ul key={`list-${blocks.length}`}>
                    {bullets.map((bullet, index) => (
                        <li key={index}>{bullet}</li>
                    ))}
                </ul>,
            );
            bullets = [];
        }
    };

    content.split(/\r\n|\r|\n/).forEach((raw) => {
        const line = raw.trim();

        if (line.startsWith('- ')) {
            bullets.push(line.slice(2));
            return;
        }

        flushBullets();

        if (line === '') return;

        blocks.push(
            line.endsWith(':') && line.length <= 30 ? (
                <div key={blocks.length} className="dash-roundup__label">
                    {line.slice(0, -1)}
                </div>
            ) : (
                <p key={blocks.length}>{line}</p>
            ),
        );
    });

    flushBullets();

    return blocks;
}

interface MorningRoundUpProps {
    digest: DailyDigest | null;
    status: string | null;
    className?: string;
}

/** The AI daily brief managers see (DailyDigestService). */
export default function MorningRoundUp({ digest, status, className }: MorningRoundUpProps) {
    const [regenerating, setRegenerating] = useState(false);

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
        <section className={clsx('rd-panel dash-roundup', className)} aria-labelledby="roundup-title">
            <div className="rd-panel__head">
                <div className="d-flex align-items-center gap-3">
                    <span className="rd-icon rd-icon--lg rd-icon--dark">
                        <i className="mdi mdi-creation" aria-hidden="true" />
                    </span>
                    <h2 id="roundup-title" className="rd-panel__title">
                        Morning Round-Up
                    </h2>
                </div>
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
            </div>

            {digest && (
                <p className="dash-roundup__source">
                    {digest.date_label} &middot;{' '}
                    {digest.source === 'bedrock'
                        ? 'Written by Claude (Amazon Bedrock)'
                        : 'Template summary (Bedrock not configured or unavailable)'}
                </p>
            )}

            {status && (
                <div className="dash-roundup__status" role="status">
                    {status}
                </div>
            )}

            <div className="dash-roundup__body">
                {digest ? (
                    renderDigest(digest.content)
                ) : (
                    <p className="rd-muted">
                        No Morning Round-Up yet. It is written at 7:00 AM each day. Press Regenerate to write one now.
                    </p>
                )}
            </div>
        </section>
    );
}
