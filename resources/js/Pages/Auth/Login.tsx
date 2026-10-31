import { Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import Field from '@/Components/form/Field';
import PasswordInput from '@/Components/form/PasswordInput';
import TextInput from '@/Components/form/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';

export default function Login() {
    const { data, setData, post, processing, errors } = useForm({ email: '', password: '' });
    // A wrong email or password comes back as one message for the whole form, not either field.
    const failed = (errors as Record<string, string | undefined>).message;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('login'), { onFinish: () => setData('password', '') });
    };

    return (
        <GuestLayout title="Sign in" heading="Sign in to Ronda" lede="Ready for your round?">
            <form className="rd-guest__form" onSubmit={submit} noValidate>
                {failed && (
                    <div className="rd-notice rd-notice--critical" role="alert">
                        <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                        <span>{failed}</span>
                    </div>
                )}
                <Field label="Email" htmlFor="email" error={errors.email}>
                    <TextInput
                        id="email"
                        type="email"
                        inputMode="email"
                        large
                        required
                        autoComplete="username"
                        autoFocus
                        value={data.email}
                        onChange={(event) => setData('email', event.target.value)}
                    />
                </Field>
                <Field label="Password" htmlFor="password" error={errors.password}>
                    <PasswordInput
                        id="password"
                        required
                        autoComplete="current-password"
                        value={data.password}
                        onChange={(event) => setData('password', event.target.value)}
                    />
                </Field>
                <button
                    type="submit"
                    className="rd-btn rd-btn--primary rd-btn--lg rd-guest__submit"
                    disabled={processing}
                >
                    {processing && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                    Sign in
                </button>
                <p className="rd-guest__alt">
                    <Link href={route('password.request')}>Forgot your password?</Link>
                </p>
            </form>
        </GuestLayout>
    );
}
