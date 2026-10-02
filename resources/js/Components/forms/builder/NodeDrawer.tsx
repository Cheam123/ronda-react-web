import { useState } from 'react';
import Offcanvas from 'react-bootstrap/Offcanvas';
import Field from '@/Components/form/Field';
import SearchSelect, { MultiSearchSelect } from '@/Components/form/SearchSelect';
import TextInput from '@/Components/form/TextInput';
import { RadioCards } from '@/Components/surface/Choices';
import type { DesignSection } from '@/lib/forms/design';
import { STEP_META } from '@/lib/forms/process';
import { tagClass } from '@/lib/tags';
import type { FieldElement, Person, StepNode } from '@/types/forms';
import PermissionsTable from './PermissionsTable';

interface NodeDrawerProps {
    show: boolean;
    node: StepNode;
    fields: FieldElement[];
    sections: DesignSection[];
    people: Person[];
    onSave: (node: StepNode) => void;
    onDelete: () => void;
    onHide: () => void;
}

const PEOPLE_KEY = { approval: 'approver_ids', fill: 'assignee_ids', cc: 'user_ids' } as const;

const LEDE = {
    approval: 'They approve or reject the submission.',
    fill: 'They fill in their part of the form. Nobody approves this step.',
    cc: 'They get a notification and can open the record. Nothing waits on them.',
} as const;

/**
 * A step's settings: its name, who it goes to, and what they can see and
 * change. Works on a copy that applies on Save; remount it for each step.
 */
