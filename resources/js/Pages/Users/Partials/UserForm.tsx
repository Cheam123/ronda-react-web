import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import Field from '@/Components/form/Field';
import FormActions from '@/Components/form/FormActions';
import Select from '@/Components/form/Select';
import TextInput from '@/Components/form/TextInput';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import { digitsOnly } from '@/lib/input';
import type { SelectOption } from '@/types';
import type { User } from '../types';

const GENDERS: SelectOption[] = [
    { value: 'M', label: 'Male' },
    { value: 'F', label: 'Female' },
];

const STATUSES: SelectOption[] = [
    { value: 1, label: 'Active' },
    { value: 2, label: 'Inactive' },
];

const YES_NO: SelectOption[] = [
    { value: 1, label: 'Yes' },
    { value: 0, label: 'No' },
];

interface EditableUserFormProps {
    user?: User;
    teams: SelectOption[];
    userTypes: SelectOption[];
}

/** Create or edit a user. Posts to users.store / users.update. */
export default function UserForm({ user, teams, userTypes }: EditableUserFormProps) {
    const { data, setData, post, processing, errors } = useForm({
        id: user?.id ?? '',
        name: user?.name ?? '',
        team: String(user?.team ?? ''),
        type: String(user?.type ?? ''),
        telegram_chat_id: user?.telegram_chat_id ?? '',
        gender: user?.gender ?? '',
        email: user?.email ?? '',
        mobile: user?.mobile ?? '',
        // "statuss" is the field name UserRequest validates.
        statuss: String(user?.status ?? ''),
        enable_notification: String(user?.enable_notification ?? ''),
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(user ? route('users.update') : route('users.store'));
    };

    return (
        <form onSubmit={submit}>
            <ErrorSummary />

            <Field label="Name" htmlFor="name" required error={errors.name}>
                <TextInput
                    id="name"
                    maxLength={255}
                    value={data.name}
                    onChange={(event) => setData('name', event.target.value)}
                />
            </Field>

            {user && (
                <Field label="Username" htmlFor="username">
                    <TextInput id="username" value={user.username ?? ''} readOnly />
                </Field>
            )}

            <div className="row">
                <Field label="Team" htmlFor="team" required error={errors.team} className="col-md-6">
                    <Select
                        id="team"
                        placeholder="-- Select your choice --"
                        options={teams}
                        value={data.team}
                        onChange={(event) => setData('team', event.target.value)}
                    />
                </Field>
                <Field label="User Type" htmlFor="type" required error={errors.type} className="col-md-6">
                    <Select
                        id="type"
                        placeholder="-- Select your choice --"
                        options={userTypes}
                        value={data.type}
                        onChange={(event) => setData('type', event.target.value)}
                    />
                </Field>
            </div>

            <div className="row">
                <Field label="Chat ID" htmlFor="telegram_chat_id" className="col-md-6">
                    <TextInput
                        id="telegram_chat_id"
                        maxLength={50}
                        value={data.telegram_chat_id}
                        onChange={(event) => setData('telegram_chat_id', event.target.value)}
                    />
                </Field>
                <Field label="Gender" htmlFor="gender" required error={errors.gender} className="col-md-6">
                    <Select
                        id="gender"
                        placeholder="-- Select Gender --"
                        options={GENDERS}
                        value={data.gender}
                        onChange={(event) => setData('gender', event.target.value as 'M' | 'F' | '')}
                    />
                </Field>
            </div>

            <div className="row">
                <Field label="Email" htmlFor="email" required error={errors.email} className="col-md-6">
                    <TextInput
                        id="email"
                        type="email"
                        maxLength={255}
                        value={data.email}
                        onChange={(event) => setData('email', event.target.value)}
                    />
                </Field>
                <Field label="Mobile" htmlFor="mobile" required error={errors.mobile} className="col-md-6">
                    <TextInput
                        id="mobile"
                        type="tel"
                        maxLength={15}
                        onKeyDown={digitsOnly}
                        value={data.mobile}
                        onChange={(event) => setData('mobile', event.target.value)}
                    />
                </Field>
            </div>

            <div className="row">
                <Field label="Status" htmlFor="statuss" required error={errors.statuss} className="col-md-6">
                    <Select
                        id="statuss"
                        placeholder="-- Select Status --"
                        options={STATUSES}
                        value={data.statuss}
                        onChange={(event) => setData('statuss', event.target.value)}
                    />
                </Field>
                <Field
                    label="Enable Notification"
                    htmlFor="enable_notification"
                    required
                    error={errors.enable_notification}
                    className="col-md-6"
                >
                    <Select
                        id="enable_notification"
                        placeholder="-- Select Status --"
                        options={YES_NO}
                        value={data.enable_notification}
                        onChange={(event) => setData('enable_notification', event.target.value)}
                    />
                </Field>
            </div>

            <FormActions backHref={route('users.index')} submitLabel="Save" processing={processing} />
        </form>
    );
}
