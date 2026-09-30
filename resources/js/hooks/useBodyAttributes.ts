import { useEffect } from 'react';

/**
 * The Minible theme keys its layout off <body> attributes and classes
 * (data-layout="horizontal", authentication-bg, ...). Layouts set theirs
 * here and remove them again when another layout takes over.
 */
export function useBodyAttributes(attributes: Record<string, string>, className?: string) {
    const key = JSON.stringify(attributes);

    useEffect(() => {
        const entries = Object.entries(JSON.parse(key) as Record<string, string>);
        entries.forEach(([name, value]) => document.body.setAttribute(name, value));
        if (className) document.body.classList.add(className);

        return () => {
            entries.forEach(([name]) => document.body.removeAttribute(name));
            if (className) document.body.classList.remove(className);
        };
    }, [key, className]);
}
