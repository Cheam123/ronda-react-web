import { Head, Link } from '@inertiajs/react';
import Logo from '@/Components/surface/Logo';

const MESSAGES: Record<number, { title: string; description: string }> = {
    401: { title: 'Please sign in', description: 'You need to be signed in to see this page.' },
    403: {
        title: 'You don’t have access to this page',
        description: 'Your role doesn’t include it. If you need it for your work, ask an admin to change your access.',
    },
    404: {
        title: 'There’s no page here',
        description:
            'The link may be out of date, or the page may have moved. Go back, or start again from the dashboard.',
    },
    429: { title: 'Too many requests', description: 'Wait a minute, then try again.' },
    500: {
        title: 'Something went wrong on our side',
        description: 'Nothing you did caused this. Try again in a moment; if it keeps happening, tell an admin.',
    },
    503: { title: 'Ronda is being updated', description: 'It will be back shortly. Try again in a few minutes.' },
};

/** Rendered by App\Exceptions\Handler for HTTP errors on browser requests: what happened, and two ways on. */
export default function Status({ status }: { status: number }) {
    const { title, description } = MESSAGES[status] ?? MESSAGES[500];

    return (
        <>
            <Head title={title} />
            <main className="rd-guest">
                <div className="rd-guest__column">
                    <Link href="/index" className="rd-guest__logo">
                        <Logo alt="Ronda" height={40} />
                    </Link>
                    <section className="rd-guest__card rd-guest__card--error" aria-labelledby="rd-error-title">
                        <p className="rd-guest__code">Error {status}</p>
                        <h1 id="rd-error-title" className="rd-guest__title">
                            {title}
                        </h1>
                        <p className="rd-guest__lede">{description}</p>
                        <div className="rd-guest__actions">
                            <button type="button" className="rd-btn rd-btn--lg" onClick={() => window.history.back()}>
                                <i className="mdi mdi-arrow-left" aria-hidden="true" />
                                Go back
                            </button>
                            {status === 401 ? (
                                <Link href={route('login')} className="rd-btn rd-btn--primary rd-btn--lg">
                                    Sign in
                                </Link>
                            ) : (
                                <Link href="/index" className="rd-btn rd-btn--primary rd-btn--lg">
                                    Go to the dashboard
                                </Link>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}
