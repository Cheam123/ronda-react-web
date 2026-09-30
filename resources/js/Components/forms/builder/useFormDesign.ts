import {
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    pointerWithin,
    useSensor,
    useSensors,
    type CollisionDetection,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCallback, useState } from 'react';
import {
    containerOf,
    dissolveGroup,
    insertionPoint,
    newElement,
    placeElement,
    ROOT,
    type DesignSection,
    type DesignState,
    type LayoutItem,
} from '@/lib/forms/design';
import { uid } from '@/lib/forms/schema';
import type { FieldType, FormElement } from '@/types/forms';

export type Selection = { kind: 'element' | 'group'; id: string } | null;
export type PaletteKind = 'description' | 'group' | FieldType;

/*
 * Drag ids: canvas rows "el:<id>", sections "grp:<id>", a list's drop zone
 * "zone:root" / "zone:<section id>", palette widgets "new:<kind>".
 */
export const elKey = (id: string) => `el:${id}`;
export const grpKey = (id: string) => `grp:${id}`;
export const zoneKey = (container: string) => `zone:${container}`;
export const paletteKey = (kind: PaletteKind) => `new:${kind}`;

const parse = (key: unknown) => {
    const text = String(key ?? '');
    const at = text.indexOf(':');
    return { kind: text.slice(0, at), id: text.slice(at + 1) };
};

/** The list a drop lands in and where, from what the pointer is over. */
function dropTarget(layout: LayoutItem[], overKey: unknown): { container: string; index: number } | null {
    const over = parse(overKey);
    if (over.kind === 'zone') {
        const container = over.id;
        if (container === ROOT) return { container, index: layout.length };
        const group = layout.find((item) => item.kind === 'group' && item.id === container);
        return group && group.kind === 'group' ? { container, index: group.children.length } : null;
    }
    if (over.kind === 'grp') {
        return { container: ROOT, index: layout.findIndex((item) => item.kind === 'group' && item.id === over.id) };
    }
    if (over.kind === 'el') {
        const container = containerOf(layout, over.id);
        if (!container) return null;
        if (container === ROOT) {
            return { container, index: layout.findIndex((item) => item.kind === 'element' && item.id === over.id) };
        }
        const group = layout.find((item) => item.kind === 'group' && item.id === container) as Extract<
            LayoutItem,
            { kind: 'group' }
        >;
        return { container, index: group.children.indexOf(over.id) };
    }
    return null;
}

