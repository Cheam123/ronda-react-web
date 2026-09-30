import { Head, Link } from '@inertiajs/react';

const MESSAGES: Record<number, { title: string; description: string }> = {
    401: { title: 'Unauthorized', description: 'Please sign in to continue.' },
    403: { title: 'Forbidden', description: 'You do not have access to this page.' },
    404: { title: 'Not Found', description: 'The page you are looking for does not exist.' },
    429: { title: 'Too Many Requests', description: 'Please wait a moment and try again.' },
    500: { title: 'Server Error', description: 'Something went wrong on our side. Please try again.' },
    503: { title: 'Service Unavailable', description: 'Ronda is getting an update. Back soon.' },
};

/** Rendered by App\Exceptions\Handler for HTTP errors on browser requests. */
export default function Status({ status }: { status: number }) {
    const { title, description } = MESSAGES[status] ?? MESSAGES[500];

    return (
        <>
            <Head title={title} />
            <div className="guest-layout d-flex align-items-center justify-content-center">
                <div className="text-center px-3">
                    <img src="/assets/brand/ronda-logo.svg" alt="Ronda" height={40} className="mb-4" />
                    <h1 className="display-4 fw-semibold text-primary mb-1">{status}</h1>
                    <h4 className="text-uppercase mb-2">{title}</h4>
                    <p className="text-muted mb-4">{description}</p>
                    <Link href="/index" className="btn btn-primary">
                        Go Home
                    </Link>
                </div>
            </div>
        </>
    );
}
