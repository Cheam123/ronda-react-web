import { useState } from 'react';
import TextInput from '@/Components/form/TextInput';
import type { FieldElement, OptionCategory } from '@/types/forms';

/** Long option lists collapse to this many rows. */
const COLLAPSE_AFTER = 5;

interface OptionsEditorProps {
    element: FieldElement;
    onChange: (values: FieldElement['values']) => void;
}

/**
 * The options of a choice field: a plain list, or categories of options for
 * a categorised multi-select. Blank rows are kept while editing so a new row
 * can be typed into; the design check ignores them.
 */
export default function OptionsEditor({ element, onChange }: OptionsEditorProps) {
    return element.type === 'multi-select' ? (
        <CategoryEditor categories={element.values as OptionCategory[]} onChange={onChange} />
    ) : (
        <ListEditor values={element.values as string[]} onChange={onChange} />
    );
}

function OptionRow({
    value,
    label,
    placeholder = 'Option',
    removeLabel,
    onChange,
    onRemove,
}: {
    value: string;
    label: string;
    placeholder?: string;
    removeLabel: string;
    onChange: (value: string) => void;
    onRemove: () => void;
}) {
    return (
        <div className="option-row">
            <TextInput
                large
                placeholder={placeholder}
                aria-label={label}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
            <button type="button" className="rd-btn rd-btn--icon" aria-label={removeLabel} onClick={onRemove}>
                <i className="mdi mdi-close" aria-hidden="true" />
            </button>
        </div>
    );
}

function ListEditor({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
    const rows = values.length ? values : [''];
    const [expanded, setExpanded] = useState(rows.length <= COLLAPSE_AFTER);
    const shown = expanded ? rows : rows.slice(0, COLLAPSE_AFTER);

    const set = (index: number, value: string) => onChange(rows.map((row, i) => (i === index ? value : row)));
    const remove = (index: number) => {
        const next = rows.filter((_, i) => i !== index);
        onChange(next.length ? next : ['']);
    };

    return (
        <div className="option-list">
            {shown.map((value, index) => (
                <OptionRow
                    key={index}
                    value={value}
                    label={`Option ${index + 1}`}
                    removeLabel={`Remove option ${index + 1}`}
                    onChange={(next) => set(index, next)}
                    onRemove={() => remove(index)}
                />
            ))}
            <div className="option-list__actions">
                <button
                    type="button"
                    className="rd-btn rd-btn--sm rd-btn--quiet"
                    onClick={() => {
                        // Expand first so the new row is visible.
                        setExpanded(true);
                        onChange([...rows, '']);
                    }}
                >
                    <i className="mdi mdi-plus" aria-hidden="true" />
                    Add an option
                </button>
                {rows.length > COLLAPSE_AFTER && (
                    <button
                        type="button"
                        className="rd-btn rd-btn--sm rd-btn--quiet"
                        onClick={() => setExpanded((open) => !open)}
                    >
                        <i className={`mdi ${expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'}`} aria-hidden="true" />
                        {expanded ? 'Show fewer' : `Show all ${rows.length}`}
                    </button>
                )}
            </div>
        </div>
    );
}

function CategoryEditor({
    categories,
    onChange,
}: {
    categories: OptionCategory[];
    onChange: (values: OptionCategory[]) => void;
}) {
    const rows = categories.length ? categories : [{ group: '', options: [''] }];

    const setCategory = (index: number, patch: Partial<OptionCategory>) =>
        onChange(rows.map((category, i) => (i === index ? { ...category, ...patch } : category)));

    return (
        <div className="option-list">
            {rows.map((category, index) => {
                const options = category.options?.length ? category.options : [''];
                return (
                    <div key={index} className="option-category">
                        <OptionRow
                            value={category.group}
                            label={`Category ${index + 1}`}
                            placeholder="Category name"
                            removeLabel={`Remove category ${index + 1}`}
                            onChange={(group) => setCategory(index, { group })}
                            onRemove={() => onChange(rows.filter((_, i) => i !== index))}
                        />
                        <div className="option-category__options">
                            {options.map((option, optionIndex) => (
                                <OptionRow
                                    key={optionIndex}
                                    value={option}
                                    label={`Option ${optionIndex + 1} in category ${index + 1}`}
                                    removeLabel={`Remove option ${optionIndex + 1}`}
                                    onChange={(next) =>
                                        setCategory(index, {
                                            options: options.map((existing, i) =>
                                                i === optionIndex ? next : existing,
                                            ),
                                        })
                                    }
                                    onRemove={() =>
                                        setCategory(index, { options: options.filter((_, i) => i !== optionIndex) })
                                    }
                                />
                            ))}
                            <button
                                type="button"
                                className="rd-btn rd-btn--sm rd-btn--quiet"
                                onClick={() => setCategory(index, { options: [...options, ''] })}
                            >
                                <i className="mdi mdi-plus" aria-hidden="true" />
                                Add an option
                            </button>
                        </div>
                    </div>
                );
            })}
            <button
                type="button"
                className="rd-btn rd-btn--sm option-list__category"
                onClick={() => onChange([...rows, { group: '', options: [''] }])}
            >
                <i className="mdi mdi-plus" aria-hidden="true" />
                Add a category
            </button>
        </div>
    );
}
