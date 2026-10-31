import { Link, useForm, usePage } from '@inertiajs/react';
import type { FormEvent } from 'react';
import Field from '@/Components/form/Field';
import TextInput from '@/Components/form/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import type { PageProps } from '@/types';

export default function ForgotPassword() {
    const { flash } = usePage<PageProps>().props;
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('password.email'));
    };

    return (
        <GuestLayout
            title="Reset your password"
            heading="Reset your password"
            lede="Enter the email you sign in with and Ronda sends you a link to set a new password."
        >
            {flash.status && (
                <p className="rd-guest__status" role="status">
                    <i className="mdi mdi-check-circle-outline" aria-hidden="true" />
                    {flash.status}
                </p>
            )}
            <form className="rd-guest__form" onSubmit={submit} noValidate>
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
                <button
                    type="submit"
                    className="rd-btn rd-btn--primary rd-btn--lg rd-guest__submit"
                    disabled={processing}
                >
                    {processing && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                    Send the link
                </button>
                <p className="rd-guest__alt">
                    Remember it? <Link href={route('login')}>Back to sign in</Link>
                </p>
            </form>
        </GuestLayout>
    );
}
