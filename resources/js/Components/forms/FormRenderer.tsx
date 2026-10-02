import clsx from 'clsx';
import type { ReactNode } from 'react';
import { isField } from '@/lib/forms/schema';
import type { AnswerValue, Answers, FormElement, FormSection, Person, RenderItem } from '@/types/forms';
import FormFieldInput from './FormFieldInput';

/** What the last round put in a field (FormApprovalService::latestPreviousAnswers). */
export interface PreviousAnswer {
    text: string;
    round: number;
    actor: string;
}

/** Long answers take the whole row of the two-column grid. */
const WIDE = ['textarea', 'file', 'multi-select', 'multi-choice', 'checkbox', 'gps'];

interface FormRendererProps {
    items: RenderItem[];
    answers: Answers;
    /** element id -> visible; missing means visible. */
    visibility?: Record<string, boolean>;
    errors?: Record<string, string>;
    files?: Record<string, File[]>;
    onChange?: (id: string, value: AnswerValue) => void;
    onFiles?: (id: string, files: File[]) => void;
    disabled?: boolean;
    people: Person[];
    /** Last round's answers, shown under the matching inputs. */
    previous?: Record<string, PreviousAnswer>;
    onImageClick?: (src: string) => void;
    /**
     * sections: each group is a form section, its name beside the fields (a
     * whole form inside .rd-form). stacked: group names above their fields (a
     * fill-in step's part, inside a panel).
     */
    layout?: 'sections' | 'stacked';
}

type Block = { group: FormSection | null; elements: FormElement[]; key: string };

/** A form's groups, description blocks and fields, in form order. */
export default function FormRenderer({
    items,
    answers,
    visibility = {},
    errors = {},
    files = {},
    onChange,
    onFiles,
    disabled = false,
    people,
    previous = {},
    onImageClick,
    layout = 'sections',
}: FormRendererProps) {
    const shown = (element: FormElement) => visibility[element.id] !== false;

    // Loose fields between groups are gathered into an untitled block of their own.
    const blocks: Block[] = [];
    items.forEach((item) => {
        if (item.kind === 'group') {
            blocks.push({ group: item.group, elements: item.elements, key: item.group.id });
            return;
        }
        const last = blocks[blocks.length - 1];
        if (last && last.group === null) last.elements.push(item.element);
        else blocks.push({ group: null, elements: [item.element], key: `loose-${item.element.id}` });
    });

    const renderElement = (element: FormElement): ReactNode => {
        if (!shown(element)) return null;

        if (!isField(element)) {
            return (
                <p key={element.id} className="form-render__note">
                    {element.text}
                </p>
            );
        }

        const hint = previous[element.id];

        return (
            <div key={element.id} className={clsx('form-render__field', WIDE.includes(element.type) && 'is-wide')}>
                <FormFieldInput
                    element={element}
                    value={answers[element.id] ?? null}
                    onChange={(value) => onChange?.(element.id, value)}
                    files={files[element.id]}
                    onFiles={(picked) => onFiles?.(element.id, picked)}
                    error={errors[element.id]}
                    disabled={disabled}
                    people={people}
                    onImageClick={onImageClick}
                />
                {hint && (
                    <div className="previous-answer">
                        <span className="previous-answer__head">
                            <i className="mdi mdi-history" aria-hidden="true" />
                            Round {hint.round}
                            {hint.actor && ` · ${hint.actor}`}
                        </span>
                        <span className="previous-answer__value">{hint.text}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            {blocks.map((block) => {
                // A group with nothing left to show disappears with its members.
                const anyVisible = block.elements.length === 0 || block.elements.some(shown);
                if (!anyVisible) return null;

                const fields = <div className="form-render__grid">{block.elements.map(renderElement)}</div>;

                return layout === 'sections' ? (
                    <section key={block.key} className="rd-form__section">
                        <div className="rd-form__intro">{block.group && <h2>{block.group.label}</h2>}</div>
                        <div className="rd-form__fields">{fields}</div>
                    </section>
                ) : (
                    <section key={block.key} className="form-render__stack">
                        {block.group && <h3 className="form-render__title">{block.group.label}</h3>}
                        {fields}
                    </section>
                );
            })}
        </>
    );
}
