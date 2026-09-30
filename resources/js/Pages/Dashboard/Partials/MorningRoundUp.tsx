import { router } from '@inertiajs/react';
import { useState, type ReactNode } from 'react';
import Button from '@/Components/ui/Button';
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
                <div key={blocks.length} className="dash-digest__label">
                    {line}
                </div>
            ) : (
                <div key={blocks.length}>{line}</div>
            ),
        );
    });

    flushBullets();

    return blocks;
}

interface MorningRoundUpProps {
    digest: DailyDigest | null;
    status: string | null;
}

/** The AI daily brief managers see (DailyDigestService). */
export default function MorningRoundUp({ digest, status }: MorningRoundUpProps) {
    const [regenerating, setRegenerating] = useState(false);

    const regenerate = () => {
        router.post(route('dashboard.digest'), {}, {
            preserveScroll: true,
            onStart: () => setRegenerating(true),
            onFinish: () => setRegenerating(false),
        });
    };

    return (
        <div className="dash-card">
            <div className="d-flex justify-content-between align-items-start">
                <h6>Morning Round-Up</h6>
                <Button
                    variant="outline-secondary"
                    size="sm"
                    shadow={false}
                    className="py-0"
                    icon="mdi mdi-refresh"
                    loading={regenerating}
                    title="Write today's Morning Round-Up again from the latest figures"
                    onClick={regenerate}
                >
                    Regenerate
                </Button>
            </div>

            {status && <div className="alert alert-info py-1 px-2 small mb-2">{status}</div>}

            {digest ? (
                <>
                    <div className="dash-sub mb-1">
                        {digest.date_label} &middot;{' '}
                        {digest.source === 'bedrock'
                            ? 'Written by Claude (Amazon Bedrock)'
                            : 'Template summary (Bedrock not configured or unavailable)'}
                    </div>
                    <div className="dash-digest">{renderDigest(digest.content)}</div>
                </>
            ) : (
                <div className="dash-sub">
                    No Morning Round-Up yet. It is written at 7:00 AM each day. Press Regenerate to write one now.
                </div>
            )}
        </div>
    );
}