/** State and actions for the Form Design step. */
export function useFormDesign(initial: DesignState) {
    const [design, setDesign] = useState(initial);
    const [selected, setSelected] = useState<Selection>(null);
    const [dragging, setDragging] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    /** Add a widget from the palette at a spot (defaults to next to the selection). */
    const add = useCallback(
        (kind: PaletteKind, at?: { container: string; index: number }) => {
            if (kind === 'group') {
                const section: DesignSection = { id: uid('grp'), label: '', visible_when: null };
                setDesign((current) => {
                    const index = at && at.container === ROOT ? at.index : current.layout.length;
                    const layout = [...current.layout];
                    layout.splice(index, 0, { kind: 'group', id: section.id, children: [] });
                    return { ...current, sections: { ...current.sections, [section.id]: section }, layout };
                });
                setSelected({ kind: 'group', id: section.id });
                return;
            }

            const element = newElement(kind);
            setDesign((current) => {
                const target = at ?? insertionPoint(current.layout, selected);
                return {
                    ...current,
                    elements: { ...current.elements, [element.id]: element },
                    layout: placeElement(current.layout, element.id, target.container, target.index),
                };
            });
            setSelected({ kind: 'element', id: element.id });
        },
        [selected],
    );

    const updateElement = useCallback((id: string, patch: Partial<FormElement>) => {
        setDesign((current) => ({
            ...current,
            elements: { ...current.elements, [id]: { ...current.elements[id], ...patch } as FormElement },
        }));
    }, []);

    const updateSection = useCallback((id: string, patch: Partial<DesignSection>) => {
        setDesign((current) => ({
            ...current,
            sections: { ...current.sections, [id]: { ...current.sections[id], ...patch } },
        }));
    }, []);

    const duplicate = useCallback((id: string) => {
        const copyId = uid('el');
        setDesign((current) => {
            const copy = { ...structuredClone(current.elements[id]), id: copyId };
            const container = containerOf(current.layout, id) ?? ROOT;
            const target = insertionPoint(current.layout, { kind: 'element', id });
            return {
                ...current,
                elements: { ...current.elements, [copyId]: copy },
                layout: placeElement(current.layout, copyId, container, target.index),
            };
        });
        setSelected({ kind: 'element', id: copyId });
    }, []);

    const remove = useCallback((target: NonNullable<Selection>) => {
        setDesign((current) => {
            if (target.kind === 'group') {
                const sections = { ...current.sections };
                delete sections[target.id];
                // Fields inside move back to the top level.
                return { ...current, sections, layout: dissolveGroup(current.layout, target.id) };
            }
            const elements = { ...current.elements };
            delete elements[target.id];
            return {
                ...current,
                elements,
                layout: current.layout
                    .filter((item) => !(item.kind === 'element' && item.id === target.id))
                    .map((item) =>
                        item.kind === 'group'
                            ? { ...item, children: item.children.filter((id) => id !== target.id) }
                            : item,
                    ),
            };
        });
        setSelected(null);
    }, []);

    /* ----- drag and drop ----- */

    /**
     * Sections move only among top-level items. Fields prefer the row under
     * the pointer, then the innermost list, and never a section's own card
     * (which would pull a field out of the section it is in).
     */
    const collisionDetection: CollisionDetection = useCallback(
        (args) => {
            const activeKey = String(args.active.id);
            const movingSection = activeKey.startsWith('grp:') || activeKey === paletteKey('group');

            if (movingSection) {
                const topLevel = new Set<string>([
                    zoneKey(ROOT),
                    ...design.layout.map((item) => (item.kind === 'group' ? grpKey(item.id) : elKey(item.id))),
                ]);
                return closestCenter({
                    ...args,
                    droppableContainers: args.droppableContainers.filter((container) =>
                        topLevel.has(String(container.id)),
                    ),
                });
            }

            const candidates = args.droppableContainers.filter((container) => !String(container.id).startsWith('grp:'));
            const within = pointerWithin({ ...args, droppableContainers: candidates });
            const row = within.find((collision) => String(collision.id).startsWith('el:'));
            if (row) return [row];
            const sectionZone = within.find(
                (collision) => String(collision.id).startsWith('zone:') && collision.id !== zoneKey(ROOT),
            );
            if (sectionZone) return [sectionZone];
            if (within.length) return within;
            return closestCenter({ ...args, droppableContainers: candidates });
        },
        [design.layout],
    );

    const onDragStart = useCallback((event: DragStartEvent) => setDragging(String(event.active.id)), []);

    // Fields hop between the page and sections while dragging.
    const onDragOver = useCallback((event: DragOverEvent) => {
        const active = parse(event.active.id);
        if (active.kind !== 'el' || !event.over) return;

        setDesign((current) => {
            const from = containerOf(current.layout, active.id);
            const target = dropTarget(current.layout, event.over?.id);
            if (!from || !target || target.container === from) return current;
            return { ...current, layout: placeElement(current.layout, active.id, target.container, target.index) };
        });
    }, []);

    const onDragEnd = useCallback(
        (event: DragEndEvent) => {
            setDragging(null);
            const active = parse(event.active.id);
            const over = event.over;
            if (!over) return;

            if (active.kind === 'new') {
                const target = dropTarget(design.layout, over.id);
                // Sections stay top-level: a section dropped into one lands after it.
                if (active.id === 'group' && target && target.container !== ROOT) {
                    const index = design.layout.findIndex(
                        (item) => item.kind === 'group' && item.id === target.container,
                    );
                    add('group', { container: ROOT, index: index + 1 });
                    return;
                }
                if (target) add(active.id as PaletteKind, target);
                return;
            }

            setDesign((current) => {
                if (active.kind === 'grp') {
                    const from = current.layout.findIndex((item) => item.kind === 'group' && item.id === active.id);
                    const target = dropTarget(current.layout, over.id);
                    if (from === -1 || !target || target.container !== ROOT || target.index === from) return current;
                    return { ...current, layout: arrayMove(current.layout, from, target.index) };
                }

                if (active.kind === 'el') {
                    const target = dropTarget(current.layout, over.id);
                    if (!target || parse(over.id).kind !== 'el') return current;
                    return {
                        ...current,
                        layout: placeElement(current.layout, active.id, target.container, target.index),
                    };
                }

                return current;
            });
        },
        [design.layout, add],
    );

    return {
        design,
        selected,
        select: setSelected,
        add,
        updateElement,
        updateSection,
        duplicate,
        remove,
        dnd: {
            sensors,
            collisionDetection,
            dragging,
            onDragStart,
            onDragOver,
            onDragEnd,
            onDragCancel: () => setDragging(null),
        },
    };
}

export type FormDesign = ReturnType<typeof useFormDesign>;
