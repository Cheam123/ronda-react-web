import clsx from 'clsx';
import { useState } from 'react';
import Offcanvas from 'react-bootstrap/Offcanvas';
import { MultiSearchSelect } from '@/Components/form/SearchSelect';
import Select from '@/Components/form/Select';
import TextInput from '@/Components/form/TextInput';
import Button from '@/Components/ui/Button';
import type { DesignSection } from '@/lib/forms/design';
import { STEP_META } from '@/lib/forms/process';
import type { FieldElement, Person, StepNode } from '@/types/forms';
import PermissionsTable from './PermissionsTable';

interface NodeDrawerProps {
    show: boolean;
    node: StepNode;
    fields: FieldElement[];
    sections: DesignSection[];
    people: Person[];
    onSave: (node: StepNode) => void;
    onHide: () => void;
}

const PEOPLE_KEY = { approval: 'approver_ids', fill: 'assignee_ids', cc: 'user_ids' } as const;
const PEOPLE_TAB = { approval: 'Set Approvers', fill: 'Set Handlers', cc: 'Set Recipients' } as const;
const PEOPLE_LABEL = { approval: 'Approvers', fill: 'Handlers', cc: 'Recipients' } as const;

/**
 * A step's settings: its name, who it goes to, and what they may see and
 * change. Works on a copy that applies on Save; remount it for each step.
 */
