import { useState, type ReactNode } from 'react';
import Field from '@/Components/form/Field';
import SearchSelect, { MultiSearchSelect } from '@/Components/form/SearchSelect';
import Switch from '@/Components/form/Switch';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import { useToast } from '@/Components/feedback/ToastProvider';
import GroupNameModal from '@/Components/forms/GroupNameModal';
import { RadioCards } from '@/Components/surface/Choices';
import { FormRow, FormSection } from '@/Components/surface/FormSection';
import { pluralize } from '@/lib/format';
import type { FormGroupOption, FormSettings, Person } from '@/types/forms';

export interface BasicInfo {
    name: string;
    description: string;
    is_enabled: '1' | '0';
    form_group_id: string;
}

export type Access = FormSettings['access'];

/** What the last Next found missing: a detail, or nobody picked under "Selected". */
export type InfoProblem = keyof BasicInfo | 'access';

interface BasicInfoStepProps {
    info: BasicInfo;
    onInfo: (patch: Partial<BasicInfo>) => void;
    access: Access;
    onAccess: (access: Access) => void;
    groups: FormGroupOption[];
    onGroupCreated: (group: FormGroupOption) => void;
    users: Person[];
    types: Person[];
    invalid: InfoProblem[];
    /** Who can submit, in words ("Everyone", "2 people and 1 user type"). */
    submitters: string;
    /** For "This form so far". */
    fieldCount: number;
    stepCount: number;
    /** Cancel and Next, at the foot of the form. */
    foot: ReactNode;
}

const DESCRIPTION_MAX = 255;

