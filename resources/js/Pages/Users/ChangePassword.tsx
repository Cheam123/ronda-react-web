import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import Field from '@/Components/form/Field';
import PasswordInput from '@/Components/form/PasswordInput';
import { FormFoot, FormSection } from '@/Components/surface/FormSection';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import AppLayout from '@/Layouts/AppLayout';
import { PASSWORD_HINT, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/password';

/** Change the signed-in user's password (users.updatepassword). */
export default function ChangePassword() {
    const { data, setData, post, processing, errors, reset } = useForm({ oldpass: '', pass1: '', pass2: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('users.updatepassword'), { onError: () => reset() });
    };

    return (
        <AppLayout title="Change your password">
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Your profile', href: route('users.profile') },
                        { label: 'Change password' },
                    ]}
                    title="Change your password"
                />

                <ErrorSummary />

                <form className="rd-form rd-form--narrow" onSubmit={submit} noValidate>
                    <FormSection title="Current password" intro="To check it is you.">
                        <Field label="Current password" htmlFor="oldpass" error={errors.oldpass}>
                            <PasswordInput
                                id="oldpass"
                                autoComplete="current-password"
                                value={data.oldpass}
                                onChange={(event) => setData('oldpass', event.target.value)}
                            />
                        </Field>
                    </FormSection>
                    <FormSection title="New password" intro="For signing in here and in the Ronda app.">
                        <Field label="New password" htmlFor="pass1" error={errors.pass1} hint={PASSWORD_HINT}>
                            <PasswordInput
                                id="pass1"
                                minLength={PASSWORD_MIN}
                                maxLength={PASSWORD_MAX}
                                autoComplete="new-password"
                                value={data.pass1}
                                onChange={(event) => setData('pass1', event.target.value)}
                            />
                        </Field>
                        <Field label="Type it again" htmlFor="pass2" error={errors.pass2}>
                            <PasswordInput
                                id="pass2"
                                maxLength={PASSWORD_MAX}
                                autoComplete="new-password"
                                value={data.pass2}
                                onChange={(event) => setData('pass2', event.target.value)}
                            />
                        </Field>
                    </FormSection>
                    <FormFoot
                        cancelHref={route('users.profile')}
                        submitLabel="Change password"
                        processing={processing}
                    />
                </form>
            </SurfacePage>
        </AppLayout>
    );
}
