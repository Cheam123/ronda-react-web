import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import Field from '@/Components/form/Field';
import SearchSelect from '@/Components/form/SearchSelect';
import Switch from '@/Components/form/Switch';
import TextInput from '@/Components/form/TextInput';
import { Choices, RadioCards, type CardOption } from '@/Components/surface/Choices';
import { FormFoot, FormRow, FormSection } from '@/Components/surface/FormSection';
import Initials from '@/Components/surface/Initials';
import PhoneInput from '@/Components/surface/PhoneInput';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import { formatPhone } from '@/lib/phone';
import { tagClass, teamHue } from '@/lib/tags';
import type { SelectOption } from '@/types';
import type { User } from '../types';

const GENDERS: SelectOption[] = [
    { value: 'F', label: 'Female' },
    { value: 'M', label: 'Male' },
];

/** What each user type (User::ABILITIES) can do, beside its name. */
const TYPE_NOTES: Record<string, string> = {
    '0': 'Runs Ronda: users, products, areas and forms.',
    '1': 'Sees every lead, task and IFE report.',
    '2': 'Sees the outlets and tasks they are part of.',
};

interface UserFormProps {
    user?: User;
    teams: SelectOption[];
    userTypes: SelectOption[];
}

/** Create or edit a user. Posts to users.store / users.update. */
export default function UserForm({ user, teams, userTypes }: UserFormProps) {
    const { data, setData, post, processing, errors } = useForm({
        id: user?.id ?? '',
        name: user?.name ?? '',
        team: String(user?.team ?? ''),
        type: String(user?.type ?? ''),
        telegram_chat_id: user?.telegram_chat_id ?? '',
        gender: user?.gender ?? '',
        email: user?.email ?? '',
        mobile: user?.mobile ?? '',
        // "statuss" is the field name UserRequest validates; 1 active, 0 inactive.
        statuss: String(user?.status ?? 1),
        enable_notification: String(user?.enable_notification ?? 1),
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(user ? route('users.update') : route('users.store'));
    };

    const types: CardOption[] = userTypes.map((type) => ({
        value: String(type.value),
        label: type.label,
        description: TYPE_NOTES[String(type.value)] ?? '',
    }));
    const team = teams.find((option) => String(option.value) === data.team);
    const active = data.statuss === '1';

    return (
        <>
            <ErrorSummary />

            <div className="rd-form-page">
                <form className="rd-form" onSubmit={submit} noValidate>
                    <FormSection title="Person" intro="How they show up on tasks, leads and reports.">
                        <FormRow columns={user ? 'minmax(0, 1fr) 220px' : 1}>
                            <Field label="Full name" htmlFor="name" required error={errors.name}>
                                <TextInput
                                    id="name"
                                    large
                                    maxLength={255}
                                    invalid={Boolean(errors.name)}
                                    value={data.name}
                                    onChange={(event) => setData('name', event.target.value)}
                                />
                            </Field>
                            {user && (
                                <Field label="Username" htmlFor="username">
                                    <TextInput
                                        id="username"
                                        large
                                        className="rd-input--mono"
                                        value={user.username ?? ''}
                                        readOnly
                                    />
                                </Field>
                            )}
                        </FormRow>
                        <Choices
                            legend="Gender"
                            required
                            options={GENDERS}
                            value={data.gender}
                            error={errors.gender}
                            onChange={(value) => setData('gender', value as 'M' | 'F' | '')}
                        />
                    </FormSection>

                    <FormSection title="Contact" intro="Where their password and task alerts go.">
                        <FormRow>
                            <Field label="Email" htmlFor="email" required error={errors.email}>
                                <TextInput
                                    id="email"
                                    type="email"
                                    large
                                    maxLength={255}
                                    autoComplete="off"
                                    invalid={Boolean(errors.email)}
                                    value={data.email}
                                    onChange={(event) => setData('email', event.target.value)}
                                />
                            </Field>
                            <Field label="Mobile" htmlFor="mobile" required error={errors.mobile}>
                                <PhoneInput
                                    id="mobile"
                                    required
                                    invalid={Boolean(errors.mobile)}
                                    value={data.mobile}
                                    onChange={(value) => setData('mobile', value)}
                                />
                            </Field>
                        </FormRow>
                        <FormRow>
                            <Field
                                label="Telegram chat ID"
                                htmlFor="telegram_chat_id"
                                error={errors.telegram_chat_id}
                                hint="Task alerts go to this chat."
                            >
                                <TextInput
                                    id="telegram_chat_id"
                                    large
                                    className="rd-input--mono"
                                    inputMode="numeric"
                                    maxLength={50}
                                    value={data.telegram_chat_id}
                                    onChange={(event) => setData('telegram_chat_id', event.target.value)}
                                />
                            </Field>
                            <div className="user-form__switch">
                                <Switch
                                    id="enable_notification"
                                    label="Send task alerts"
                                    description="In the app and on Telegram."
                                    checked={data.enable_notification === '1'}
                                    onChange={(checked) => setData('enable_notification', checked ? '1' : '0')}
                                />
                            </div>
                        </FormRow>
                    </FormSection>

                    <FormSection title="Role" intro="Decides what they can see and change.">
                        <RadioCards
                            legend="User type"
                            name="type"
                            required
                            options={types}
                            value={data.type}
                            error={errors.type}
                            onChange={(value) => setData('type', value)}
                        />
                        <FormRow columns="minmax(0, 320px)">
                            <Field label="Team" htmlFor="team" required error={errors.team}>
                                <SearchSelect
                                    id="team"
                                    placeholder="Choose a team"
                                    options={teams}
                                    clearable={false}
                                    searchable={false}
                                    invalid={Boolean(errors.team)}
                                    value={data.team}
                                    onChange={(value) => setData('team', value)}
                                />
                            </Field>
                        </FormRow>
                    </FormSection>

                    <FormSection title="Access" intro="Switch off instead of deleting when someone leaves.">
                        <Switch
                            id="statuss"
                            label="Active"
                            description="Only active users can be picked for tasks."
                            checked={active}
                            onChange={(checked) => setData('statuss', checked ? '1' : '0')}
                        />
                    </FormSection>

                    <FormFoot
                        cancelHref={user ? route('users.view', user.id) : route('users.index')}
                        submitLabel={user ? 'Save changes' : 'Add user'}
                        processing={processing}
                    />
                </form>

                <aside className="rd-form-page__aside">
                    <section className="rd-panel" aria-labelledby="preview-title">
                        <div>
                            <h2 id="preview-title" className="rd-panel__title">
                                In the users list
                            </h2>
                            <p className="rd-panel__sub">Updates as you type.</p>
                        </div>
                        <div className="user-preview">
                            <Initials name={data.name || '?'} colorKey={user?.id ?? data.name} size="lg" />
                            <span className="rd-person__text">
                                <span className="rd-person__name">{data.name || 'Their name'}</span>
                                <span className="rd-person__sub">
                                    {data.mobile ? formatPhone(data.mobile) : data.email || 'Their mobile'}
                                </span>
                            </span>
                            <span className="user-preview__tags">
                                {active ? (
                                    <span className="rd-chip rd-chip--good">
                                        <span className="rd-dot" />
                                        Active
                                    </span>
                                ) : (
                                    <span className="rd-chip">
                                        <span className="rd-dot" />
                                        Inactive
                                    </span>
                                )}
                                {team && <span className={tagClass(teamHue(Number(team.value)))}>{team.label}</span>}
                            </span>
                        </div>
                    </section>
                </aside>
            </div>
        </>
    );
}
