import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import type { MouseEvent, ReactNode } from 'react';
import { collectFields, ROOT, type DesignState } from '@/lib/forms/design';
import { describeCondition } from '@/lib/forms/process';
import { typeLabel } from '@/lib/forms/schema';
import type { ConditionSchema, FieldElement, FieldType } from '@/types/forms';
import { elKey, grpKey, zoneKey, type Selection } from './useFormDesign';

/** What an empty input shows in the phone preview. */
const PLACEHOLDERS: Partial<Record<FieldType, string>> = {
    select: 'Choose one',
    'multi-choice': 'Choose any',
    'multi-select': 'Choose any',
    checkbox: 'Tick any',
    date: 'Pick a date',
    time: 'Pick a time',
    file: 'Attach a file',
    user: 'Choose a person',
    gps: 'Stamp the location',
};

/** Types drawn with a chevron, like a dropdown. */
const PICKERS: FieldType[] = ['select', 'multi-choice', 'multi-select', 'checkbox', 'date', 'time', 'user'];

interface PhoneCanvasProps {
    design: DesignState;
    formName: string;
    selected: Selection;
    invalid: string[];
    onSelect: (selection: Selection) => void;
    onDuplicate: (id: string) => void;
    onRemove: (selection: NonNullable<Selection>) => void;
}

/** The form as it shows on a phone: click to select, drag to reorder or move into a group. */
export default function PhoneCanvas({
    design,
    formName,
    selected,
    invalid,
    onSelect,
    onDuplicate,
    onRemove,
}: PhoneCanvasProps) {
    const root = useDroppable({ id: zoneKey(ROOT) });
    const fields = collectFields(design);
    const isSelected = (kind: 'element' | 'group', id: string) => selected?.kind === kind && selected.id === id;

    const row = (id: string) => (
        <CanvasRow
            key={id}
            id={id}
            design={design}
            fields={fields}
            selected={isSelected('element', id)}
            invalid={invalid.includes(id)}
            onSelect={() => onSelect({ kind: 'element', id })}
            onDuplicate={() => onDuplicate(id)}
            onRemove={() => onRemove({ kind: 'element', id })}
        />
    );

    return (
        <div className="phone">
            <div className="phone__head">
                <span className="phone__eyebrow">Preview on a phone</span>
                <span className="phone__title">{formName.trim() || 'New form'}</span>
            </div>
            <SortableContext
                items={design.layout.map((item) => (item.kind === 'group' ? grpKey(item.id) : elKey(item.id)))}
                strategy={verticalListSortingStrategy}
            >
                <div ref={root.setNodeRef} className="phone__body">
                    {design.layout.map((item) =>
                        item.kind === 'group' ? (
                            <CanvasSection
                                key={item.id}
                                id={item.id}
                                label={design.sections[item.id]?.label ?? ''}
                                shownWhen={design.sections[item.id]?.visible_when}
                                fields={fields}
                                childIds={item.children}
                                selected={isSelected('group', item.id)}
                                invalid={invalid.includes(item.id)}
                                onSelect={() => onSelect({ kind: 'group', id: item.id })}
                                onRemove={() => onRemove({ kind: 'group', id: item.id })}
                            >
                                {item.children.map(row)}
                            </CanvasSection>
                        ) : (
                            row(item.id)
                        ),
                    )}
                    <div className={clsx('phone__drop', root.isOver && 'is-over')}>
                        {design.layout.length > 0
                            ? 'Drop a field here'
                            : 'Nothing here yet. Click a field on the left, or drag it here.'}
                    </div>
                </div>
            </SortableContext>
        </div>
    );
}

function Actions({ children }: { children: ReactNode }) {
    return <span className="phone-tools">{children}</span>;
}

