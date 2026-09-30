import { Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import AuthField from '@/Components/form/AuthField';
import Button from '@/Components/ui/Button';
import GuestLayout from '@/Layouts/GuestLayout';

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('register'), { onFinish: () => reset('password', 'password_confirmation') });
    };

    return (
        <GuestLayout title="Register">
            <div className="card">
                <div className="card-body p-4">
                    <div className="text-center mt-2">
                        <h5 className="text-primary">Register Account</h5>
                    </div>
                    <div className="p-2 mt-4">
                        <form onSubmit={submit}>
                            <AuthField
                                id="name"
                                label="Name"
                                type="text"
                                required
                                autoComplete="name"
                                placeholder="Enter name"
                                value={data.name}
                                onChange={(event) => setData('name', event.target.value)}
                                error={errors.name}
                            />
                            <AuthField
                                id="email"
                                label="Email"
                                type="email"
                                required
                                autoComplete="username"
                                placeholder="Enter email"
                                value={data.email}
                                onChange={(event) => setData('email', event.target.value)}
                                error={errors.email}
                            />
                            <AuthField
                                id="password"
                                label="Password"
                                type="password"
                                required
                                autoComplete="new-password"
                                placeholder="Enter password"
                                value={data.password}
                                onChange={(event) => setData('password', event.target.value)}
                                error={errors.password}
                            />
                            <AuthField
                                id="password_confirmation"
                                label="Confirm Password"
                                type="password"
                                required
                                autoComplete="new-password"
                                placeholder="Enter confirm password"
                                value={data.password_confirmation}
                                onChange={(event) => setData('password_confirmation', event.target.value)}
                                error={errors.password_confirmation}
                            />
                            <div className="mt-3 text-end">
                                <Button type="submit" className="w-sm" shadow={false} loading={processing}>
                                    Register
                                </Button>
                            </div>
                            <div className="mt-4 text-center">
                                <p className="text-muted mb-0">
                                    Already have an account?{' '}
                                    <Link href={route('login')} className="fw-medium text-primary">
                                        Login
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
