import { useState } from 'react';
import SearchSelect from '@/Components/form/SearchSelect';
import TextInput from '@/Components/form/TextInput';
import {
    CONDITION_OPERATORS,
    OPERATOR_LABELS,
    optionList,
    peopleFor,
    TYPES_WITH_VALUES,
    VALUELESS_OPERATORS,
} from '@/lib/forms/schema';
import type { Condition, ConditionOperator, ConditionSchema, FieldElement, Person } from '@/types/forms';

/** A condition row being edited; the field may not be picked yet. */
interface DraftRow {
    key: number;
    field: string;
    operator: ConditionOperator;
    value: string;
}

type Draft = DraftRow[][];

let rowKey = 0;
const nextKey = () => ++rowKey;

function operatorsFor(field: FieldElement | undefined): ConditionOperator[] {
    return field ? (CONDITION_OPERATORS[field.type] ?? CONDITION_OPERATORS.text) : CONDITION_OPERATORS.text;
}

/** "is less than" for a number, "is before" for a date or time. */
function operatorLabel(operator: ConditionOperator, field: FieldElement | undefined): string {
    if (operator === 'gt' || operator === 'lt') {
        if (field?.type === 'number') return operator === 'gt' ? 'is more than' : 'is less than';
        if (field?.type === 'date' || field?.type === 'time') return operator === 'gt' ? 'is after' : 'is before';
    }
    return OPERATOR_LABELS[operator];
}

function newRow(sources: FieldElement[]): DraftRow {
    const field = sources[0];
    return { key: nextKey(), field: field?.id ?? '', operator: operatorsFor(field)[0], value: '' };
}

function toDraft(schema: ConditionSchema | null): Draft {
    return (schema?.groups ?? []).map((group) =>
        group.conditions.map((condition) => ({
            key: nextKey(),
            field: condition.field,
            operator: condition.operator,
            value: condition.value ?? '',
        })),
    );
}

/** Complete rows only; empty sets dropped; nothing left means "always". */
export function serializeConditions(draft: Draft): ConditionSchema | null {
    const groups = draft
        .map((rows) => ({
            logic: 'and' as const,
            conditions: rows
                .filter((row) => row.field && row.operator)
                .map<Condition>((row) => ({
                    field: row.field,
                    operator: row.operator,
                    value: VALUELESS_OPERATORS.includes(row.operator) ? null : row.value,
                })),
        }))
        .filter((group) => group.conditions.length > 0);

    return groups.length > 0 ? { logic: 'or', groups } : null;
}

interface ConditionEditorProps {
    initial: ConditionSchema | null;
    /** Called with every edit (the settings panel saves as you go). */
    onChange: (schema: ConditionSchema | null) => void;
    /** Fields a condition may look at. */
    sources: FieldElement[];
    people: Person[];
    /** Start with one empty set (the path dialog). */
    startWithBlock?: boolean;
}

/**
 * Sets of conditions: everything in a set must match, and any one set
 * matching is enough. Mount it with a `key` per subject: it keeps its own
 * draft, so half-built rows survive while the user edits.
 */
