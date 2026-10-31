import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import Field from '@/Components/form/Field';
import PasswordInput from '@/Components/form/PasswordInput';
import TextInput from '@/Components/form/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { PASSWORD_HINT, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/password';

interface ResetPasswordProps {
    token: string;
    email: string | null;
}

export default function ResetPassword({ token, email }: ResetPasswordProps) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token,
        email: email ?? '',
        password: '',
        password_confirmation: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('password.update'), { onFinish: () => reset('password', 'password_confirmation') });
    };

    return (
        <GuestLayout title="Set a new password" heading="Set a new password">
            <form className="rd-guest__form" onSubmit={submit} noValidate>
                <Field label="Email" htmlFor="email" error={errors.email}>
                    <TextInput
                        id="email"
                        type="email"
                        inputMode="email"
                        large
                        required
                        autoComplete="username"
                        value={data.email}
                        onChange={(event) => setData('email', event.target.value)}
                    />
                </Field>
                <Field label="New password" htmlFor="password" error={errors.password} hint={PASSWORD_HINT}>
                    <PasswordInput
                        id="password"
                        required
                        minLength={PASSWORD_MIN}
                        maxLength={PASSWORD_MAX}
                        autoComplete="new-password"
                        autoFocus
                        value={data.password}
                        onChange={(event) => setData('password', event.target.value)}
                    />
                </Field>
                <Field label="Type it again" htmlFor="password-confirm">
                    <PasswordInput
                        id="password-confirm"
                        required
                        maxLength={PASSWORD_MAX}
                        autoComplete="new-password"
                        value={data.password_confirmation}
                        onChange={(event) => setData('password_confirmation', event.target.value)}
                    />
                </Field>
                <button
                    type="submit"
                    className="rd-btn rd-btn--primary rd-btn--lg rd-guest__submit"
                    disabled={processing}
                >
                    {processing && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                    Save the new password
                </button>
            </form>
        </GuestLayout>
    );
}
