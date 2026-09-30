import { Link, useForm, usePage } from '@inertiajs/react';
import type { FormEvent } from 'react';
import AuthField from '@/Components/form/AuthField';
import Button from '@/Components/ui/Button';
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
        <GuestLayout title="Reset Password">
            <div className="card">
                <div className="card-body p-4">
                    <div className="text-center mt-2">
                        <h5 className="text-primary">Reset Password</h5>
                    </div>
                    <div className="p-2 mt-4">
                        {flash.status && (
                            <div className="alert alert-success mb-4" role="alert">
                                {flash.status}
                            </div>
                        )}
                        <form onSubmit={submit}>
                            <AuthField
                                id="email"
                                label="Email"
                                type="text"
                                autoComplete="username"
                                placeholder="Enter email"
                                value={data.email}
                                onChange={(event) => setData('email', event.target.value)}
                                error={errors.email}
                            />
                            <div className="mt-3 text-end">
                                <Button type="submit" className="w-sm" shadow={false} loading={processing}>
                                    Reset
                                </Button>
                            </div>
                            <div className="mt-4 text-center">
                                <p className="mb-0">
                                    Remember it?{' '}
                                    <Link href={route('login')} className="fw-medium text-primary">
                                        Sign in
                                    </Link>
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </GuestLayout>
    );
}
