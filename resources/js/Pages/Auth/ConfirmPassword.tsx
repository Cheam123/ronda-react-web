import { Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import AuthField from '@/Components/form/AuthField';
import Button from '@/Components/ui/Button';
import GuestLayout from '@/Layouts/GuestLayout';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({ password: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('password.confirm'), { onFinish: () => reset('password') });
    };

    return (
        <GuestLayout title="Confirm Password">
            <div className="card">
                <div className="card-body p-4">
                    <div className="text-center mt-2">
                        <h5 className="text-primary">Confirm Password</h5>
                        <p className="text-muted">Please confirm your password before continuing.</p>
                    </div>
                    <div className="p-2 mt-4">
                        <form onSubmit={submit}>
                            <AuthField
                                id="password"
                                label="Password"
                                type="password"
                                required
                                autoComplete="current-password"
                                value={data.password}
                                onChange={(event) => setData('password', event.target.value)}
                                error={errors.password}
                            />
                            <div className="mt-3 d-flex align-items-center justify-content-between">
                                <Link href={route('password.request')} className="text-muted">
                                    Forgot your password?
                                </Link>
                                <Button type="submit" className="w-sm" shadow={false} loading={processing}>
                                    Confirm Password
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </GuestLayout>
    );
}
