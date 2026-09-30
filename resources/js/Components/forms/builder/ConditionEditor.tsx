import { useState } from 'react';
import SearchSelect from '@/Components/form/SearchSelect';
import Select from '@/Components/form/Select';
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

/** Complete rows only; empty blocks dropped; nothing left means "always". */
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
    /** Start with one empty block (the branch dialog). */
    startWithBlock?: boolean;
}

/**
 * OR'd blocks of AND'd conditions. Mount it with a `key` per subject: it
 * keeps its own draft, so half-built rows survive while the user edits.
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
                    placeholder="Select a value..."
                    options={optionList(field).map((option) => ({ value: option, label: option }))}
                    value={row.value}
                    onChange={set}
                />
            );
        }
        if (field?.type === 'user') {
            return (
                <SearchSelect
                    placeholder="Select a person..."
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
                type={inputType}
                aria-label="Value"
                value={row.value}
                onChange={(event) => set(event.target.value)}
            />
        );
    };

    return (
        <div className="condition-editor">
            {draft.map((rows, blockIndex) => (
                <div key={rows[0]?.key ?? blockIndex} className="condition-block">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-semibold small text-muted">When ALL of these match</span>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            title="Remove block"
                            onClick={() => update(draft.filter((_, b) => b !== blockIndex))}
                        >
                            <i className="mdi mdi-trash-can" />
                        </button>
                    </div>

                    {rows.map((row, rowIndex) => {
                        const field = sources.find((source) => source.id === row.field);
                        return (
                            <div key={row.key} className="condition-row">
                                <div className="condition-row__field">
                                    <SearchSelect
                                        placeholder="Select a field..."
                                        clearable={false}
                                        options={sources.map((source) => ({
                                            value: source.id,
                                            label: source.label || '(untitled)',
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
                                    <Select
                                        aria-label="Operator"
                                        options={operatorsFor(field).map((operator) => ({
                                            value: operator,
                                            label: OPERATOR_LABELS[operator],
                                        }))}
                                        value={row.operator}
                                        onChange={(event) =>
                                            patchRow(blockIndex, rowIndex, {
                                                operator: event.target.value as ConditionOperator,
                                                value: '',
                                            })
                                        }
                                    />
                                </div>
                                <div className="condition-row__value">{valueControl(row, blockIndex, rowIndex)}</div>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    title="Remove condition"
                                    onClick={() => removeRow(blockIndex, rowIndex)}
                                >
                                    <i className="mdi mdi-minus" />
                                </button>
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary mt-1"
                        onClick={() =>
                            update(draft.map((block, b) => (b === blockIndex ? [...block, newRow(sources)] : block)))
                        }
                    >
                        <i className="mdi mdi-plus" /> And condition
                    </button>
                </div>
            ))}

            <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                disabled={sources.length === 0}
                title={sources.length === 0 ? 'Add other input fields first' : undefined}
                onClick={() => update([...draft, [newRow(sources)]])}
            >
                <i className="mdi mdi-plus" /> Or condition block
            </button>
        </div>
    );
}
