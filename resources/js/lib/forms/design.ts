import type {
    ConditionSchema,
    DescriptionElement,
    FieldElement,
    FieldType,
    FormElement,
    FormSchema,
    OptionCategory,
} from '@/types/forms';
import { optionList, TYPES_WITH_VALUES, uid } from './schema';

/**
 * The builder's "Form Design" state. Element and section settings live in
 * maps; the layout says what sits where. Section membership comes from the
 * layout alone, so dragging a field into a section needs no second update.
 */

export interface DesignSection {
    id: string;
    label: string;
    visible_when: ConditionSchema | null;
}

export type LayoutItem = { kind: 'element'; id: string } | { kind: 'group'; id: string; children: string[] };

export interface DesignState {
    elements: Record<string, FormElement>;
    sections: Record<string, DesignSection>;
    layout: LayoutItem[];
}

/** The top-level list, for layout operations. */
export const ROOT = 'root';

/** Load a saved schema into builder state. */
export function designFromSchema(schema: FormSchema): DesignState {
    const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0);
    const elements: Record<string, FormElement> = {};
    const sections: Record<string, DesignSection> = {};

    (schema.elements ?? []).forEach((element) => {
        elements[element.id] = normalizeElement(element);
    });

    const items: { order: number; item: LayoutItem }[] = [];
    (schema.groups ?? []).forEach((group) => {
        sections[group.id] = { id: group.id, label: group.label ?? '', visible_when: group.visible_when ?? null };
        items.push({
            order: group.order ?? 0,
            item: {
                kind: 'group',
                id: group.id,
                children: (schema.elements ?? [])
                    .filter((element) => element.group_id === group.id)
                    .sort(byOrder)
                    .map((element) => element.id),
            },
        });
    });
    (schema.elements ?? [])
        .filter((element) => !element.group_id)
        .forEach((element) => items.push({ order: element.order ?? 0, item: { kind: 'element', id: element.id } }));

    return { elements, sections, layout: items.sort(byOrder).map(({ item }) => item) };
}

function normalizeElement(element: FormElement): FormElement {
    if (element.kind === 'description') {
        return { ...element, text: element.text ?? '', visible_when: element.visible_when ?? null };
    }
    return {
        ...element,
        kind: 'field',
        label: element.label ?? '',
        placeholder: element.placeholder ?? '',
        mandatory: !!element.mandatory,
        values: element.values ?? [],
        min: element.min ?? null,
        max: element.max ?? null,
        min_days: element.min_days ?? null,
        visible_when: element.visible_when ?? null,
        user_source: element.user_source ?? 'all',
        user_ids: element.user_ids ?? [],
        capture_mode: element.capture_mode ?? 'auto',
    };
}

/** A new widget from the palette. */
export function newElement(kind: 'description' | FieldType): FormElement {
    if (kind === 'description') {
        return {
            id: uid('el'),
            kind: 'description',
            text: '',
            group_id: null,
            visible_when: null,
        } as DescriptionElement;
    }

    const values: FieldElement['values'] = TYPES_WITH_VALUES.includes(kind)
        ? kind === 'multi-select'
            ? [{ group: '', options: [''] }]
            : ['']
        : [];

    return {
        id: uid('el'),
        kind: 'field',
        type: kind,
        label: '',
        placeholder: '',
        mandatory: false,
        values,
        min: null,
        max: null,
        min_days: null,
        group_id: null,
        visible_when: null,
        user_source: 'all',
        user_ids: [],
        capture_mode: 'auto',
    };
}

/* ----- layout operations ----- */

/** The list holding an element: ROOT or its section's id. */
export function containerOf(layout: LayoutItem[], elementId: string): string | null {
    for (const item of layout) {
        if (item.kind === 'element' && item.id === elementId) return ROOT;
        if (item.kind === 'group' && item.children.includes(elementId)) return item.id;
    }
    return null;
}

function without(layout: LayoutItem[], elementId: string): LayoutItem[] {
    return layout
        .filter((item) => !(item.kind === 'element' && item.id === elementId))
        .map((item) =>
            item.kind === 'group' ? { ...item, children: item.children.filter((id) => id !== elementId) } : item,
        );
}

/** Put an element into a list at an index (appended when the index is past the end). */
export function placeElement(layout: LayoutItem[], elementId: string, container: string, index: number): LayoutItem[] {
    const next = without(layout, elementId);

    if (container === ROOT) {
        const at = Math.max(0, Math.min(index, next.length));
        return [...next.slice(0, at), { kind: 'element', id: elementId }, ...next.slice(at)];
    }

    return next.map((item) => {
        if (item.kind !== 'group' || item.id !== container) return item;
        const at = Math.max(0, Math.min(index, item.children.length));
        return { ...item, children: [...item.children.slice(0, at), elementId, ...item.children.slice(at)] };
    });
}

/** Where a new widget goes: after the selected field, into the selected section, or at the end. */
export function insertionPoint(layout: LayoutItem[], selected: { kind: 'element' | 'group'; id: string } | null) {
    if (selected?.kind === 'element') {
        const container = containerOf(layout, selected.id);
        if (container === ROOT) {
            return {
                container,
                index: layout.findIndex((item) => item.kind === 'element' && item.id === selected.id) + 1,
            };
        }
        if (container) {
            const group = layout.find((item) => item.kind === 'group' && item.id === container) as Extract<
                LayoutItem,
                { kind: 'group' }
            >;
            return { container, index: group.children.indexOf(selected.id) + 1 };
        }
    }
    if (selected?.kind === 'group') {
        const group = layout.find((item) => item.kind === 'group' && item.id === selected.id);
        if (group && group.kind === 'group') return { container: group.id, index: group.children.length };
    }
    return { container: ROOT, index: layout.length };
}

