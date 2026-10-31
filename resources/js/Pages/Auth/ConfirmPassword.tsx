import { Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import Field from '@/Components/form/Field';
import PasswordInput from '@/Components/form/PasswordInput';
import GuestLayout from '@/Layouts/GuestLayout';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({ password: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('password.confirm'), { onFinish: () => reset('password') });
    };

    return (
        <GuestLayout
            title="Confirm your password"
            heading="Confirm your password"
            lede="This step is protected. Enter your password to go on."
        >
            <form className="rd-guest__form" onSubmit={submit} noValidate>
                <Field label="Password" htmlFor="password" error={errors.password}>
                    <PasswordInput
                        id="password"
                        required
                        autoComplete="current-password"
                        autoFocus
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
                    Confirm
                </button>
                <p className="rd-guest__alt">
                    <Link href={route('password.request')}>Forgot your password?</Link>
                </p>
            </form>
        </GuestLayout>
    );
}
