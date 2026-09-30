import { Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import AuthField from '@/Components/form/AuthField';
import Button from '@/Components/ui/Button';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import GuestLayout from '@/Layouts/GuestLayout';

export default function Login() {
    const { data, setData, post, processing, errors } = useForm({ email: '', password: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('login'), { onFinish: () => setData('password', '') });
    };

    return (
        <GuestLayout title="Login">
            <div className="card">
                <div className="card-body p-4">
                    <div className="text-center mt-2">
                        <h5 className="text-primary">Ready for your round?</h5>
                        <p className="text-muted">Sign in.</p>
                    </div>
                    <div className="p-2 mt-4">
                        <ErrorSummary />
                        <form onSubmit={submit}>
                            <AuthField
                                id="email"
                                label="Email"
                                type="text"
                                required
                                autoComplete="username"
                                placeholder="Enter Email"
                                value={data.email}
                                onChange={(event) => setData('email', event.target.value)}
                                error={errors.email}
                            />
                            <AuthField
                                id="password"
                                label="Password"
                                type="password"
                                required
                                autoComplete="current-password"
                                placeholder="Enter password"
                                value={data.password}
                                onChange={(event) => setData('password', event.target.value)}
                                error={errors.password}
                            />
                            <div className="mt-3 d-flex align-items-center justify-content-between">
                                <Link href={route('password.request')} className="text-muted">
                                    Forgot password?
                                </Link>
                                <Button type="submit" className="w-sm" shadow={false} loading={processing}>
                                    Log In
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </GuestLayout>
    );
}
