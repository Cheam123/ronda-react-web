import { useState } from 'react';
import GroupNameModal from '@/Components/forms/GroupNameModal';
import SearchSelect from '@/Components/form/SearchSelect';
import Select from '@/Components/form/Select';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import { useToast } from '@/Components/feedback/ToastProvider';
import type { FormGroupOption, FormSettings, Person } from '@/types/forms';
import AccessPicker from './AccessPicker';

export interface BasicInfo {
    name: string;
    description: string;
    is_enabled: '1' | '0';
    form_group_id: string;
}

export type Access = FormSettings['access'];

interface BasicInfoStepProps {
    info: BasicInfo;
    onInfo: (patch: Partial<BasicInfo>) => void;
    access: Access;
    onAccess: (access: Access) => void;
    groups: FormGroupOption[];
    onGroupCreated: (group: FormGroupOption) => void;
    users: Person[];
    types: Person[];
    /** Fields the last Next flagged. */
    invalid: (keyof BasicInfo)[];
}

/** Step 1, Basic Info: name, status, description, who can submit, and the group it is filed in. */
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
}: BasicInfoStepProps) {
    const toast = useToast();
    const [picker, setPicker] = useState<{ open: boolean; key: number }>({ open: false, key: 0 });
    const [creatingGroup, setCreatingGroup] = useState(false);
    const selectedCount = access.user_ids.length + access.user_types.length;

    const openPicker = () => setPicker((current) => ({ open: true, key: current.key + 1 }));

    // Closing the picker with nobody chosen falls back to Everyone.
    const cancelPicker = () => {
        setPicker((current) => ({ ...current, open: false }));
        if (selectedCount === 0) onAccess({ ...access, submit_scope: 'everyone' });
    };

    const applyPicker = ({ users: userIds, types: typeIds }: { users: number[]; types: number[] }) => {
        setPicker((current) => ({ ...current, open: false }));
        onAccess({
            submit_scope: userIds.length + typeIds.length > 0 ? 'selected' : 'everyone',
            user_ids: userIds,
            user_types: typeIds,
        });
    };

    const removePill = (key: 'user_ids' | 'user_types', id: number) => {
        const next = { ...access, [key]: access[key].filter((existing) => existing !== id) };
        onAccess(next.user_ids.length + next.user_types.length === 0 ? { ...next, submit_scope: 'everyone' } : next);
    };

    const pill = (key: 'user_ids' | 'user_types', id: number, name: string) => (
        <span
            key={`${key}-${id}`}
            className={`badge p-2 access-pill access-pill--${key === 'user_ids' ? 'user' : 'type'}`}
        >
            {name}
            <button
                type="button"
                className="access-pill__remove"
                aria-label={`Remove ${name}`}
                onClick={() => removePill(key, id)}
            >
                <i className="mdi mdi-close" />
            </button>
        </span>
    );

    return (
        <div className="card mt-3">
            <div className="card-body">
                <h4 className="card-title mb-4">Basic Info</h4>

                <div className="row">
                    <div className="col-md-6 mb-3">
                        <label className="form-label" htmlFor="form_name">
                            Name <span className="text-danger">*</span>
                        </label>
                        <TextInput
                            id="form_name"
                            large
                            placeholder="Enter form name"
                            invalid={invalid.includes('name')}
                            value={info.name}
                            onChange={(event) => onInfo({ name: event.target.value })}
                        />
                        {invalid.includes('name') && <div className="invalid-feedback">Please enter a name.</div>}
                    </div>
                    <div className="col-md-3 mb-3">
                        <label className="form-label" htmlFor="is_enabled">
                            Status <span className="text-danger">*</span>
                        </label>
                        <Select
                            id="is_enabled"
                            options={[
                                { value: '1', label: 'Enable' },
                                { value: '0', label: 'Disable' },
                            ]}
                            value={info.is_enabled}
                            onChange={(event) => onInfo({ is_enabled: event.target.value === '1' ? '1' : '0' })}
                        />
                    </div>
                </div>

                <div className="row">
                    <div className="col-md-6 mb-3">
                        <label className="form-label" htmlFor="description">
                            Description <span className="text-danger">*</span>
                        </label>
                        <TextArea
                            id="description"
                            rows={2}
                            maxLength={255}
                            placeholder="Max 255 characters"
                            invalid={invalid.includes('description')}
                            value={info.description}
                            onChange={(event) => onInfo({ description: event.target.value })}
                        />
                    </div>
                </div>

                <div className="row">
                    <div className="col-md-6 mb-3">
                        <label className="form-label" htmlFor="submit_scope">
                            Who can submit this form?
                        </label>
                        <Select
                            id="submit_scope"
                            options={[
                                { value: 'everyone', label: 'Everyone' },
                                { value: 'selected', label: 'Selected Members Only' },
                            ]}
                            value={access.submit_scope === 'selected' && selectedCount > 0 ? 'selected' : 'everyone'}
                            onChange={(event) => {
                                if (event.target.value === 'selected') {
                                    openPicker();
                                } else {
                                    onAccess({ submit_scope: 'everyone', user_ids: [], user_types: [] });
                                }
                            }}
                        />
                        {access.submit_scope === 'selected' && selectedCount > 0 && (
                            <div className="mt-2">
                                <div className="d-flex flex-wrap gap-2 align-items-center">
                                    {access.user_ids.map((id) =>
                                        pill(
                                            'user_ids',
                                            id,
                                            users.find((user) => user.id === id)?.name ?? `User #${id}`,
                                        ),
                                    )}
                                    {access.user_types.map((id) =>
                                        pill(
                                            'user_types',
                                            id,
                                            types.find((type) => type.id === id)?.name ?? `Type #${id}`,
                                        ),
                                    )}
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={openPicker}
                                    >
                                        <i className="mdi mdi-pencil-outline me-1" />
                                        Edit
                                    </button>
                                </div>
                                <div className="form-text small mt-2">
                                    A user may submit if they are selected individually <strong>or</strong> are one of
                                    the selected user types.
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="row">
                    <div className="col-md-6 mb-3">
                        <label className="form-label" htmlFor="form_group_id">
                            Group <span className="text-danger">*</span>
                        </label>
                        <div className="group-picker">
                            <SearchSelect
                                id="form_group_id"
                                className="flex-grow-1"
                                placeholder="Select a group…"
                                invalid={invalid.includes('form_group_id')}
                                options={groups.map((group) => ({ value: group.id, label: group.name }))}
                                value={info.form_group_id}
                                onChange={(value) => onInfo({ form_group_id: value })}
                            />
                            <button
                                type="button"
                                className="btn btn-outline-primary group-picker__new"
                                onClick={() => setCreatingGroup(true)}
                            >
                                <i className="mdi mdi-folder-plus-outline me-1" />
                                New group
                            </button>
                        </div>
                        {invalid.includes('form_group_id') && (
                            <div className="invalid-feedback d-block">Choose a group for this form.</div>
                        )}
                        <div className="form-text small mt-2">
                            Groups organise the form list. They do not affect who can submit.
                        </div>
                    </div>
                </div>
            </div>

            <AccessPicker
                key={picker.key}
                show={picker.open}
                users={users}
                types={types}
                initial={{ users: access.user_ids, types: access.user_types }}
                onApply={applyPicker}
                onCancel={cancelPicker}
            />

            {/* Create a group without leaving the half-written form. */}
            <GroupNameModal
                show={creatingGroup}
                onHide={() => setCreatingGroup(false)}
                action={route('form.groups.store')}
                title="Create a group"
                submitLabel="Create group"
                hint="Groups keep the form list navigable. This form will be filed into the new group straight away."
                existing={groups.map((group) => group.name)}
                onSaved={({ message, group }) => {
                    setCreatingGroup(false);
                    if (group) onGroupCreated(group);
                    toast(message);
                }}
            />
        </div>
    );
}
