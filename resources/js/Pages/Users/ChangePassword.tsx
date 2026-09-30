import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import Field from '@/Components/form/Field';
import TextInput from '@/Components/form/TextInput';
import Button from '@/Components/ui/Button';
import Card from '@/Components/ui/Card';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import AppLayout from '@/Layouts/AppLayout';

/** Change the signed-in user's password (users.updatepassword). */
export default function ChangePassword() {
    const { data, setData, post, processing, errors, reset } = useForm({ oldpass: '', pass1: '', pass2: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('users.updatepassword'), { onError: () => reset() });
    };

    return (
        <AppLayout title="User Profile">
            <Card>
                <ErrorSummary />
                <form onSubmit={submit} style={{ maxWidth: 480 }}>
                    <Field label="Current Password" htmlFor="oldpass" error={errors.oldpass}>
                        <TextInput
                            id="oldpass"
                            type="password"
                            large
                            minLength={6}
                            maxLength={12}
                            autoComplete="current-password"
                            placeholder="Current Password"
                            value={data.oldpass}
                            onChange={(event) => setData('oldpass', event.target.value)}
                        />
                    </Field>
                    <Field label="New Password" htmlFor="pass1" error={errors.pass1}>
                        <TextInput
                            id="pass1"
                            type="password"
                            large
                            minLength={6}
                            maxLength={12}
                            autoComplete="new-password"
                            placeholder="6-12 characters"
                            value={data.pass1}
                            onChange={(event) => setData('pass1', event.target.value)}
                        />
                    </Field>
                    <Field label="Re-enter Password" htmlFor="pass2" error={errors.pass2}>
                        <TextInput
                            id="pass2"
                            type="password"
                            large
                            minLength={6}
                            maxLength={12}
                            autoComplete="new-password"
                            placeholder="6-12 characters"
                            value={data.pass2}
                            onChange={(event) => setData('pass2', event.target.value)}
                        />
                    </Field>
                    <div className="d-flex gap-2">
                        <Button type="submit" className="action-button" loading={processing}>
                            Save
                        </Button>
                        <Button variant="secondary" shadow={false} onClick={() => reset()}>
                            Reset
                        </Button>
                    </div>
                </form>
            </Card>
        </AppLayout>
    );
}
