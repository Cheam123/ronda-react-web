import DOMPurify from 'dompurify';
import { useMemo, type MouseEvent } from 'react';

interface SafeHtmlProps {
    /** HTML written by users (rich-text remarks, follow-ups from the app). */
    html: string | null | undefined;
    className?: string;
    /** Called with the src of an inline image the user clicks. */
    onImageClick?: (src: string) => void;
}

/**
 * Renders stored user HTML after stripping scripts, event handlers and
 * other unsafe markup. The Blade views printed it raw.
 */
export default function SafeHtml({ html, className, onImageClick }: SafeHtmlProps) {
    const clean = useMemo(() => DOMPurify.sanitize(html ?? ''), [html]);

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;
        if (onImageClick && target instanceof HTMLImageElement && target.src) {
            event.preventDefault();
            onImageClick(target.src);
        }
    };

    return (
        <div
            className={className}
            onClick={onImageClick ? handleClick : undefined}
            dangerouslySetInnerHTML={{ __html: clean }}
        />
    );
}
