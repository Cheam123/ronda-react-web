import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import FlashMessages from '@/Components/feedback/FlashMessages';
import Logo from '@/Components/surface/Logo';

interface GuestLayoutProps {
    /** The browser tab title. */
    title: string;
    /** The card's heading. */
    heading: string;
    /** A line under the heading. */
    lede?: ReactNode;
    children: ReactNode;
}

/** Signed-out pages (sign in, password reset): the logo over one card on the grey ground. */
export default function GuestLayout({ title, heading, lede, children }: GuestLayoutProps) {
    return (
        <>
            <Head title={title} />
            <FlashMessages />

            <main className="rd-guest">
                <div className="rd-guest__column">
                    <Link href="/index" className="rd-guest__logo">
                        <Logo alt="Ronda" height={40} />
                    </Link>
                    <section className="rd-guest__card" aria-labelledby="rd-guest-title">
                        <div className="rd-guest__head">
                            <h1 id="rd-guest-title" className="rd-guest__title">
                                {heading}
                            </h1>
                            {lede && <p className="rd-guest__lede">{lede}</p>}
                        </div>
                        {children}
                    </section>
                    <p className="rd-guest__foot">© {new Date().getFullYear()} Ronda</p>
                </div>
            </main>
        </>
    );
}
