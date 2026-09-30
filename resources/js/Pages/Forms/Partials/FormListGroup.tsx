import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { pluralize } from '@/lib/format';
import { formKey, groupKey, listKey } from './useFormArrangement';

interface FormListGroupProps {
    /** Null for Ungrouped. */
    group: { id: number; name: string } | null;
    /** The list key (group id, or UNGROUPED). */
    list: string;
    formIds: number[];
    canArrange: boolean;
    /** A form is being dragged: drop zones light up, Ungrouped appears. */
    dragging: boolean;
    emptyText: string;
    /** Rename / delete buttons. */
    actions?: ReactNode;
    children: ReactNode;
}

/** A group card of the Form List: its forms, and a drop zone for more. */
export default function FormListGroup({
    group,
    list,
    formIds,
    canArrange,
    dragging,
    emptyText,
    actions,
    children,
}: FormListGroupProps) {
    const sortable = useSortable({ id: group ? groupKey(group.id) : groupKey(0), disabled: !group || !canArrange });
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: listKey(list) });

    // Ungrouped is noise when empty, but it is also the only place to drop a
    // form out of every group, so it reappears mid-drag.
    if (!group && formIds.length === 0 && !dragging) return null;

    const count = formIds.length === 0 ? 'empty' : pluralize(formIds.length, 'form');

    return (
        <div
            ref={group ? sortable.setNodeRef : undefined}
            style={
                group
                    ? { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }
                    : undefined
            }
            className={clsx('fl-group', !group && 'fl-group--ungrouped', sortable.isDragging && 'is-dragging')}
        >
            <div className="fl-group-head">
                {group && canArrange && (
                    <button
                        type="button"
                        ref={sortable.setActivatorNodeRef}
                        className="fl-handle"
                        aria-label={`Drag group ${group.name}`}
                        {...sortable.attributes}
                        {...sortable.listeners}
                    >
                        <i className="mdi mdi-drag-horizontal-variant" />
                    </button>
                )}
                <span className={clsx('fl-group-name', !group && 'text-muted')}>
                    {group ? group.name : 'Ungrouped'}
                </span>
                <span className="fl-group-count">{count}</span>
                {actions && <div className="fl-group-actions">{actions}</div>}
            </div>
            <SortableContext items={formIds.map(formKey)} strategy={verticalListSortingStrategy}>
                <div ref={setDropRef} className={clsx('fl-list', dragging && 'fl-drop-hint', isOver && 'is-over')}>
                    {children}
                    {formIds.length === 0 && <div className="fl-empty-group">{emptyText}</div>}
                </div>
            </SortableContext>
        </div>
    );
}
