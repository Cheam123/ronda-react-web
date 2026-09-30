import {
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCallback, useEffect, useState } from 'react';

/** Ungrouped forms live in this list. */
export const UNGROUPED = 'none';

export interface Arrangement {
    /** Group ids, in display order (Ungrouped is always last and not listed). */
    groups: number[];
    /** group id (or UNGROUPED) -> form ids, in order. */
    lists: Record<string, number[]>;
}

/* Sortable ids: "form:12", "group:3", and a list's own drop zone "list:3". */
export const formKey = (id: number) => `form:${id}`;
export const groupKey = (id: number) => `group:${id}`;
export const listKey = (list: string) => `list:${list}`;

const parse = (key: string | number | null | undefined) => {
    const [kind, id] = String(key ?? '').split(':');
    return { kind, id };
};

/** Which list holds a form or list key. */
function listOf(arrangement: Arrangement, key: string | number): string | null {
    const { kind, id } = parse(key);
    if (kind === 'list') return id;
    if (kind !== 'form') return null;
    return Object.keys(arrangement.lists).find((list) => arrangement.lists[list].includes(Number(id))) ?? null;
}

/**
 * Drag-and-drop state for the form list: forms move within and between
 * groups, groups reorder among themselves. `onChange` receives the new
 * arrangement when a drag ends, to save it.
 */
export function useFormArrangement(initial: Arrangement, onChange: (arrangement: Arrangement) => void) {
    const [arrangement, setArrangement] = useState(initial);
    const [dragging, setDragging] = useState<string | null>(null);

    // A reload (a group added, renamed or removed) replaces the arrangement.
    useEffect(() => setArrangement(initial), [initial]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const onDragStart = useCallback((event: DragStartEvent) => setDragging(String(event.active.id)), []);

    // Forms hop between lists while dragging, so the drop lands where it shows.
    const onDragOver = useCallback((event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || parse(active.id).kind !== 'form') return;

        setArrangement((current) => {
            const from = listOf(current, active.id);
            const to = listOf(current, over.id);
            if (!from || !to || from === to) return current;

            const formId = Number(parse(active.id).id);
            const target = current.lists[to];
            const overIndex =
                parse(over.id).kind === 'form' ? target.indexOf(Number(parse(over.id).id)) : target.length;

            return {
                ...current,
                lists: {
                    ...current.lists,
                    [from]: current.lists[from].filter((id) => id !== formId),
                    [to]: [...target.slice(0, overIndex), formId, ...target.slice(overIndex)],
                },
            };
        });
    }, []);

    const onDragEnd = useCallback(
        (event: DragEndEvent) => {
            setDragging(null);
            const { active, over } = event;
            if (!over) return;

            const moved = parse(active.id);
            let next = arrangement;

            if (moved.kind === 'group') {
                const overGroup = parse(over.id);
                const from = arrangement.groups.indexOf(Number(moved.id));
                const to = arrangement.groups.indexOf(Number(overGroup.id));
                if (overGroup.kind === 'group' && from !== -1 && to !== -1 && from !== to) {
                    next = { ...arrangement, groups: arrayMove(arrangement.groups, from, to) };
                }
            } else if (moved.kind === 'form') {
                const list = listOf(arrangement, active.id);
                if (list && parse(over.id).kind === 'form') {
                    const ids = arrangement.lists[list];
                    const from = ids.indexOf(Number(moved.id));
                    const to = ids.indexOf(Number(parse(over.id).id));
                    if (from !== -1 && to !== -1 && from !== to) {
                        next = { ...arrangement, lists: { ...arrangement.lists, [list]: arrayMove(ids, from, to) } };
                    }
                }
            }

            setArrangement(next);
            onChange(next);
        },
        [arrangement, onChange],
    );

    return {
        arrangement,
        sensors,
        dragging,
        onDragStart,
        onDragOver,
        onDragEnd,
        onDragCancel: () => setDragging(null),
    };
}
