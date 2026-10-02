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

/** A group of the forms list: its name, its forms, and a drop zone for more. */
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

    return (
        <section
            ref={group ? sortable.setNodeRef : undefined}
            style={
                group
                    ? { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }
                    : undefined
            }
            className={clsx('forms-group', !group && 'forms-group--ungrouped', sortable.isDragging && 'is-dragging')}
            aria-label={group ? group.name : 'Ungrouped'}
        >
            <div className="forms-group__head">
                {group && canArrange && (
                    <button
                        type="button"
                        ref={sortable.setActivatorNodeRef}
                        className="forms-handle"
                        aria-label={`Drag the group ${group.name}`}
                        {...sortable.attributes}
                        {...sortable.listeners}
                    >
                        <i className="mdi mdi-drag" aria-hidden="true" />
                    </button>
                )}
                <h2 className="forms-group__name">{group ? group.name : 'Ungrouped'}</h2>
                <span className="rd-count">{formIds.length === 0 ? 'Empty' : pluralize(formIds.length, 'form')}</span>
                {actions && <div className="forms-group__actions">{actions}</div>}
            </div>
            <SortableContext items={formIds.map(formKey)} strategy={verticalListSortingStrategy}>
                <div ref={setDropRef} className={clsx('forms-group__list', dragging && 'is-drop', isOver && 'is-over')}>
                    {children}
                    {formIds.length === 0 && <p className="forms-group__empty">{emptyText}</p>}
                </div>
            </SortableContext>
        </section>
    );
}