export default function NodeDrawer({
    show,
    node,
    fields,
    sections,
    people,
    onSave,
    onDelete,
    onHide,
}: NodeDrawerProps) {
    const [working, setWorking] = useState<StepNode>(() => structuredClone(node));
    const meta = STEP_META[working.type];
    const peopleKey = PEOPLE_KEY[working.type];
    const patch = (changes: Partial<StepNode>) => setWorking((current) => ({ ...current, ...changes }) as StepNode);

    const personFields = fields.filter((field) => field.type === 'user');
    const optionalFields = personFields.filter((field) => !field.mandatory);
    const mode = working.type === 'fill' ? (working.assignee_mode ?? 'fixed') : 'fixed';
    const picked = working.type === 'fill' ? personFields.find((field) => field.id === working.assignee_field) : null;

    const peoplePicker = (
        <Field label={meta.people} htmlFor="step-people" required>
            <MultiSearchSelect
                id="step-people"
                placeholder="Add people"
                options={people.map((person) => ({ value: person.id, label: person.name }))}
                value={(working as unknown as Record<string, number[]>)[peopleKey] ?? []}
                onChange={(ids) => patch({ [peopleKey]: ids.map(Number) } as Partial<StepNode>)}
            />
        </Field>
    );

    return (
        <Offcanvas
            show={show}
            onHide={onHide}
            placement="end"
            className="rd-drawer"
            backdropClassName="rd-drawer-backdrop"
            aria-labelledby="step-drawer-title"
        >
            <div className="rd-drawer__head">
                <div className="rd-drawer__meta">
                    <span className={tagClass(meta.hue)}>
                        <i className={`mdi ${meta.icon}`} aria-hidden="true" />
                        {meta.label} step
                    </span>
                </div>
                <h2 id="step-drawer-title" className="rd-drawer__title">
                    {working.name.trim() || meta.label}
                </h2>
                <p className="rd-drawer__lede">{LEDE[working.type]}</p>
                <button
                    type="button"
                    className="rd-btn rd-btn--icon rd-drawer__close"
                    aria-label="Close"
                    onClick={onHide}
                >
                    <i className="mdi mdi-close" aria-hidden="true" />
                </button>
            </div>

            <div className="rd-drawer__body">
                <Field label="Step name" htmlFor="step-name" required>
                    <TextInput
                        id="step-name"
                        large
                        value={working.name}
                        onChange={(event) => patch({ name: event.target.value })}
                    />
                </Field>

                {working.type === 'fill' && (
                    <RadioCards
                        legend="Who fills it in"
                        name="assignee_mode"
                        options={[
                            { value: 'fixed', label: 'Specific people', description: 'Chosen here, now.' },
                            {
                                value: 'field',
                                label: 'From a Person field',
                                description: 'Whoever is picked in a Person field on the form.',
                            },
                            {
                                value: 'runtime',
                                label: 'Decided when it gets there',
                                description: 'Whoever finishes the step before picks who.',
                            },
                        ]}
                        value={mode}
                        onChange={(value) => patch({ assignee_mode: value as 'fixed' | 'field' | 'runtime' })}
                    />
                )}

                {working.type === 'fill' && mode === 'field' && (
                    <>
                        {personFields.length === 0 ? (
                            <p className="rd-notice">
                                <i className="mdi mdi-alert-outline" aria-hidden="true" />
                                Add a Person field in Fields first. That is where the person is picked.
                            </p>
                        ) : (
                            <Field
                                label="Person field"
                                htmlFor="step-person-field"
                                required
                                hint={
                                    optionalFields.length > 0
                                        ? 'Only a required Person field can pick who fills in. Turn on Required for it in Fields to use it here.'
                                        : 'The step goes to whoever that field names when it gets here.'
                                }
                            >
                                <SearchSelect
                                    id="step-person-field"
                                    placeholder="Choose a Person field"
                                    clearable={false}
                                    options={personFields.map((field) => ({
                                        value: field.id,
                                        label: `${field.label || 'Untitled field'}${field.mandatory ? '' : ' (not required)'}`,
                                        // Never disable the current pick, or a saved choice would silently drop.
                                        disabled: !field.mandatory && field.id !== working.assignee_field,
                                    }))}
                                    value={working.type === 'fill' ? (working.assignee_field ?? '') : ''}
                                    onChange={(value) => patch({ assignee_field: value || null })}
                                />
                            </Field>
                        )}
                        {picked && !picked.mandatory && (
                            <p className="rd-notice">
                                <i className="mdi mdi-alert-outline" aria-hidden="true" />
                                &ldquo;{picked.label || 'This field'}&rdquo; has to be required before it can pick who
                                fills in. Turn on Required for it in Fields, or choose another field.
                            </p>
                        )}
                    </>
                )}

                {working.type === 'fill' && mode === 'runtime' && (
                    <p className="rd-drawer__note">
                        <i className="mdi mdi-account-arrow-right-outline" aria-hidden="true" />
                        When the step before is done, the person who finished it is asked who fills this in.
                    </p>
                )}

                {(working.type !== 'fill' || mode === 'fixed') && peoplePicker}

                {working.type === 'approval' && (
                    <RadioCards
                        legend="When it is approved"
                        name="approval_mode"
                        options={[
                            { value: 'any', label: 'Any one approves', description: 'The first approval moves it on.' },
                            { value: 'all', label: 'Everyone approves', description: 'It waits for each approver.' },
                        ]}
                        value={working.approval_mode ?? 'any'}
                        onChange={(value) => patch({ approval_mode: value as 'any' | 'all' })}
                    />
                )}

                <PermissionsTable
                    stepType={working.type}
                    fields={fields}
                    sections={sections}
                    permissions={working.field_permissions ?? { default: 'read', overrides: {} }}
                    onChange={(field_permissions) => patch({ field_permissions })}
                />
            </div>

            <div className="rd-drawer__foot">
                <button type="button" className="rd-btn rd-btn--danger-soft rd-btn--lg me-auto" onClick={onDelete}>
                    <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
                    Delete step
                </button>
                <button type="button" className="rd-btn rd-btn--quiet rd-btn--lg" onClick={onHide}>
                    Cancel
                </button>
                <button type="button" className="rd-btn rd-btn--primary rd-btn--lg" onClick={() => onSave(working)}>
                    Save step
                </button>
            </div>
        </Offcanvas>
    );
}
