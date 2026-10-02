import { Link } from '@inertiajs/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import Dropdown from 'react-bootstrap/Dropdown';
import { pluralize } from '@/lib/format';
import type { FormSummary } from '@/types/forms';
import { formKey } from './useFormArrangement';

interface FormListRowProps {
    form: FormSummary;
    /** Shows the manage buttons. */
    canManage: boolean;
    canArrange: boolean;
    onToggle: (form: FormSummary) => void;
    onDelete: (form: FormSummary) => void;
}

/** One form in the grouped forms list. */
export default function FormListRow({ form, canManage, canArrange, onToggle, onDelete }: FormListRowProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: formKey(form.id),
        disabled: !canArrange,
    });

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={clsx('forms-row', isDragging && 'is-dragging')}
        >
            <span className="forms-row__handle">
                {canArrange && (
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        className="forms-handle"
                        aria-label={`Drag ${form.name}`}
                        {...attributes}
                        {...listeners}
                    >
                        <i className="mdi mdi-drag" aria-hidden="true" />
                    </button>
                )}
            </span>

            <span className="forms-row__form">
                <span className="forms-row__icon" aria-hidden="true">
                    <i className="mdi mdi-file-document-outline" />
                </span>
                <span className="forms-row__text">
                    {canManage ? (
                        <Link href={route('form.edit', form.id)} className="forms-row__name">
                            {form.name}
                        </Link>
                    ) : (
                        <span className="forms-row__name">{form.name}</span>
                    )}
                    {form.description && <span className="forms-row__desc">{form.description}</span>}
                </span>
            </span>

            <span>
                {form.is_enabled ? (
                    <span className="rd-chip rd-chip--good" title="People can start it from Start a form">
                        <span className="rd-dot" />
                        Open
                    </span>
                ) : (
                    <span className="rd-chip" title="Hidden from Start a form">
                        <span className="rd-dot" />
                        Off
                    </span>
                )}
            </span>
            <span className="forms-row__meta">{pluralize(form.field_count, 'field')}</span>
            <span className="forms-row__meta">{form.created_at ?? '—'}</span>

            <span className="rd-actions">
                {canManage && (
                    <>
                        <Link
                            href={route('form.preview', form.id)}
                            className="rd-btn rd-btn--icon"
                            aria-label={`Preview ${form.name}`}
                            title="Preview"
                        >
                            <i className="mdi mdi-eye-outline" aria-hidden="true" />
                        </Link>
                        <Link
                            href={route('form.edit', form.id)}
                            className="rd-btn rd-btn--icon"
                            aria-label={`Edit ${form.name}`}
                            title="Edit"
                        >
                            <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                        </Link>
                        <Dropdown align="end">
                            <Dropdown.Toggle
                                as="button"
                                type="button"
                                bsPrefix="rd-btn rd-btn--icon"
                                aria-label={`More for ${form.name}`}
                                title="More"
                            >
                                <i className="mdi mdi-dots-horizontal" aria-hidden="true" />
                            </Dropdown.Toggle>
                            <Dropdown.Menu className="rd-menu">
                                <Dropdown.Item as="button" type="button" onClick={() => onToggle(form)}>
                                    <i
                                        className={clsx(
                                            'mdi',
                                            form.is_enabled ? 'mdi-eye-off-outline' : 'mdi-eye-outline',
                                        )}
                                        aria-hidden="true"
                                    />
                                    {form.is_enabled ? 'Turn off' : 'Turn on'}
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item
                                    as="button"
                                    type="button"
                                    className="is-danger"
                                    onClick={() => onDelete(form)}
                                >
                                    <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
                                    Delete form
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </>
                )}
            </span>
        </div>
    );
}
