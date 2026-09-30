import clsx from 'clsx';
import { useState } from 'react';
import { MultiSearchSelect } from '@/Components/form/SearchSelect';
import Select from '@/Components/form/Select';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
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

function Label({ children, required = false }: { children: string; required?: boolean }) {
    return (
        <label className="form-label small fw-semibold">
            {children} {required && <span className="text-danger">*</span>}
        </label>
    );
}

/** The right-hand panel: the selected widget's settings and its visibility conditions. */
export default function SettingsPanel({
    subject,
    sources,
    people,
    onElementChange,
    onSectionChange,
}: SettingsPanelProps) {
    const [tab, setTab] = useState<'basic' | 'visibility'>('basic');

    if (!subject) {
        return (
            <div className="text-muted text-center py-5 px-3">
                <i className="mdi mdi-gesture-tap display-6 d-block mb-2" />
                Select a widget in the preview to configure it.
            </div>
        );
    }

    const subjectId = subject.kind === 'group' ? subject.section.id : subject.element.id;
    const conditions = subject.kind === 'group' ? subject.section.visible_when : subject.element.visible_when;
    const setConditions = (schema: ConditionSchema | null) =>
        subject.kind === 'group'
            ? onSectionChange({ visible_when: schema })
            : onElementChange({ visible_when: schema });

    const title =
        subject.kind === 'group'
            ? 'Group'
            : subject.element.kind === 'description'
              ? 'Description'
              : typeLabel(subject.element.type);

    return (
        <div className="p-3">
            <h5 className="mb-3">{title}</h5>
            <ul className="nav nav-pills nav-fill mb-3">
                {(['basic', 'visibility'] as const).map((name) => (
                    <li key={name} className="nav-item">
                        <button
                            type="button"
                            className={clsx('nav-link py-1', tab === name && 'active')}
                            onClick={() => setTab(name)}
                        >
                            {name === 'basic' ? 'Basic Settings' : 'Visibility Settings'}
                        </button>
                    </li>
                ))}
            </ul>

            {tab === 'basic' ? (
                subject.kind === 'group' ? (
                    <>
                        <div className="mb-3">
                            <Label required>Group name</Label>
                            <TextInput
                                placeholder="e.g. Customer Details"
                                value={subject.section.label}
                                onChange={(event) => onSectionChange({ label: event.target.value })}
                            />
                        </div>
                        <p className="text-muted small mb-0">
                            Drag fields into the group section in the preview. Hiding a group hides all fields inside
                            it.
                        </p>
                    </>
                ) : subject.element.kind === 'description' ? (
                    <div className="mb-3">
                        <Label required>Text</Label>
                        <TextArea
                            rows={4}
                            placeholder="Description shown on the form"
                            value={subject.element.text}
                            onChange={(event) => onElementChange({ text: event.target.value })}
                        />
                    </div>
                ) : (
                    <FieldSettings element={subject.element} people={people} onChange={onElementChange} />
                )
            ) : (
                <>
                    <p className="text-muted small mb-2">
                        Show this widget only when the conditions below match. Conditions in a block must{' '}
                        <strong>all</strong> match (AND); any block matching is enough (OR). Leave empty to always show.
                    </p>
                    <ConditionEditor
                        key={subjectId}
                        initial={conditions}
                        onChange={setConditions}
                        sources={sources}
                        people={people}
                    />
                </>
            )}
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
    const hasMinMax = element.type === 'multi-select' || element.type === 'multi-choice';

    return (
        <>
            <div className="mb-3">
                <Label required>Title</Label>
                <TextInput
                    placeholder="Field title"
                    value={element.label}
                    onChange={(event) => onChange({ label: event.target.value })}
                />
            </div>
            <div className="mb-3">
                <Label>Tooltip / placeholder</Label>
                <TextInput
                    placeholder="Shown inside the empty input"
                    value={element.placeholder ?? ''}
                    onChange={(event) => onChange({ placeholder: event.target.value })}
                />
            </div>
            <div className="form-check form-switch mb-3">
                <input
                    className="form-check-input"
                    type="checkbox"
                    id={`required-${element.id}`}
                    checked={element.mandatory}
                    onChange={(event) => onChange({ mandatory: event.target.checked })}
                />
                <label className="form-check-label small" htmlFor={`required-${element.id}`}>
                    Required
                </label>
            </div>

            {element.type === 'date' && (
                <div className="mb-3">
                    <Label>Minimum date of request</Label>
                    <div className="input-group input-group-sm settings-narrow">
                        <span className="input-group-text">Today +</span>
                        <TextInput
                            type="number"
                            min={1}
                            max={365}
                            placeholder="none"
                            value={element.min_days ?? ''}
                            onChange={(event) =>
                                onChange({ min_days: event.target.value ? parseInt(event.target.value, 10) : null })
                            }
                        />
                        <span className="input-group-text">days</span>
                    </div>
                    <div className="form-text small">The earliest date users may pick. Leave empty for no minimum.</div>
                </div>
            )}

            {hasMinMax && (
                <div className="d-flex gap-2 mb-3">
                    <div className="input-group input-group-sm">
                        <span className="input-group-text">Min</span>
                        <TextInput
                            type="number"
                            min={1}
                            value={element.min ?? ''}
                            onChange={(event) => onChange({ min: event.target.value || null })}
                        />
                    </div>
                    <div className="input-group input-group-sm">
                        <span className="input-group-text">Max</span>
                        <TextInput
                            type="number"
                            min={1}
                            value={element.max ?? ''}
                            onChange={(event) => onChange({ max: event.target.value || null })}
                        />
                    </div>
                </div>
            )}

            {element.type === 'user' && (
                <div className="mb-3">
                    <Label>People to choose from</Label>
                    <Select
                        className="mb-2"
                        options={[
                            { value: 'all', label: 'Everyone' },
                            { value: 'selected', label: 'Selected people only' },
                        ]}
                        value={element.user_source === 'selected' ? 'selected' : 'all'}
                        onChange={(event) =>
                            onChange(
                                event.target.value === 'selected'
                                    ? { user_source: 'selected' }
                                    : { user_source: 'all', user_ids: [] },
                            )
                        }
                    />
                    {element.user_source === 'selected' && (
                        <>
                            <MultiSearchSelect
                                placeholder="Search and select people..."
                                options={people.map((person) => ({ value: person.id, label: person.name }))}
                                value={element.user_ids ?? []}
                                onChange={(ids) => onChange({ user_ids: ids.map(Number) })}
                            />
                            <div className="form-text small">Only these people appear in the picker on the form.</div>
                        </>
                    )}
                </div>
            )}

            {element.type === 'gps' && (
                <div className="mb-3">
                    <Label>When to stamp</Label>
                    <Select
                        options={[
                            { value: 'auto', label: 'As soon as the form opens' },
                            { value: 'manual', label: 'When the user taps "Stamp location"' },
                        ]}
                        value={element.capture_mode === 'manual' ? 'manual' : 'auto'}
                        onChange={(event) =>
                            onChange({ capture_mode: event.target.value === 'manual' ? 'manual' : 'auto' })
                        }
                    />
                    <div className="form-text small">
                        The location always comes from the device. Nobody can type it in.
                    </div>
                </div>
            )}

            {TYPES_WITH_VALUES.includes(element.type) && (
                <>
                    <Label required>Options</Label>
                    <OptionsEditor key={element.id} element={element} onChange={(values) => onChange({ values })} />
                </>
            )}
        </>
    );
}
