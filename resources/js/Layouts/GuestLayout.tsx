import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import FlashMessages from '@/Components/feedback/FlashMessages';

interface GuestLayoutProps {
    title: string;
    /** Width of the centred card column. */
    wide?: boolean;
    children: ReactNode;
}

/** Signed-out pages (login, password reset): a logo over a centred card. */
export default function GuestLayout({ title, wide = false, children }: GuestLayoutProps) {
    return (
        <>
            <Head title={title} />
            <FlashMessages />

            <div className="guest-layout account-pages pt-5">
                <div className="container">
                    <div className="text-center">
                        <Link href="/index" className="mb-5 d-inline-block auth-logo">
                            <img src="/assets/brand/ronda-logo.svg" alt="Ronda" height={60} className="logo" />
                        </Link>
                    </div>
                    <div className="row align-items-center justify-content-center">
                        <div className={wide ? 'col-md-10 col-lg-8' : 'col-md-8 col-lg-6 col-xl-5'}>
                            {children}
                            <p className="mt-5 text-center text-muted">© {new Date().getFullYear()} Ronda</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
