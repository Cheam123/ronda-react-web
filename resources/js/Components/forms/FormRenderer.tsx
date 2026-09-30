import clsx from 'clsx';
import { isField } from '@/lib/forms/schema';
import type { AnswerValue, Answers, FormElement, Person, RenderItem } from '@/types/forms';
import FormFieldInput from './FormFieldInput';

/** What the last round put in a field (FormApprovalService::latestPreviousAnswers). */
export interface PreviousAnswer {
    text: string;
    round: number;
    actor: string;
}

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
    /** Two columns, as in a Handler's section on the record page. */
    grid?: boolean;
}

/** A form's sections, description blocks and fields, in form order. */
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
    grid = false,
}: FormRendererProps) {
    const shown = (element: FormElement) => visibility[element.id] !== false;

    const renderElement = (element: FormElement) => {
        if (!shown(element)) return null;

        if (!isField(element)) {
            return (
                <div key={element.id} className="form-element form-element--wide">
                    <div className="alert alert-light border mb-0 form-description">{element.text}</div>
                </div>
            );
        }

        const hint = previous[element.id];
        const wide = ['textarea', 'file', 'multi-select', 'multi-choice', 'checkbox'].includes(element.type);

        return (
            <div key={element.id} className={clsx('form-element', wide && 'form-element--wide')}>
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
                        <div className="previous-answer__head">
                            <i className="mdi mdi-history" />
                            Round {hint.round}
                            {hint.actor && ` · ${hint.actor}`}
                        </div>
                        <div className="previous-answer__value">{hint.text}</div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={clsx('form-render', grid && 'form-render--grid')}>
            {items.map((item) => {
                if (item.kind === 'element') return renderElement(item.element);

                // A section with nothing left to show disappears with its members.
                const anyVisible = item.elements.length === 0 || item.elements.some(shown);
                if (!anyVisible) return null;

                return (
                    <section key={item.group.id} className="form-section-card">
                        <div className="form-section-card__head">{item.group.label}</div>
                        <div className="form-section-card__body">{item.elements.map(renderElement)}</div>
                    </section>
                );
            })}
        </div>
    );
}