export default function NodeDrawer({ show, node, fields, sections, people, onSave, onHide }: NodeDrawerProps) {
    const [working, setWorking] = useState<StepNode>(() => structuredClone(node));
    const [tab, setTab] = useState<'people' | 'permissions'>('people');
    const meta = STEP_META[working.type];
    const peopleKey = PEOPLE_KEY[working.type];
    const patch = (changes: Partial<StepNode>) => setWorking((current) => ({ ...current, ...changes }) as StepNode);

    const personFields = fields.filter((field) => field.type === 'user');
    const optionalFields = personFields.filter((field) => !field.mandatory);

    const peoplePicker = (
        <MultiSearchSelect
            placeholder="Search and select people..."
            options={people.map((person) => ({ value: person.id, label: person.name }))}
            value={(working as unknown as Record<string, number[]>)[peopleKey] ?? []}
            onChange={(ids) => patch({ [peopleKey]: ids.map(Number) } as Partial<StepNode>)}
        />
    );

    const handlerSettings = () => {
        if (working.type !== 'fill') return null;
        const mode = working.assignee_mode ?? 'fixed';
        const picked = personFields.find((field) => field.id === working.assignee_field);

        return (
            <>
                <div className="small text-muted mb-2">
                    Any one handler completes this step by filling their section — no approve/reject.
                </div>
                {(
                    [
                        ['fixed', 'Specific people, chosen now'],
                        ['field', 'Whoever is chosen in a Person field'],
                        ['runtime', 'Decided when the flow reaches this step'],
                    ] as const
                ).map(([value, label]) => (
                    <div key={value} className="form-check">
                        <input
                            className="form-check-input"
                            type="radio"
                            name="assignee_mode"
                            id={`assignee_mode_${value}`}
                            checked={mode === value}
                            onChange={() => patch({ assignee_mode: value })}
                        />
                        <label className="form-check-label small" htmlFor={`assignee_mode_${value}`}>
                            {label}
                        </label>
                    </div>
                ))}

                <div className="mt-2">
                    {mode === 'runtime' && (
                        <div className="lk-runtime-note">
                            <i className="mdi mdi-account-question-outline me-1" />
                            Whoever completes the previous step will be asked to pick the handler at that moment.
                        </div>
                    )}

                    {mode === 'field' &&
                        (personFields.length === 0 ? (
                            <div className="lk-runtime-note">
                                <i className="mdi mdi-alert-outline me-1" />
                                Add a <strong>Person</strong> field in Form Design first — that is where the handler is
                                chosen.
                            </div>
                        ) : (
                            <>
                                {/* Only a required Person field can be trusted to name a handler. */}
                                <Select
                                    aria-label="Person field"
                                    placeholder="Select a Person field…"
                                    options={personFields.map((field) => ({
                                        value: field.id,
                                        label: `${field.label || '(untitled)'}${field.mandatory ? '' : ' — set Required first'}`,
                                        // Never disable the current pick, or a saved choice would silently drop.
                                        disabled: !field.mandatory && field.id !== working.assignee_field,
                                    }))}
                                    value={working.assignee_field ?? ''}
                                    onChange={(event) => patch({ assignee_field: event.target.value || null })}
                                />
                                {optionalFields.length > 0 && (
                                    <div className="lk-runtime-note mt-2">
                                        <i className="mdi mdi-information-outline me-1" />A Person field must always be
                                        answered before it can choose this step’s handler. To use a greyed-out one, open
                                        it in Form Design and tick <strong>Required</strong>.
                                    </div>
                                )}
                                {picked && !picked.mandatory && (
                                    <div className="lk-runtime-note lk-runtime-note--warn mt-2">
                                        <i className="mdi mdi-alert-outline me-1" />“{picked.label || 'This field'}”
                                        must be set to <strong>Required</strong> in Form Design before it can choose
                                        this step’s handler. Tick it there, or pick another field here.
                                    </div>
                                )}
                                <div className="lk-runtime-note mt-2">
                                    <i className="mdi mdi-account-arrow-right-outline me-1" />
                                    The step goes to whoever that field names when the flow gets here.
                                </div>
                            </>
                        ))}

                    {mode === 'fixed' && peoplePicker}
                </div>
            </>
        );
    };

    return (
        <Offcanvas show={show} onHide={onHide} placement="end" className="node-drawer">
            <Offcanvas.Header closeButton className="border-bottom py-3">
                <Offcanvas.Title as="h5" className="d-flex align-items-center">
                    <span className="lk-drawer-dot" style={{ background: meta.color }} />
                    {meta.label} Step
                </Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body className="p-0 d-flex flex-column">
                <div className="flex-grow-1 overflow-auto p-3">
                    <div className="mb-3">
                        <label className="form-label small fw-semibold mb-1" htmlFor="step-name">
                            Step name <span className="text-danger">*</span>
                        </label>
                        <TextInput
                            id="step-name"
                            value={working.name}
                            onChange={(event) => patch({ name: event.target.value })}
                        />
                    </div>

                    <ul className="nav nav-tabs lk-drawer-tabs mb-3">
                        {(['people', 'permissions'] as const).map((name) => (
                            <li key={name} className="nav-item">
                                <button
                                    type="button"
                                    className={clsx('nav-link', tab === name && 'active')}
                                    onClick={() => setTab(name)}
                                >
                                    {name === 'people' ? PEOPLE_TAB[working.type] : 'Form Permissions'}
                                </button>
                            </li>
                        ))}
                    </ul>

                    {tab === 'people' ? (
                        <>
                            <label className="form-label small fw-semibold mb-1">
                                {PEOPLE_LABEL[working.type]} <span className="text-danger">*</span>
                            </label>
                            {working.type === 'fill' ? handlerSettings() : peoplePicker}

                            {working.type === 'approval' && (
                                <>
                                    <hr className="my-3" />
                                    <label className="form-label small fw-semibold mb-1">Approval mode</label>
                                    {(
                                        [
                                            ['any', 'Any one approver is enough'],
                                            ['all', 'Everyone must approve'],
                                        ] as const
                                    ).map(([value, label]) => (
                                        <div key={value} className="form-check">
                                            <input
                                                className="form-check-input"
                                                type="radio"
                                                name="approval_mode"
                                                id={`approval_mode_${value}`}
                                                checked={(working.approval_mode ?? 'any') === value}
                                                onChange={() => patch({ approval_mode: value })}
                                            />
                                            <label
                                                className="form-check-label small"
                                                htmlFor={`approval_mode_${value}`}
                                            >
                                                {label}
                                            </label>
                                        </div>
                                    ))}
                                </>
                            )}
                        </>
                    ) : (
                        <PermissionsTable
                            stepType={working.type}
                            fields={fields}
                            sections={sections}
                            permissions={working.field_permissions ?? { default: 'read', overrides: {} }}
                            onChange={(field_permissions) => patch({ field_permissions })}
                        />
                    )}
                </div>
                <div className="border-top p-3 text-end bg-white">
                    <Button variant="light" shadow={false} onClick={onHide}>
                        Cancel
                    </Button>
                    <Button className="ms-2" shadow={false} onClick={() => onSave(working)}>
                        Save
                    </Button>
                </div>
            </Offcanvas.Body>
        </Offcanvas>
    );
}
