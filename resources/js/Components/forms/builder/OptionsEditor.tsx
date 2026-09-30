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
        <div>
            {shown.map((value, index) => (
                <div key={index} className="d-flex align-items-center gap-1 mb-1">
                    <i className="mdi mdi-drag-vertical text-muted" />
                    <TextInput
                        placeholder="Option"
                        aria-label={`Option ${index + 1}`}
                        value={value}
                        onChange={(event) => set(index, event.target.value)}
                    />
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        title="Remove option"
                        onClick={() => remove(index)}
                    >
                        <i className="mdi mdi-minus" />
                    </button>
                </div>
            ))}
            <div className="d-flex align-items-center gap-3 mt-1">
                <button
                    type="button"
                    className="btn btn-sm btn-link p-0"
                    onClick={() => {
                        // Expand first so the new row is visible.
                        setExpanded(true);
                        onChange([...rows, '']);
                    }}
                >
                    <i className="mdi mdi-plus" /> Add option
                </button>
                {rows.length > COLLAPSE_AFTER && (
                    <button
                        type="button"
                        className="btn btn-sm btn-link p-0 text-muted"
                        onClick={() => setExpanded((open) => !open)}
                    >
                        <i className={`mdi ${expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'}`} />{' '}
                        {expanded ? 'Show less' : `Show all (${rows.length})`}
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
        <div>
            {rows.map((category, index) => {
                const options = category.options?.length ? category.options : [''];
                return (
                    <div key={index} className="border rounded p-2 mb-2 bg-light">
                        <div className="d-flex align-items-center gap-1 mb-1">
                            <TextInput
                                placeholder="Category name"
                                aria-label={`Category ${index + 1}`}
                                value={category.group}
                                onChange={(event) => setCategory(index, { group: event.target.value })}
                            />
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                title="Remove category"
                                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                            >
                                <i className="mdi mdi-minus" />
                            </button>
                        </div>
                        {options.map((option, optionIndex) => (
                            <div key={optionIndex} className="d-flex align-items-center gap-1 mb-1">
                                <i className="mdi mdi-drag-vertical text-muted" />
                                <TextInput
                                    placeholder="Option"
                                    aria-label={`Option ${optionIndex + 1}`}
                                    value={option}
                                    onChange={(event) =>
                                        setCategory(index, {
                                            options: options.map((existing, i) =>
                                                i === optionIndex ? event.target.value : existing,
                                            ),
                                        })
                                    }
                                />
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    title="Remove option"
                                    onClick={() =>
                                        setCategory(index, { options: options.filter((_, i) => i !== optionIndex) })
                                    }
                                >
                                    <i className="mdi mdi-minus" />
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            className="btn btn-sm btn-link p-0"
                            onClick={() => setCategory(index, { options: [...options, ''] })}
                        >
                            <i className="mdi mdi-plus" /> Option
                        </button>
                    </div>
                );
            })}
            <button
                type="button"
                className="btn btn-sm btn-outline-success"
                onClick={() => onChange([...rows, { group: '', options: [''] }])}
            >
                <i className="mdi mdi-plus" /> Add category
            </button>
        </div>
    );
}
