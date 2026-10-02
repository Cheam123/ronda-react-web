import { Link, router } from '@inertiajs/react';
import Initials from '@/Components/surface/Initials';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import { promptText } from '@/lib/dialogs';
import { tagClass, teamHue } from '@/lib/tags';
import UserDetails from './Partials/UserDetails';
import type { User } from './types';

export default function ShowUser({ user }: { user: User }) {
    const resetPassword = async () => {
        const password = await promptText({
            title: 'Reset Password !',
            text: user.name,
            confirmText: 'Send',
            minLength: 6,
            maxLength: 12,
            required: 'Please enter new password to proceed!',
        });
        if (password) {
            router.post(route('users.resetpassword'), { id: user.id, pwd: password }, { preserveScroll: true });
        }
    };

    return (
        <AppLayout title={user.name}>
            <SurfacePage>
                <PageHeader
                    crumbs={[{ label: 'Admin' }, { label: 'Users', href: route('users.index') }, { label: user.name }]}
                    leading={<Initials name={user.name} colorKey={user.id} size="xl" />}
                    title={user.name}
                    meta={
                        <>
                            {user.status === 1 ? (
                                <span className="rd-chip rd-chip--good">
                                    <span className="rd-dot" />
                                    Active
                                </span>
                            ) : (
                                <span className="rd-chip">
                                    <span className="rd-dot" />
                                    Inactive
                                </span>
                            )}
                            {user.username && <span className="rd-mono">{user.username}</span>}
                            <span>{user.type_label}</span>
                            {user.team_label && <span className={tagClass(teamHue(user.team))}>{user.team_label}</span>}
                        </>
                    }
                    actions={
                        <>
                            <button type="button" className="rd-btn rd-btn--lg" onClick={resetPassword}>
                                <i className="mdi mdi-key-outline" aria-hidden="true" />
                                Reset password
                            </button>
                            <Link href={route('users.edit', user.id)} className="rd-btn rd-btn--primary rd-btn--lg">
                                <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                                Edit user
                            </Link>
                        </>
                    }
                />

                <section className="rd-panel user-card" aria-labelledby="details-title">
                    <h2 id="details-title" className="rd-panel__title">
                        Details
                    </h2>
                    <UserDetails user={user} />
                </section>
            </SurfacePage>
        </AppLayout>
    );
}
