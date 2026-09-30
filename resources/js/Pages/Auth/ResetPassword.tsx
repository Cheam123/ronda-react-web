import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import AuthField from '@/Components/form/AuthField';
import Button from '@/Components/ui/Button';
import GuestLayout from '@/Layouts/GuestLayout';

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
        <GuestLayout title="Reset Password">
            <div className="card">
                <div className="card-body p-4">
                    <div className="text-center mt-2">
                        <h5 className="text-primary">Reset Password</h5>
                    </div>
                    <div className="p-2 mt-4">
                        <form onSubmit={submit}>
                            <AuthField
                                id="email"
                                label="Email"
                                type="text"
                                required
                                autoComplete="username"
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
                                value={data.password}
                                onChange={(event) => setData('password', event.target.value)}
                                error={errors.password}
                            />
                            <AuthField
                                id="password-confirm"
                                label="Confirm Password"
                                type="password"
                                required
                                autoComplete="new-password"
                                value={data.password_confirmation}
                                onChange={(event) => setData('password_confirmation', event.target.value)}
                            />
                            <div className="mt-3 text-end">
                                <Button type="submit" className="w-sm" shadow={false} loading={processing}>
                                    Reset Password
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </GuestLayout>
    );
}
