import { Head, Link, router } from '@inertiajs/react';
import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import FlashMessages from '@/Components/feedback/FlashMessages';
import { useBodyAttributes } from '@/hooks/useBodyAttributes';
import Breadcrumbs, { type BreadcrumbTrail } from './partials/Breadcrumbs';
import NavMenu from './partials/NavMenu';
import ScrollToTop from './partials/ScrollToTop';
import UserMenu from './partials/UserMenu';

interface AppLayoutProps {
    /** The browser tab title. */
    title: string;
    /** Header breadcrumb after "Home"; omit to show none. */
    breadcrumb?: BreadcrumbTrail | null;
    children: ReactNode;
}

/** The signed-in shell: header, top navigation and page container. */
export default function AppLayout({ title, breadcrumb, children }: AppLayoutProps) {
    const [menuOpen, setMenuOpen] = useState(false);

    useBodyAttributes({ 'data-layout': 'horizontal', 'data-topbar': 'light' });

    // Close the phone menu once the user has picked a page.
    useEffect(() => router.on('navigate', () => setMenuOpen(false)), []);

    return (
        <>
            <Head title={title} />
            <FlashMessages />

            <div id="layout-wrapper">
                <header id="page-topbar">
                    <div className="navbar-header">
                        <div className="d-flex align-items-center">
                            <div className="navbar-brand-box ms-3">
                                <Link href="/index" className="logo logo-dark">
                                    <span className="logo-sm">
                                        <img src="/assets/brand/ronda-logo.svg" alt="Ronda" height={26} />
                                    </span>
                                    <span className="logo-lg">
                                        <img src="/assets/brand/ronda-logo.svg" alt="Ronda" height={26} />
                                    </span>
                                </Link>
                            </div>

                            <button
                                type="button"
                                className="btn btn-sm px-3 font-size-16 d-lg-none header-item"
                                aria-label="Toggle navigation"
                                aria-expanded={menuOpen}
                                onClick={() => setMenuOpen((open) => !open)}
                            >
                                <i className="fa fa-fw fa-bars" />
                            </button>

                            {breadcrumb && <Breadcrumbs trail={breadcrumb} />}
                        </div>

                        <div className="d-flex">
                            <UserMenu />
                        </div>
                    </div>

                    <div className="container-fluid">
                        <div className="topnav">
                            <nav className="navbar navbar-light navbar-expand-lg topnav-menu">
                                <div
                                    className={clsx('collapse navbar-collapse', menuOpen && 'show')}
                                    id="topnav-menu-content"
                                >
                                    <NavMenu />
                                </div>
                            </nav>
                        </div>
                    </div>
                </header>

                <div className="main-content">
                    <div className="page-content">
                        <div className="container-fluid">{children}</div>
                    </div>
                </div>
            </div>

            <ScrollToTop />
        </>
    );
}
