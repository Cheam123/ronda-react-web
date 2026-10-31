import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import GuestLayout from '@/Layouts/GuestLayout';

export default function VerifyEmail({ resent }: { resent: boolean }) {
    const { post, processing } = useForm({});

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('verification.resend'));
    };

    return (
        <GuestLayout
            title="Check your email"
            heading="Check your email"
            lede="Before you go on, open the link Ronda sent to your email address."
        >
            {resent && (
                <p className="rd-guest__status" role="status">
                    <i className="mdi mdi-check-circle-outline" aria-hidden="true" />A new link is on its way to your
                    email.
                </p>
            )}
            <form className="rd-guest__form" onSubmit={submit}>
                <button type="submit" className="rd-btn rd-btn--lg rd-guest__submit" disabled={processing}>
                    {processing && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                    Send the link again
                </button>
                <p className="rd-guest__alt">Nothing after a few minutes? Check your spam folder first.</p>
            </form>
        </GuestLayout>
    );
}
