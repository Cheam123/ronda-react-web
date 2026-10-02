import { useState } from 'react';
import Field from '@/Components/form/Field';
import { MultiSearchSelect } from '@/Components/form/SearchSelect';
import Switch from '@/Components/form/Switch';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import { Choices } from '@/Components/surface/Choices';
import { conditionCount } from '@/lib/forms/conditions';
import type { DesignSection } from '@/lib/forms/design';
import { TYPES_WITH_VALUES, typeLabel } from '@/lib/forms/schema';
import type { ConditionSchema, FieldElement, FormElement, Person } from '@/types/forms';
import ConditionEditor from './ConditionEditor';
import OptionsEditor from './OptionsEditor';

type Subject = { kind: 'element'; element: FormElement } | { kind: 'group'; section: DesignSection };

interface SettingsPanelProps {
    subject: Subject | null;
    /** Fields a visibility condition may look at (every other input field). */
    sources: FieldElement[];
    people: Person[];
    onElementChange: (patch: Partial<FormElement>) => void;
    onSectionChange: (patch: Partial<DesignSection>) => void;
}

/** The right-hand panel: the selected field's settings and when it shows. */
export default function SettingsPanel({
    subject,
    sources,
    people,
    onElementChange,
    onSectionChange,
}: SettingsPanelProps) {
    const conditions = subject
        ? subject.kind === 'group'
            ? subject.section.visible_when
            : subject.element.visible_when
        : null;
    // The editor opens on "Add a condition", or straight away when there are some.
    const [editing, setEditing] = useState(conditionCount(conditions) > 0);

    if (!subject) {
        return (
            <div className="builder-settings__empty">
                <span className="rd-icon rd-icon--neutral">
                    <i className="mdi mdi-cursor-default-click-outline" aria-hidden="true" />
                </span>
                <p>Pick a field in the preview to change it.</p>
            </div>
        );
    }

    const subjectId = subject.kind === 'group' ? subject.section.id : subject.element.id;
    const setConditions = (schema: ConditionSchema | null) =>
        subject.kind === 'group'
            ? onSectionChange({ visible_when: schema })
            : onElementChange({ visible_when: schema });

    const noun = subject.kind === 'group' ? 'group' : subject.element.kind === 'description' ? 'text' : 'field';
    const kind =
        subject.kind === 'group'
            ? 'Group'
            : subject.element.kind === 'description'
              ? 'Description'
              : typeLabel(subject.element.type);
    const name =
        subject.kind === 'group'
            ? subject.section.label
            : subject.element.kind === 'description'
              ? ''
              : subject.element.label;

    return (
        <div className="builder-settings">
            <div className="builder-settings__head">
                <span className="builder-settings__title">
                    <span className="builder-pane__sub">Selected {noun}</span>
                    <span className="builder-pane__title">{name || `Untitled ${noun}`}</span>
                </span>
                <span className="rd-chip">{kind}</span>
            </div>

            <div className="builder-settings__body">
                {subject.kind === 'group' ? (
                    <Field label="Group name" htmlFor={`label-${subjectId}`} required>
                        <TextInput
                            id={`label-${subjectId}`}
                            large
                            placeholder="e.g. Outlet and price"
                            value={subject.section.label}
                            onChange={(event) => onSectionChange({ label: event.target.value })}
                        />
                        <span className="rd-field__hint">
                            Drag fields into the group in the preview. Hiding the group hides every field in it.
                        </span>
                    </Field>
                ) : subject.element.kind === 'description' ? (
                    <Field
                        label="Text"
                        htmlFor={`text-${subjectId}`}
                        required
                        hint="Shown on the form as it is. Nobody fills it in."
                    >
                        <TextArea
                            id={`text-${subjectId}`}
                            rows={4}
                            placeholder="e.g. Attach the customer's quote if you have one."
                            value={subject.element.text}
                            onChange={(event) => onElementChange({ text: event.target.value })}
                        />
                    </Field>
                ) : (
                    <FieldSettings element={subject.element} people={people} onChange={onElementChange} />
                )}

                <div className="rd-field">
                    <span className="rd-field__label">Show this {noun}</span>
                    {editing ? (
                        <>
                            <ConditionEditor
                                key={subjectId}
                                initial={conditions}
                                onChange={setConditions}
                                sources={sources}
                                people={people}
                                startWithBlock
                            />
                            <span className="rd-field__hint">
                                Everything in a set must match. With several sets, any one is enough. Remove every
                                condition to show it always.
                            </span>
                        </>
                    ) : (
                        <>
                            <div className="builder-settings__always">
                                <span>Always</span>
                                <button
                                    type="button"
                                    className="rd-btn rd-btn--sm"
                                    disabled={sources.length === 0}
                                    onClick={() => setEditing(true)}
                                >
                                    <i className="mdi mdi-plus" aria-hidden="true" />
                                    Add a condition
                                </button>
                            </div>
                            <span className="rd-field__hint">
                                {sources.length === 0
                                    ? 'Add another field first. A condition looks at its answer.'
                                    : `For example, only when ${sources[0].label ? `"${sources[0].label}"` : 'another field'} has a certain answer.`}
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function FieldSettings({
    element,
    people,
    onChange,
}: {
    element: FieldElement;
    people: Person[];
    onChange: (patch: Partial<FieldElement>) => void;
}) {
    const id = element.id;
    const hasMinMax = element.type === 'multi-select' || element.type === 'multi-choice';

    return (
        <>
            <Field label="Label" htmlFor={`label-${id}`} required>
                <TextInput
                    id={`label-${id}`}
                    large
                    placeholder="e.g. Requested price per kg"
                    value={element.label}
                    onChange={(event) => onChange({ label: event.target.value })}
                />
            </Field>
            <Field label="Placeholder" htmlFor={`placeholder-${id}`} hint="Shown in the empty box.">
                <TextInput
                    id={`placeholder-${id}`}
                    large
                    placeholder="Leave it empty for the usual text"
                    value={element.placeholder ?? ''}
                    onChange={(event) => onChange({ placeholder: event.target.value })}
                />
            </Field>
            <div className="builder-settings__switch">
                <Switch
                    id={`required-${id}`}
                    checked={element.mandatory}
                    onChange={(mandatory) => onChange({ mandatory })}
                    label="Required"
                    description="They can't submit without it."
                />
            </div>

            {element.type === 'date' && (
                <Field
                    label="Earliest date they can pick"
                    htmlFor={`min-days-${id}`}
                    hint="Leave it empty to allow any date."
                >
                    <div className="rd-affix">
                        <span className="rd-affix__start">Today +</span>
                        <input
                            id={`min-days-${id}`}
                            type="number"
                            min={1}
                            max={365}
                            inputMode="numeric"
                            placeholder="Any"
                            value={element.min_days ?? ''}
                            onChange={(event) =>
                                onChange({ min_days: event.target.value ? parseInt(event.target.value, 10) : null })
                            }
                        />
                        <span className="rd-affix__end">days</span>
                    </div>
                </Field>
            )}

            {hasMinMax && (
                <div className="rd-form__row">
                    <Field label="Pick at least" htmlFor={`min-${id}`}>
                        <TextInput
                            id={`min-${id}`}
                            large
                            type="number"
                            min={1}
                            placeholder="Any"
                            value={element.min ?? ''}
                            onChange={(event) => onChange({ min: event.target.value || null })}
                        />
                    </Field>
                    <Field label="Pick at most" htmlFor={`max-${id}`}>
                        <TextInput
                            id={`max-${id}`}
                            large
                            type="number"
                            min={1}
                            placeholder="No limit"
                            value={element.max ?? ''}
                            onChange={(event) => onChange({ max: event.target.value || null })}
                        />
                    </Field>
                </div>
            )}

            {element.type === 'user' && (
                <>
                    <Choices
                        legend="People to choose from"
                        options={[
                            { value: 'all', label: 'Everyone' },
                            { value: 'selected', label: 'Only some people' },
                        ]}
                        value={element.user_source === 'selected' ? 'selected' : 'all'}
                        required
                        onChange={(value) =>
                            onChange(
                                value === 'selected'
                                    ? { user_source: 'selected' }
                                    : { user_source: 'all', user_ids: [] },
                            )
                        }
                    />
                    {element.user_source === 'selected' && (
                        <Field
                            label="People"
                            htmlFor={`people-${id}`}
                            hint="Only these people show in the list on the form."
                        >
                            <MultiSearchSelect
                                id={`people-${id}`}
                                placeholder="Add people"
                                options={people.map((person) => ({ value: person.id, label: person.name }))}
                                value={element.user_ids ?? []}
                                onChange={(ids) => onChange({ user_ids: ids.map(Number) })}
                            />
                        </Field>
                    )}
                </>
            )}

            {element.type === 'gps' && (
                <Choices
                    legend="When to stamp it"
                    options={[
                        { value: 'auto', label: 'When the form opens' },
                        { value: 'manual', label: 'When they tap Stamp location' },
                    ]}
                    value={element.capture_mode === 'manual' ? 'manual' : 'auto'}
                    required
                    onChange={(value) => onChange({ capture_mode: value === 'manual' ? 'manual' : 'auto' })}
                    hint="The location always comes from the device. Nobody can type it in."
                />
            )}

            {TYPES_WITH_VALUES.includes(element.type) && (
                <div className="rd-field">
                    <span className="rd-field__label">
                        {element.type === 'multi-select' ? 'Categories and options' : 'Options'}
                        <span className="rd-field__required" aria-hidden="true">
                            {' '}
                            *
                        </span>
                    </span>
                    <OptionsEditor key={element.id} element={element} onChange={(values) => onChange({ values })} />
                </div>
            )}
        </>
    );
}