/** Remove a section; its fields move up to where it was. */
export function dissolveGroup(layout: LayoutItem[], groupId: string): LayoutItem[] {
    return layout.flatMap((item) =>
        item.kind === 'group' && item.id === groupId
            ? item.children.map((id) => ({ kind: 'element' as const, id }))
            : [item],
    );
}

/* ----- reads ----- */

/** Every element in form order, with its section from the layout. */
export function collectElements(design: DesignState): FormElement[] {
    return design.layout.flatMap((item) =>
        item.kind === 'group'
            ? item.children.map((id) => ({ ...design.elements[id], group_id: item.id }) as FormElement)
            : [{ ...design.elements[item.id], group_id: null } as FormElement],
    );
}

/** Input fields in form order (condition sources, permissions, person fields). */
export function collectFields(design: DesignState): FieldElement[] {
    return collectElements(design).filter((element): element is FieldElement => element.kind === 'field');
}

export function collectSections(design: DesignState): DesignSection[] {
    return design.layout.flatMap((item) => (item.kind === 'group' ? [design.sections[item.id]] : []));
}

/* ----- save ----- */

/** The v2 schema the server stores (orders in steps of 10, as before). */
export function serializeDesign(design: DesignState): FormSchema {
    const schema: FormSchema = { schema_version: 2, groups: [], elements: [] };
    const push = (element: FormElement, groupId: string | null, order: number) =>
        schema.elements.push(serializeElement(element, groupId, order));

    design.layout.forEach((item, index) => {
        const order = (index + 1) * 10;
        if (item.kind === 'group') {
            const section = design.sections[item.id];
            schema.groups.push({
                id: section.id,
                label: section.label.trim(),
                order,
                visible_when: section.visible_when,
            });
            item.children.forEach((id, memberIndex) => push(design.elements[id], section.id, (memberIndex + 1) * 10));
        } else {
            push(design.elements[item.id], null, order);
        }
    });

    return schema;
}

function serializeElement(element: FormElement, groupId: string | null, order: number): FormElement {
    if (element.kind === 'description') {
        return {
            id: element.id,
            kind: 'description',
            text: (element.text ?? '').trim(),
            label: '',
            group_id: groupId,
            order,
            visible_when: element.visible_when ?? null,
        };
    }

    return {
        id: element.id,
        kind: 'field',
        type: element.type,
        label: (element.label ?? '').trim(),
        text: '',
        placeholder: (element.placeholder ?? '').trim() || null,
        mandatory: !!element.mandatory,
        values: cleanValues(element.values ?? []),
        min: element.min || null,
        max: element.max || null,
        min_days: element.min_days || null,
        group_id: groupId,
        order,
        visible_when: element.visible_when ?? null,
        // Person fields: which people the picker offers.
        user_source: element.type === 'user' ? (element.user_source ?? 'all') : null,
        user_ids:
            element.type === 'user' && element.user_source === 'selected' ? (element.user_ids ?? []).map(Number) : [],
        // Location Stamp fields: stamp on open ('auto') or on tap ('manual').
        capture_mode: element.type === 'gps' ? (element.capture_mode ?? 'auto') : null,
    };
}

/** Blank rows exist only while editing; categories need a name or an option. */
function cleanValues(values: FieldElement['values']): FieldElement['values'] {
    return values.flatMap<string | OptionCategory>((value) => {
        if (typeof value === 'object' && value !== null) {
            const options = (value.options ?? []).filter((option) => option.trim() !== '');
            const group = (value.group ?? '').trim();
            return group || options.length ? [{ group, options }] : [];
        }
        return value && value.trim() !== '' ? [value] : [];
    });
}

/* ----- validation ----- */

export interface DesignProblems {
    /** Element and section ids that need attention, in form order. */
    invalid: string[];
    message: string | null;
}

/** What stops the design being saved (FormSchemaService::validateDefinition, as the builder checked it). */
export function validateDesign(design: DesignState): DesignProblems {
    const invalid: string[] = [];
    let fieldCount = 0;

    const checkElement = (id: string) => {
        const element = design.elements[id];
        if (!element) return;
        let bad = false;

        if (element.kind === 'description') {
            bad = !(element.text ?? '').trim();
        } else {
            fieldCount++;
            if (!(element.label ?? '').trim()) bad = true;
            if (TYPES_WITH_VALUES.includes(element.type) && optionList(element).length === 0) bad = true;
            if (element.min && element.max && Number(element.max) < Number(element.min)) bad = true;
            // "Selected people only" with nobody selected leaves an unusable picker.
            if (
                element.type === 'user' &&
                element.user_source === 'selected' &&
                (element.user_ids ?? []).length === 0
            ) {
                bad = true;
            }
        }
        if (bad) invalid.push(id);
    };

    design.layout.forEach((item) => {
        if (item.kind === 'group') {
            if (!design.sections[item.id].label.trim()) invalid.push(item.id);
            item.children.forEach(checkElement);
        } else {
            checkElement(item.id);
        }
    });

    const message =
        fieldCount === 0
            ? 'Please add at least one form input.'
            : invalid.length > 0
              ? 'Highlighted widgets are missing a title or options.'
              : null;

    return { invalid, message };
}
