import { DndContext, DragOverlay } from '@dnd-kit/core';
import { collectFields } from '@/lib/forms/design';
import type { Person } from '@/types/forms';
import PhoneCanvas from './PhoneCanvas';
import SettingsPanel from './SettingsPanel';
import type { FormDesign } from './useFormDesign';
import WidgetPalette, { paletteLabel } from './WidgetPalette';

interface DesignStepProps {
    builder: FormDesign;
    formName: string;
    people: Person[];
    /** Fields and groups the last check flagged. */
    invalid: string[];
    error: string | null;
}

/** Step 2, Fields: the field list, the phone preview and the selected field's settings. */
export default function DesignStep({ builder, formName, people, invalid, error }: DesignStepProps) {
    const { design, selected, dnd } = builder;
    const fields = collectFields(design);

    const subject =
        selected?.kind === 'group'
            ? design.sections[selected.id]
                ? { kind: 'group' as const, section: design.sections[selected.id] }
                : null
            : selected && design.elements[selected.id]
              ? { kind: 'element' as const, element: design.elements[selected.id] }
              : null;

    const draggingPalette = dnd.dragging?.startsWith('new:') ? dnd.dragging.slice(4) : null;

    return (
        <>
            {error && (
                <div className="rd-notice rd-notice--critical" role="alert">
                    <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                    {error}
                </div>
            )}
            <section className="builder" aria-label="Fields">
                <DndContext
                    sensors={dnd.sensors}
                    collisionDetection={dnd.collisionDetection}
                    onDragStart={dnd.onDragStart}
                    onDragOver={dnd.onDragOver}
                    onDragEnd={dnd.onDragEnd}
                    onDragCancel={dnd.onDragCancel}
                >
                    <WidgetPalette onAdd={builder.add} />

                    <div className="builder__stage">
                        <PhoneCanvas
                            design={design}
                            formName={formName}
                            selected={selected}
                            invalid={invalid}
                            onSelect={builder.select}
                            onDuplicate={builder.duplicate}
                            onRemove={builder.remove}
                        />
                    </div>

                    <div className="builder__settings">
                        <SettingsPanel
                            key={selected ? `${selected.kind}:${selected.id}` : 'none'}
                            subject={subject}
                            sources={fields.filter((field) => field.id !== selected?.id)}
                            people={people}
                            onElementChange={(patch) => selected && builder.updateElement(selected.id, patch)}
                            onSectionChange={(patch) => selected && builder.updateSection(selected.id, patch)}
                        />
                    </div>

                    <DragOverlay dropAnimation={null}>
                        {draggingPalette && (
                            <div className="palette-item palette-item--overlay">{paletteLabel(draggingPalette)}</div>
                        )}
                    </DragOverlay>
                </DndContext>
            </section>
        </>
    );
}
