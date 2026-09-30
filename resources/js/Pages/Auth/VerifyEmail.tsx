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
        <GuestLayout title="Verify Your Email Address">
            <div className="card">
                <div className="card-body p-4">
                    <h5 className="text-primary text-center">Verify Your Email Address</h5>
                    {resent && (
                        <div className="alert alert-success" role="alert">
                            A fresh verification link has been sent to your email address.
                        </div>
                    )}
                    <div>
                        Before proceeding, please check your email for a verification link. If you did not receive the
                        email,{' '}
                        <form className="d-inline" onSubmit={submit}>
                            <button type="submit" className="btn btn-link p-0 m-0 align-baseline" disabled={processing}>
                                click here to request another
                            </button>
                        </form>
                        .
                    </div>
                </div>
            </div>
        </GuestLayout>
    );
}
