import { Link } from '@inertiajs/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { truncate } from '@/lib/format';
import type { FormSummary } from '@/types/forms';
import { formKey } from './useFormArrangement';

interface FormListRowProps {
    form: FormSummary;
    /** Shows the drag handle and the manage buttons. */
    canManage: boolean;
    canArrange: boolean;
    onToggle: (form: FormSummary) => void;
    onDelete: (form: FormSummary) => void;
}

/** One form in the grouped Form List. */
export default function FormListRow({ form, canManage, canArrange, onToggle, onDelete }: FormListRowProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: formKey(form.id),
        disabled: !canArrange,
    });

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={clsx('fl-row', isDragging && 'is-dragging')}
        >
            {canArrange && (
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    className="fl-handle"
                    aria-label={`Drag ${form.name}`}
                    {...attributes}
                    {...listeners}
                >
                    <i className="mdi mdi-drag-horizontal-variant" />
                </button>
            )}

            <div className="fl-main">
                <div className="fl-name">
                    {form.name}
                    {!form.is_enabled && <span className="badge bg-light text-muted border ms-1">Disabled</span>}
                </div>
                {form.description && <div className="fl-desc">{truncate(form.description, 90)}</div>}
            </div>

            <div className="fl-meta d-none d-md-block">{form.created_at}</div>

            {canManage && (
                <div className="fl-actions">
                    <Link href={route('form.edit', form.id)} className="btn btn-sm btn-outline-primary" title="Edit">
                        <i className="mdi mdi-pencil" />
                    </Link>
                    <Link href={route('form.preview', form.id)} className="btn btn-sm btn-outline-info" title="Preview">
                        <i className="mdi mdi-eye" />
                    </Link>
                    <button
                        type="button"
                        className={clsx(
                            'btn btn-sm',
                            form.is_enabled ? 'btn-outline-success' : 'btn-outline-secondary',
                        )}
                        title={form.is_enabled ? 'Disable' : 'Enable'}
                        onClick={() => onToggle(form)}
                    >
                        <i className={clsx('mdi', form.is_enabled ? 'mdi-check-circle' : 'mdi-close-circle')} />
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        title="Delete"
                        onClick={() => onDelete(form)}
                    >
                        <i className="mdi mdi-trash-can" />
                    </button>
                </div>
            )}
        </div>
    );
}
