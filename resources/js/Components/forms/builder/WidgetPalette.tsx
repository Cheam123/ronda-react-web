import { useDraggable } from '@dnd-kit/core';
import { FIELD_TYPES } from '@/lib/forms/schema';
import { paletteKey, type PaletteKind } from './useFormDesign';

const LAYOUT_WIDGETS: { kind: PaletteKind; short: string; icon: string }[] = [
    { kind: 'group', short: 'Group', icon: 'mdi-group' },
    { kind: 'description', short: 'Description', icon: 'mdi-text' },
];

const SECTIONS = [...Array.from(new Set(FIELD_TYPES.map((meta) => meta.section))), 'Layout'];

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
            <i className={`mdi ${icon}`} aria-hidden="true" />
            {short}
        </button>
    );
}

/** "Add a field": click to add under the selection, or drag into the preview. */
export default function WidgetPalette({ onAdd }: { onAdd: (kind: PaletteKind) => void }) {
    return (
        <div className="builder-palette">
            <div className="builder-palette__head">
                <h2 className="builder-pane__title">Add a field</h2>
                <p className="builder-pane__sub">Click to add it under the selected one, or drag it into place.</p>
            </div>
            {SECTIONS.map((section) => (
                <div key={section} className="palette-section">
                    <h3 className="palette-section__title">{section}</h3>
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
