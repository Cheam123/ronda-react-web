import type {
    ConditionOperator,
    FieldElement,
    FieldType,
    FileAnswer,
    FormElement,
    FormSchema,
    Person,
    RenderItem,
} from '@/types/forms';

/** Every widget the builder offers, in palette order. */
export const FIELD_TYPES: { type: FieldType; label: string; short: string; icon: string; section: string }[] = [
    { type: 'text', label: 'Single-line Text', short: 'Single line', icon: 'mdi-form-textbox', section: 'Text' },
    { type: 'textarea', label: 'Multi-line Text', short: 'Multi line', icon: 'mdi-text-long', section: 'Text' },
    { type: 'email', label: 'Email', short: 'Email', icon: 'mdi-email-outline', section: 'Text' },
    { type: 'tel', label: 'Telephone', short: 'Telephone', icon: 'mdi-phone-outline', section: 'Text' },
    { type: 'number', label: 'Number', short: 'Number', icon: 'mdi-numeric', section: 'Numerical' },
    {
        type: 'select',
        label: 'Single Select',
        short: 'Single select',
        icon: 'mdi-arrow-down-drop-circle-outline',
        section: 'Selection',
    },
    {
        type: 'multi-choice',
        label: 'Multiple Select',
        short: 'Multiple select',
        icon: 'mdi-format-list-checks',
        section: 'Selection',
    },
    {
        type: 'multi-select',
        label: 'Categorized Multi-select',
        short: 'Categorized',
        icon: 'mdi-file-tree',
        section: 'Selection',
    },
    {
        type: 'checkbox',
        label: 'Checkbox',
        short: 'Checkbox',
        icon: 'mdi-checkbox-marked-outline',
        section: 'Selection',
    },
    { type: 'date', label: 'Date', short: 'Date', icon: 'mdi-calendar-outline', section: 'Date & Time' },
    { type: 'time', label: 'Time', short: 'Time', icon: 'mdi-clock-outline', section: 'Date & Time' },
    { type: 'file', label: 'Attachment', short: 'Attachment', icon: 'mdi-paperclip', section: 'Other' },
    // A Handler step can be assigned to whoever is chosen here.
    { type: 'user', label: 'Person', short: 'Person', icon: 'mdi-account-outline', section: 'Other' },
    // Device location, captured on open or on tap; never typed.
    { type: 'gps', label: 'Location Stamp', short: 'Location Stamp', icon: 'mdi-crosshairs-gps', section: 'Other' },
];

export function typeLabel(type: string | undefined): string {
    return FIELD_TYPES.find((meta) => meta.type === type)?.label ?? type ?? 'Field';
}

/** Types whose answers come from an option list. */
export const TYPES_WITH_VALUES: FieldType[] = ['select', 'multi-choice', 'multi-select', 'checkbox'];

/** Operators each source type supports (FormSchemaService::CONDITION_OPERATORS). */
export const CONDITION_OPERATORS: Record<FieldType, ConditionOperator[]> = {
    text: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
    textarea: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
    email: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
    tel: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
    select: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
    'multi-choice': ['includes', 'not_includes', 'is_empty', 'is_not_empty'],
    'multi-select': ['includes', 'not_includes', 'is_empty', 'is_not_empty'],
    checkbox: ['includes', 'not_includes', 'is_empty', 'is_not_empty'],
    number: ['equals', 'not_equals', 'gt', 'lt', 'is_empty', 'is_not_empty'],
    date: ['equals', 'not_equals', 'gt', 'lt', 'is_empty', 'is_not_empty'],
    time: ['equals', 'not_equals', 'gt', 'lt', 'is_empty', 'is_not_empty'],
    file: ['is_empty', 'is_not_empty'],
    user: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
    gps: ['is_empty', 'is_not_empty'],
};

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
    equals: 'is',
    not_equals: 'is not',
    includes: 'includes',
    not_includes: 'does not include',
    gt: 'is after / greater than',
    lt: 'is before / less than',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
};

export const VALUELESS_OPERATORS: ConditionOperator[] = ['is_empty', 'is_not_empty'];

let counter = 0;

/** A new, unique element / section / step id: el_lx3k9a1 */
export function uid(prefix: string): string {
    counter += 1;
    return `${prefix}_${Date.now().toString(36)}${counter}`;
}

export function isField(element: FormElement | undefined | null): element is FieldElement {
    return !!element && (element.kind ?? 'field') === 'field';
}

/**
 * Sections and top-level elements interleaved by order, each section with its
 * members sorted (FormSchemaService::renderTree).
 */
export function renderTree(schema: Pick<FormSchema, 'groups' | 'elements'>): RenderItem[] {
    const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0);
    const elements = schema.elements ?? [];

    const items: (RenderItem & { order: number })[] = [
        ...(schema.groups ?? []).map((group) => ({
            kind: 'group' as const,
            order: group.order ?? 0,
            group,
            elements: elements.filter((element) => element.group_id === group.id).sort(byOrder),
        })),
        ...elements
            .filter((element) => !element.group_id)
            .map((element) => ({ kind: 'element' as const, order: element.order ?? 0, element })),
    ];

    return items.sort(byOrder);
}

/** Every option a choice field offers, categories flattened. */
export function optionList(element: FieldElement): string[] {
    return (element.values ?? []).flatMap((value) =>
        typeof value === 'object' && value !== null ? (value.options ?? []).filter(Boolean) : value ? [value] : [],
    );
}

/**
 * The people a Person field offers (FormSchemaService::userOptionsFor): the
 * selected ones, or everyone when not narrowed (or narrowed to nobody).
 */
export function peopleFor(element: FieldElement, people: Person[]): Person[] {
    const ids = (element.user_ids ?? []).map(Number).filter(Boolean);
    if (element.user_source !== 'selected' || ids.length === 0) return people;
    return people.filter((person) => ids.includes(person.id));
}

export interface FileItem {
    url: string;
    name: string;
    /** A web link (http/https or root-relative), so it can be opened. */
    linkable: boolean;
    image: boolean;
}

/** A stored file answer as displayable items, whatever shape it was saved in. */
export function fileItems(value: unknown): FileItem[] {
    const files = (Array.isArray(value) ? value : [value]) as FileAnswer[];

    return files
        .filter((file) => file !== null && file !== undefined && file !== '')
        .map((file) => {
            const url = typeof file === 'object' ? (file.file_path ?? file.url ?? file.name ?? '') : String(file);
            const path = url.split('?')[0];
            const base = path.split('/').pop() ?? '';
            const name = typeof file === 'object' ? (file.file_name ?? file.name ?? base) : base;
            const linkable = /^(https?:\/\/|\/)/.test(url);

            return {
                url,
                name: name || 'File',
                linkable,
                image: linkable && /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(path),
            };
        });
}