/** "Shown when Price is less than 70", for a field or group with conditions. */
function ShownWhen({ when, fields }: { when: ConditionSchema | null | undefined; fields: FieldElement[] }) {
    const text = describeCondition(when, fields);
    if (!text) return null;

    return (
        <span className="phone-when">
            <i className="mdi mdi-source-branch" aria-hidden="true" />
            Shown {text.charAt(0).toLowerCase() + text.slice(1)}
        </span>
    );
}

const stop = (handler: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    handler();
};

interface CanvasRowProps {
    id: string;
    design: DesignState;
    fields: FieldElement[];
    selected: boolean;
    invalid: boolean;
    onSelect: () => void;
    onDuplicate: () => void;
    onRemove: () => void;
}

function CanvasRow({ id, design, fields, selected, invalid, onSelect, onDuplicate, onRemove }: CanvasRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: elKey(id) });
    const element = design.elements[id];
    if (!element) return null;

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={clsx(
                'phone-field',
                selected && 'is-selected',
                invalid && 'is-invalid',
                isDragging && 'is-dragging',
            )}
            onClick={stop(onSelect)}
            {...attributes}
            {...listeners}
        >
            {selected && (
                <Actions>
                    <button type="button" aria-label="Duplicate this field" onClick={stop(onDuplicate)}>
                        <i className="mdi mdi-content-copy" aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Remove this field" onClick={stop(onRemove)}>
                        <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
                    </button>
                </Actions>
            )}

            {element.kind === 'description' ? (
                <p className="phone-field__text">
                    {element.text || <span className="phone-field__untitled">Some text for the person filling in</span>}
                </p>
            ) : (
                <>
                    <span className="phone-field__label">
                        {element.label || <span className="phone-field__untitled">{typeLabel(element.type)}</span>}
                        {element.mandatory && (
                            <span className="phone-field__required" aria-label="required">
                                {' '}
                                *
                            </span>
                        )}
                    </span>
                    <span className={clsx('phone-field__input', element.type === 'textarea' && 'is-tall')}>
                        <span>{element.placeholder || PLACEHOLDERS[element.type] || ''}</span>
                        {PICKERS.includes(element.type) && <i className="mdi mdi-chevron-down" aria-hidden="true" />}
                    </span>
                </>
            )}

            <ShownWhen when={element.visible_when} fields={fields} />
        </div>
    );
}

interface CanvasSectionProps {
    id: string;
    label: string;
    shownWhen: ConditionSchema | null | undefined;
    fields: FieldElement[];
    childIds: string[];
    selected: boolean;
    invalid: boolean;
    onSelect: () => void;
    onRemove: () => void;
    children: ReactNode;
}

function CanvasSection({
    id,
    label,
    shownWhen,
    fields,
    childIds,
    selected,
    invalid,
    onSelect,
    onRemove,
    children,
}: CanvasSectionProps) {
    const sortable = useSortable({ id: grpKey(id) });
    const zone = useDroppable({ id: zoneKey(id) });

    return (
        <div
            ref={sortable.setNodeRef}
            style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
            className={clsx(
                'phone-group',
                selected && 'is-selected',
                invalid && 'is-invalid',
                describeCondition(shownWhen, fields) && 'is-conditional',
                sortable.isDragging && 'is-dragging',
            )}
            onClick={stop(onSelect)}
        >
            {selected && (
                <Actions>
                    <button type="button" aria-label="Remove this group" onClick={stop(onRemove)}>
                        <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
                    </button>
                </Actions>
            )}
            <div className="phone-group__head" {...sortable.attributes} {...sortable.listeners}>
                <span className="phone-group__name">
                    {label || <span className="phone-field__untitled">Untitled group</span>}
                </span>
                <ShownWhen when={shownWhen} fields={fields} />
            </div>
            <SortableContext items={childIds.map(elKey)} strategy={verticalListSortingStrategy}>
                <div ref={zone.setNodeRef} className={clsx('phone-group__body', zone.isOver && 'is-over')}>
                    {children}
                    {childIds.length === 0 && <div className="phone-group__empty">Drag fields into this group</div>}
                </div>
            </SortableContext>
        </div>
    );
}
