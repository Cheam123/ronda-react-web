import { Link } from '@inertiajs/react';
import Initials from '@/Components/surface/Initials';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import UserDetails from './Partials/UserDetails';
import type { User } from './types';

/** The signed-in user's own profile. */
export default function Profile({ user }: { user: User }) {
    return (
        <AppLayout title="Your profile">
            <SurfacePage>
                <PageHeader
                    crumbs={[{ label: 'Home', href: '/index' }, { label: 'Your profile' }]}
                    leading={<Initials name={user.name} colorKey={user.id} size="xl" />}
                    title={user.name}
                    meta={
                        <>
                            <span>{user.type_label}</span>
                            {user.username && <span className="rd-mono">{user.username}</span>}
                        </>
                    }
                    actions={
                        <Link href={route('users.changepassword')} className="rd-btn rd-btn--lg">
                            <i className="mdi mdi-lock-outline" aria-hidden="true" />
                            Change password
                        </Link>
                    }
                />

                <section className="rd-panel user-card" aria-labelledby="details-title">
                    <h2 id="details-title" className="rd-panel__title">
                        Your details
                    </h2>
                    <UserDetails user={user} settings={false} />
                    <p className="rd-panel__sub">Ask an admin to change these.</p>
                </section>
            </SurfacePage>
        </AppLayout>
    );
}
