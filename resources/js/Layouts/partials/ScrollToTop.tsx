import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { scrollBehaviour } from '@/lib/focus';

/** Bottom-right button that appears once the page is scrolled down. */
export default function ScrollToTop() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > 20);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <button
            type="button"
            className={clsx('scroll-to-top', visible && 'visible')}
            aria-label="Back to top"
            onClick={() => window.scrollTo({ top: 0, behavior: scrollBehaviour() })}
        >
            <i className="mdi mdi-arrow-up" aria-hidden="true" />
        </button>
    );
}
