import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import type { MouseEvent, ReactNode } from 'react';
import { conditionCount } from '@/lib/forms/conditions';
import { ROOT, type DesignState } from '@/lib/forms/design';
import { typeLabel } from '@/lib/forms/schema';
import type { FieldType } from '@/types/forms';
import { elKey, grpKey, zoneKey, type Selection } from './useFormDesign';

/** What an empty input shows in the phone preview. */
const PLACEHOLDERS: Partial<Record<FieldType, string>> = {
    select: 'Select ›',
    'multi-choice': 'Select ›',
    'multi-select': 'Select ›',
    checkbox: 'Select ›',
    date: 'Select ›',
    time: 'Select ›',
    file: 'Upload ›',
    user: 'Select a person ›',
    gps: 'Stamp location ›',
};

interface PhoneCanvasProps {
    design: DesignState;
    formName: string;
    selected: Selection;
    invalid: string[];
    onSelect: (selection: Selection) => void;
    onDuplicate: (id: string) => void;
    onRemove: (selection: NonNullable<Selection>) => void;
}

/** The phone-style live preview: click to select, drag to reorder or file into sections. */
export default function PhoneCanvas({
    design,
    formName,
    selected,
    invalid,
    onSelect,
    onDuplicate,
    onRemove,
}: PhoneCanvasProps) {
    const { setNodeRef } = useDroppable({ id: zoneKey(ROOT) });
    const isSelected = (kind: 'element' | 'group', id: string) => selected?.kind === kind && selected.id === id;

    const row = (id: string) => (
        <CanvasRow
            key={id}
            id={id}
            design={design}
            selected={isSelected('element', id)}
            invalid={invalid.includes(id)}
            onSelect={() => onSelect({ kind: 'element', id })}
            onDuplicate={() => onDuplicate(id)}
            onRemove={() => onRemove({ kind: 'element', id })}
        />
    );

    return (
        <div className="phone-frame shadow-sm">
            <div className="phone-header">{formName || 'New Form'}</div>
            <SortableContext
                items={design.layout.map((item) => (item.kind === 'group' ? grpKey(item.id) : elKey(item.id)))}
                strategy={verticalListSortingStrategy}
            >
                <div ref={setNodeRef} className="phone-body">
                    {design.layout.map((item) =>
                        item.kind === 'group' ? (
                            <CanvasSection
                                key={item.id}
                                id={item.id}
                                label={design.sections[item.id]?.label ?? ''}
                                hasConditions={conditionCount(design.sections[item.id]?.visible_when) > 0}
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
                </div>
            </SortableContext>
            <div className="phone-footer">
                {design.layout.length > 0 ? (
                    <>
                        <i className="mdi mdi-cursor-move me-1" />
                        Click or drag widgets from the left
                    </>
                ) : (
                    <>
                        <i className="mdi mdi-gesture-tap-button me-1" />
                        Your form is empty — click or drag widgets from the left to start
                    </>
                )}
            </div>
        </div>
    );
}

function Actions({ children }: { children: ReactNode }) {
    return <div className="pv-actions">{children}</div>;
}

const stop = (handler: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    handler();
};

interface CanvasRowProps {
    id: string;
    design: DesignState;
    selected: boolean;
    invalid: boolean;
    onSelect: () => void;
    onDuplicate: () => void;
    onRemove: () => void;
}

function CanvasRow({ id, design, selected, invalid, onSelect, onDuplicate, onRemove }: CanvasRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: elKey(id) });
    const element = design.elements[id];
    if (!element) return null;

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={clsx('pv-row', selected && 'pv-selected', invalid && 'pv-invalid', isDragging && 'is-dragging')}
            onClick={stop(onSelect)}
            {...attributes}
            {...listeners}
        >
            {selected && (
                <Actions>
                    <button type="button" title="Duplicate" onClick={stop(onDuplicate)}>
                        <i className="mdi mdi-content-copy" />
                    </button>
                    <button type="button" title="Delete" onClick={stop(onRemove)}>
                        <i className="mdi mdi-trash-can-outline" />
                    </button>
                </Actions>
            )}

            {element.kind === 'description' ? (
                <>
                    <span className="badge bg-info pv-badge mb-1">Description</span>
                    <div className="pv-desc-text">
                        {element.text || <span className="untitled">Description text…</span>}
                    </div>
                </>
            ) : (
                <div className="pv-flex">
                    <span className="pv-label">
                        {element.label || <span className="untitled">{typeLabel(element.type)}</span>}
                        {element.mandatory && <span className="req"> *</span>}
                    </span>
                    <span className="pv-placeholder">
                        {element.placeholder || PLACEHOLDERS[element.type] || 'Enter'}
                    </span>
                </div>
            )}

            {conditionCount(element.visible_when) > 0 && (
                <span className="pv-cond-flag" title="Shown only when its conditions match">
                    <i className="mdi mdi-eye-settings-outline" />
                </span>
            )}
        </div>
    );
}

interface CanvasSectionProps {
    id: string;
    label: string;
    hasConditions: boolean;
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
    hasConditions,
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
                'pv-group',
                selected && 'pv-selected',
                invalid && 'pv-invalid',
                sortable.isDragging && 'is-dragging',
            )}
            onClick={stop(onSelect)}
        >
            {selected && (
                <Actions>
                    <button type="button" title="Delete group" onClick={stop(onRemove)}>
                        <i className="mdi mdi-trash-can-outline" />
                    </button>
                </Actions>
            )}
            <div className="pv-group-header" {...sortable.attributes} {...sortable.listeners}>
                {label || <span className="untitled">Group name…</span>}
            </div>
            <SortableContext items={childIds.map(elKey)} strategy={verticalListSortingStrategy}>
                <div ref={zone.setNodeRef} className={clsx('group-drop-zone', zone.isOver && 'is-over')}>
                    {children}
                    {childIds.length === 0 && <div className="group-drop-zone__empty">Drag fields into this group</div>}
                </div>
            </SortableContext>
            {hasConditions && (
                <span className="pv-cond-flag" title="Shown only when its conditions match">
                    <i className="mdi mdi-eye-settings-outline" />
                </span>
            )}
        </div>
    );
}