/** Step 1, Details: name, description, group, status and who can submit. */
export default function BasicInfoStep({
    info,
    onInfo,
    access,
    onAccess,
    groups,
    onGroupCreated,
    users,
    types,
    invalid,
    submitters,
    fieldCount,
    stepCount,
    foot,
}: BasicInfoStepProps) {
    const toast = useToast();
    const [creatingGroup, setCreatingGroup] = useState(false);
    const group = groups.find((option) => String(option.id) === info.form_group_id);

    const pick = (key: 'user_ids' | 'user_types', values: string[]) =>
        onAccess({ ...access, [key]: values.map(Number) });

    const summary = [
        {
            label: 'Details',
            text: [
                group ? `In the ${group.name} group` : 'No group yet',
                submitters === 'Everyone' ? 'open to everyone' : `open to ${submitters}`,
            ].join(', '),
        },
        { label: 'Fields', text: fieldCount > 0 ? pluralize(fieldCount, 'field') : 'None yet' },
        {
            label: 'Process',
            text:
                stepCount > 0
                    ? pluralize(stepCount, 'step')
                    : 'No steps yet, so a submission is approved straight away',
        },
    ];

    return (
        <div className="rd-form-page form-builder__details">
            <form className="rd-form" noValidate onSubmit={(event) => event.preventDefault()}>
                <FormSection title="About the form" intro="How it shows in the forms list and on Start a form.">
                    <Field
                        label="Name"
                        htmlFor="form_name"
                        required
                        error={invalid.includes('name') ? 'Give the form a name.' : undefined}
                    >
                        <TextInput
                            id="form_name"
                            large
                            placeholder="e.g. Discount approval"
                            invalid={invalid.includes('name')}
                            value={info.name}
                            onChange={(event) => onInfo({ name: event.target.value })}
                        />
                    </Field>
                    <Field
                        label="Description"
                        htmlFor="description"
                        required
                        error={invalid.includes('description') ? 'Say what the form is for.' : undefined}
                    >
                        <TextArea
                            id="description"
                            rows={3}
                            maxLength={DESCRIPTION_MAX}
                            placeholder="What it is for, and who looks at it"
                            invalid={invalid.includes('description')}
                            value={info.description}
                            onChange={(event) => onInfo({ description: event.target.value })}
                        />
                        <span className="rd-form__counter">
                            {info.description.length} / {DESCRIPTION_MAX}
                        </span>
                    </Field>
                    <FormRow>
                        <Field
                            label="Group"
                            htmlFor="form_group_id"
                            required
                            error={invalid.includes('form_group_id') ? 'Choose a group for this form.' : undefined}
                        >
                            <SearchSelect
                                id="form_group_id"
                                placeholder="Choose a group"
                                invalid={invalid.includes('form_group_id')}
                                options={groups.map((option) => ({ value: option.id, label: option.name }))}
                                value={info.form_group_id}
                                onChange={(value) => onInfo({ form_group_id: value })}
                            />
                            <button type="button" className="form-builder__link" onClick={() => setCreatingGroup(true)}>
                                New group
                            </button>
                        </Field>
                        <div className="rd-field">
                            <span className="rd-field__label">Status</span>
                            <Switch
                                id="is_enabled"
                                checked={info.is_enabled === '1'}
                                onChange={(checked) => onInfo({ is_enabled: checked ? '1' : '0' })}
                                label="Open for submissions"
                                description="Turn off to hide it from Start a form without deleting it."
                            />
                        </div>
                    </FormRow>
                </FormSection>

                <FormSection title="Who can submit" intro="Everyone, or only the people and user types you pick.">
                    <RadioCards
                        legend={<span className="visually-hidden">Who can submit</span>}
                        name="submit_scope"
                        options={[
                            { value: 'everyone', label: 'Everyone', description: 'Anyone who signs in to Ronda.' },
                            {
                                value: 'selected',
                                label: 'Selected people and user types',
                                description: 'Only the ones you pick below.',
                            },
                        ]}
                        value={access.submit_scope}
                        onChange={(value) =>
                            onAccess(
                                value === 'selected'
                                    ? { ...access, submit_scope: 'selected' }
                                    : { submit_scope: 'everyone', user_ids: [], user_types: [] },
                            )
                        }
                    />
                    {access.submit_scope === 'selected' && (
                        <>
                            <Field label="People" htmlFor="access_users">
                                <MultiSearchSelect
                                    id="access_users"
                                    placeholder="Add people"
                                    invalid={invalid.includes('access')}
                                    options={users.map((user) => ({ value: user.id, label: user.name }))}
                                    value={access.user_ids}
                                    onChange={(values) => pick('user_ids', values)}
                                />
                            </Field>
                            <Field
                                label="User types"
                                htmlFor="access_types"
                                error={
                                    invalid.includes('access') ? 'Pick at least one person or user type.' : undefined
                                }
                                hint="Someone may submit if they are picked by name or are one of these user types."
                            >
                                <MultiSearchSelect
                                    id="access_types"
                                    placeholder="Add user types"
                                    invalid={invalid.includes('access')}
                                    options={types.map((type) => ({ value: type.id, label: type.name }))}
                                    value={access.user_types}
                                    onChange={(values) => pick('user_types', values)}
                                />
                            </Field>
                        </>
                    )}
                </FormSection>

                {foot}
            </form>

            <aside className="rd-form-page__aside">
                <section className="rd-panel">
                    <h2 className="rd-panel__title">This form so far</h2>
                    <ol className="form-builder__so-far">
                        {summary.map((item, index) => (
                            <li key={item.label} className={index === 0 ? 'is-current' : undefined}>
                                <span className="form-builder__so-far-mark" aria-hidden="true">
                                    {index + 1}
                                </span>
                                <span className="form-builder__so-far-text">
                                    <span className="form-builder__so-far-label">{item.label}</span>
                                    <span className="rd-muted">{item.text}</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                </section>
                <p className="form-builder__aside-note">
                    Nothing is saved until the last step. You can go back to any step before then.
                </p>
            </aside>

            {/* Create a group without leaving the half-written form. */}
            <GroupNameModal
                show={creatingGroup}
                onHide={() => setCreatingGroup(false)}
                action={route('form.groups.store')}
                title="New group"
                submitLabel="Create group"
                hint="Groups sort the forms list. This form goes into the new group straight away."
                existing={groups.map((option) => option.name)}
                onSaved={({ message, group: created }) => {
                    setCreatingGroup(false);
                    if (created) onGroupCreated(created);
                    toast(message);
                }}
            />
        </div>
    );
}
