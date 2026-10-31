import { Link } from '@inertiajs/react';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';

interface CustomErrorProps {
    response: {
        title: string;
        message?: string[];
    };
}

/** The "access error" page controllers render when a user may not see something: why, and two ways on. */
export default function CustomError({ response }: CustomErrorProps) {
    return (
        <AppLayout title={response.title}>
            <SurfacePage>
                <PageHeader
                    crumbs={[{ label: 'Home', href: '/index' }, { label: response.title }]}
                    title={response.title}
                />
                <section className="rd-panel rd-access-error" aria-label="What happened">
                    <span className="rd-icon rd-icon--lg rd-icon--critical">
                        <i className="mdi mdi-lock-outline" aria-hidden="true" />
                    </span>
                    <div className="rd-access-error__text">
                        {response.message?.map((line, index) => (
                            <p key={index}>{line}</p>
                        ))}
                        <div className="rd-access-error__actions">
                            <button type="button" className="rd-btn rd-btn--lg" onClick={() => window.history.back()}>
                                <i className="mdi mdi-arrow-left" aria-hidden="true" />
                                Go back
                            </button>
                            <Link href="/index" className="rd-btn rd-btn--primary rd-btn--lg">
                                Go to the dashboard
                            </Link>
                        </div>
                    </div>
                </section>
            </SurfacePage>
        </AppLayout>
    );
}