export default function ConditionEditor({
    initial,
    onChange,
    sources,
    people,
    startWithBlock = false,
}: ConditionEditorProps) {
    const [draft, setDraft] = useState<Draft>(() => {
        const loaded = toDraft(initial);
        return loaded.length === 0 && startWithBlock ? [[newRow(sources)]] : loaded;
    });

    const update = (next: Draft) => {
        setDraft(next);
        onChange(serializeConditions(next));
    };

    const patchRow = (blockIndex: number, rowIndex: number, patch: Partial<DraftRow>) =>
        update(
            draft.map((rows, b) =>
                b === blockIndex ? rows.map((row, r) => (r === rowIndex ? { ...row, ...patch } : row)) : rows,
            ),
        );

    const removeRow = (blockIndex: number, rowIndex: number) =>
        update(
            draft
                .map((rows, b) => (b === blockIndex ? rows.filter((_, r) => r !== rowIndex) : rows))
                .filter((rows) => rows.length > 0),
        );

    const valueControl = (row: DraftRow, blockIndex: number, rowIndex: number) => {
        if (VALUELESS_OPERATORS.includes(row.operator)) return null;

        const field = sources.find((source) => source.id === row.field);
        const set = (value: string) => patchRow(blockIndex, rowIndex, { value });

        if (field && TYPES_WITH_VALUES.includes(field.type) && optionList(field).length > 0) {
            return (
                <SearchSelect
                    ariaLabel="Value"
                    placeholder="Value"
                    options={optionList(field).map((option) => ({ value: option, label: option }))}
                    value={row.value}
                    onChange={set}
                />
            );
        }
        if (field?.type === 'user') {
            return (
                <SearchSelect
                    ariaLabel="Value"
                    placeholder="Person"
                    options={peopleFor(field, people).map((person) => ({ value: person.id, label: person.name }))}
                    value={row.value}
                    onChange={set}
                />
            );
        }

        const inputType =
            field?.type === 'date' || field?.type === 'time' || field?.type === 'number' ? field.type : 'text';
        return (
            <TextInput
                large
                type={inputType}
                aria-label="Value"
                placeholder="Value"
                value={row.value}
                onChange={(event) => set(event.target.value)}
            />
        );
    };

    return (
        <div className="condition-editor">
            {draft.map((rows, blockIndex) => (
                <div key={rows[0]?.key ?? blockIndex} className="condition-editor__set">
                    {blockIndex > 0 && <span className="condition-editor__or">or</span>}
                    <div className="condition-block">
                        <div className="condition-block__head">
                            <span>{rows.length > 1 ? 'All of these match' : 'This matches'}</span>
                            <button
                                type="button"
                                className="rd-btn rd-btn--icon rd-btn--icon-danger"
                                aria-label="Remove this set"
                                onClick={() => update(draft.filter((_, b) => b !== blockIndex))}
                            >
                                <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
                            </button>
                        </div>

                        {rows.map((row, rowIndex) => {
                            const field = sources.find((source) => source.id === row.field);
                            return (
                                <div key={row.key} className="condition-row">
                                    <div className="condition-row__field">
                                        <SearchSelect
                                            ariaLabel="Field"
                                            placeholder="Choose a field"
                                            clearable={false}
                                            options={sources.map((source) => ({
                                                value: source.id,
                                                label: source.label || 'Untitled field',
                                            }))}
                                            value={row.field}
                                            onChange={(fieldId) => {
                                                const picked = sources.find((source) => source.id === fieldId);
                                                patchRow(blockIndex, rowIndex, {
                                                    field: fieldId,
                                                    operator: operatorsFor(picked)[0],
                                                    value: '',
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="condition-row__operator">
                                        <SearchSelect
                                            ariaLabel="Test"
                                            clearable={false}
                                            searchable={false}
                                            options={operatorsFor(field).map((operator) => ({
                                                value: operator,
                                                label: operatorLabel(operator, field),
                                            }))}
                                            value={row.operator}
                                            onChange={(operator) =>
                                                patchRow(blockIndex, rowIndex, {
                                                    operator: operator as ConditionOperator,
                                                    value: '',
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="condition-row__value">
                                        {valueControl(row, blockIndex, rowIndex)}
                                    </div>
                                    <button
                                        type="button"
                                        className="rd-btn rd-btn--icon condition-row__remove"
                                        aria-label="Remove this condition"
                                        onClick={() => removeRow(blockIndex, rowIndex)}
                                    >
                                        <i className="mdi mdi-close" aria-hidden="true" />
                                    </button>
                                </div>
                            );
                        })}

                        <button
                            type="button"
                            className="rd-btn rd-btn--sm rd-btn--quiet condition-block__add"
                            onClick={() =>
                                update(
                                    draft.map((block, b) => (b === blockIndex ? [...block, newRow(sources)] : block)),
                                )
                            }
                        >
                            <i className="mdi mdi-plus" aria-hidden="true" />
                            And another condition
                        </button>
                    </div>
                </div>
            ))}

            {sources.length === 0 ? (
                <p className="condition-editor__none">Add another field first. A condition looks at its answer.</p>
            ) : (
                <button
                    type="button"
                    className="rd-btn rd-btn--sm condition-editor__add"
                    onClick={() => update([...draft, [newRow(sources)]])}
                >
                    <i className="mdi mdi-plus" aria-hidden="true" />
                    {draft.length === 0 ? 'Add a condition' : 'Or another set'}
                </button>
            )}
        </div>
    );
}
