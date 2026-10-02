import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState, type ReactNode } from 'react';
import FlashMessages from '@/Components/feedback/FlashMessages';
import { useBodyAttributes } from '@/hooks/useBodyAttributes';
import Breadcrumbs, { type BreadcrumbTrail } from './partials/Breadcrumbs';
import { NavBar, NavSheet } from './partials/NavMenu';
import ScrollToTop from './partials/ScrollToTop';
import UserMenu, { UserSheet } from './partials/UserMenu';

interface AppLayoutProps {
    /** The browser tab title. */
    title: string;
    /** A breadcrumb after "Home" for pages without a PageHeader; omit to show none. */
    breadcrumb?: BreadcrumbTrail | null;
    children: ReactNode;
}

/** The signed-in shell: one top bar (a menu sheet on phones) over the page. */
export default function AppLayout({ title, breadcrumb, children }: AppLayoutProps) {
    const [menuOpen, setMenuOpen] = useState(false);

    useBodyAttributes({ 'data-layout': 'horizontal', 'data-topbar': 'light' });

    // Close the phone menu once the user has picked a page.
    useEffect(() => router.on('navigate', () => setMenuOpen(false)), []);

    return (
        <>
            <Head title={title} />
            <FlashMessages />

            <a href="#main" className="rd-skip">
                Skip to the page
            </a>

            <div className="rd-shell">
                <header className="rd-topbar">
                    <div className="rd-topbar__inner">
                        <Link href="/index" className="rd-topbar__brand">
                            <img src="/assets/brand/ronda-logo.svg" alt="Ronda, home" height={26} />
                        </Link>

                        <NavBar />

                        <div className="rd-topbar__end">
                            <UserMenu />
                            <button
                                type="button"
                                className="rd-topbar__toggle"
                                aria-label={menuOpen ? 'Close the menu' : 'Open the menu'}
                                aria-expanded={menuOpen}
                                aria-controls="rd-sheet"
                                onClick={() => setMenuOpen((open) => !open)}
                            >
                                <i className={menuOpen ? 'mdi mdi-close' : 'mdi mdi-menu'} aria-hidden="true" />
                            </button>
                        </div>
                    </div>

                    {menuOpen && (
                        <div id="rd-sheet" className="rd-sheet">
                            <NavSheet />
                            <UserSheet />
                        </div>
                    )}
                </header>

                <main id="main" className="rd-shell__main main-content" tabIndex={-1}>
                    <div className="rd-shell__page">
                        {breadcrumb && <Breadcrumbs trail={breadcrumb} />}
                        {children}
                    </div>
                </main>
            </div>

            <ScrollToTop />
        </>
    );
}
