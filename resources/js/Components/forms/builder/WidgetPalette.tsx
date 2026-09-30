import { useDraggable } from '@dnd-kit/core';
import { FIELD_TYPES } from '@/lib/forms/schema';
import { paletteKey, type PaletteKind } from './useFormDesign';

const LAYOUT_WIDGETS: { kind: PaletteKind; short: string; icon: string }[] = [
    { kind: 'description', short: 'Description', icon: 'mdi-text' },
    { kind: 'group', short: 'Group', icon: 'mdi-group' },
];

const SECTIONS = ['Layout', ...Array.from(new Set(FIELD_TYPES.map((meta) => meta.section)))];

function PaletteItem({
    kind,
    short,
    icon,
    onAdd,
}: {
    kind: PaletteKind;
    short: string;
    icon: string;
    onAdd: (kind: PaletteKind) => void;
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: paletteKey(kind) });

    return (
        <button
            ref={setNodeRef}
            type="button"
            className="palette-item"
            style={{ opacity: isDragging ? 0.5 : undefined }}
            onClick={() => onAdd(kind)}
            {...attributes}
            {...listeners}
        >
            <i className={`mdi ${icon}`} /> {short}
        </button>
    );
}

/** The widget list: click to add next to the selection, or drag into the preview. */
export default function WidgetPalette({ onAdd }: { onAdd: (kind: PaletteKind) => void }) {
    return (
        <div className="builder-palette border-end">
            <div className="p-3 pb-2 fw-bold">Widgets</div>
            <div className="px-3 pb-3">
                {SECTIONS.map((section) => (
                    <div key={section}>
                        <div className="palette-section">{section}</div>
                        <div className="palette-list">
                            {(section === 'Layout'
                                ? LAYOUT_WIDGETS
                                : FIELD_TYPES.filter((meta) => meta.section === section).map((meta) => ({
                                      kind: meta.type as PaletteKind,
                                      short: meta.short,
                                      icon: meta.icon,
                                  }))
                            ).map((widget) => (
                                <PaletteItem key={widget.kind} {...widget} onAdd={onAdd} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** The label a palette widget drags around with. */
export function paletteLabel(kind: string): string {
    return (
        LAYOUT_WIDGETS.find((widget) => widget.kind === kind)?.short ??
        FIELD_TYPES.find((meta) => meta.type === kind)?.short ??
        kind
    );
}
