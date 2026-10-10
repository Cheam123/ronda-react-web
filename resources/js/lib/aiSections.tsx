import type { ReactNode } from 'react';

/**
 * Claude's write-ups (the Morning Round-Up, the visit brief) are plain text
 * in labelled sections: short lines ending in ":" are labels, "- " lines
 * bullets, anything else a paragraph.
 */
export interface AiSection {
    /** "Summary", "Watch out"; null for text before the first label. */
    label: string | null;
    lines: string[];
}

export function sectionsOf(content: string): AiSection[] {
    const sections: AiSection[] = [];

    content.split(/\r\n|\r|\n/).forEach((raw) => {
        const line = raw.trim();

        if (line.endsWith(':') && line.length <= 30) {
            sections.push({ label: line.slice(0, -1), lines: [] });
            return;
        }

        if (sections.length === 0) sections.push({ label: null, lines: [] });
        if (line !== '') sections[sections.length - 1].lines.push(line);
    });

    return sections.filter((section) => section.lines.length > 0);
}

/** A section's lines as paragraphs, runs of bullets becoming one list. */
export function renderLines(lines: string[]): ReactNode[] {
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

    lines.forEach((line) => {
        if (line.startsWith('- ')) {
            bullets.push(line.slice(2));
            return;
        }

        flushBullets();
        blocks.push(<p key={blocks.length}>{line}</p>);
    });

    flushBullets();

    return blocks;
}
