import { useEffect, useRef, type ReactNode } from 'react';
import type { DesignSection } from '@/lib/forms/design';
import type { FieldElement, FieldPermissions, PermissionLevel } from '@/types/forms';

interface PermissionsTableProps {
    /** fill: See + Fill in; approval: See + Edit; cc: See only. */
    stepType: 'fill' | 'approval' | 'cc';
    fields: FieldElement[];
    sections: DesignSection[];
    permissions: FieldPermissions;
    onChange: (permissions: FieldPermissions) => void;
}

/** A column's "all" checkbox, showing "some" as indeterminate. */
function MasterCheckbox({
    label,
    checked,
    indeterminate,
    onChange,
}: {
    label: string;
    checked: boolean;
    indeterminate: boolean;
    onChange: (on: boolean) => void;
}) {
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate;
    }, [indeterminate]);
    return (
        <input
            ref={ref}
            type="checkbox"
            className="rd-check"
            aria-label={label}
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
        />
    );
}

const HINT = {
    approval: 'Untick See to hide a field from the approvers. Tick Edit to let them change it.',
    fill: 'Tick Fill in for the fields they complete. The person who submits does not see those fields.',
    cc: 'People copied in can only read, so there is no Edit column.',
} as const;

/**
 * "What they can see": per field, whether this step's people can see it and
 * edit (or, for a fill-in step, fill) it. Saved as explicit per-field
 * overrides; the default stays for fields added later.
 */
export default function PermissionsTable({ stepType, fields, sections, permissions, onChange }: PermissionsTableProps) {
    const overrides = permissions.overrides ?? {};
    const levelOf = (field: FieldElement): PermissionLevel =>
        overrides[field.id] ??
        (field.group_id ? overrides[field.group_id] : undefined) ??
        permissions.default ??
        'read';

    const levels = Object.fromEntries(fields.map((field) => [field.id, levelOf(field)]));
    const canEdit = stepType !== 'cc';
    const editLabel = stepType === 'fill' ? 'Fill in' : 'Edit';

    const apply = (next: Record<string, PermissionLevel>) =>
        onChange({ default: permissions.default ?? 'read', overrides: { ...next } });

    // Edit implies See; unticking See clears Edit.
    const setRead = (id: string, on: boolean) =>
        apply({ ...levels, [id]: on ? (levels[id] === 'edit' ? 'edit' : 'read') : 'hidden' });
    const setEdit = (id: string, on: boolean) => apply({ ...levels, [id]: on ? 'edit' : 'read' });
    const setAllRead = (on: boolean) =>
        apply(
            Object.fromEntries(
                fields.map((field) => [field.id, on ? (levels[field.id] === 'edit' ? 'edit' : 'read') : 'hidden']),
            ),
        );
    const setAllEdit = (on: boolean) =>
        apply(Object.fromEntries(fields.map((field) => [field.id, on ? 'edit' : 'read'])));

    const readCount = fields.filter((field) => levels[field.id] !== 'hidden').length;
    const editCount = fields.filter((field) => levels[field.id] === 'edit').length;

    const row = (field: FieldElement, grouped: boolean) => (
        <tr key={field.id}>
            <th scope="row" className={grouped ? 'perm-table__field is-grouped' : 'perm-table__field'}>
                {field.label || 'Untitled field'}
            </th>
            <td className="perm-table__check">
                <input
                    type="checkbox"
                    className="rd-check"
                    aria-label={`See ${field.label || 'untitled field'}`}
                    checked={levels[field.id] !== 'hidden'}
                    onChange={(event) => setRead(field.id, event.target.checked)}
                />
            </td>
            {canEdit && (
                <td className="perm-table__check">
                    <input
                        type="checkbox"
                        className="rd-check"
                        aria-label={`${editLabel} ${field.label || 'untitled field'}`}
                        checked={levels[field.id] === 'edit'}
                        onChange={(event) => setEdit(field.id, event.target.checked)}
                    />
                </td>
            )}
        </tr>
    );

    // In form order: loose fields on their own, a group's name above its fields.
    const rows: ReactNode[] = [];
    const done = new Set<string>();
    fields.forEach((field) => {
        if (!field.group_id) {
            rows.push(row(field, false));
            return;
        }
        if (done.has(field.group_id)) return;
        done.add(field.group_id);

        const section = sections.find((candidate) => candidate.id === field.group_id);
        rows.push(
            <tr key={field.group_id} className="perm-table__group">
                <th scope="rowgroup" colSpan={canEdit ? 3 : 2}>
                    {section?.label || 'Untitled group'}
                </th>
            </tr>,
        );
        fields.filter((member) => member.group_id === field.group_id).forEach((member) => rows.push(row(member, true)));
    });

    return (
        <div className="rd-field">
            <span className="rd-field__label">What they can see</span>
            <span className="rd-field__hint perm-table__hint">{HINT[stepType]}</span>
            {fields.length === 0 ? (
                <p className="rd-muted">The form has no fields yet.</p>
            ) : (
                <table className="perm-table">
                    <thead>
                        <tr>
                            <th scope="col">Field</th>
                            <th scope="col" className="perm-table__check">
                                <span className="perm-table__head">
                                    <MasterCheckbox
                                        label="See every field"
                                        checked={readCount === fields.length}
                                        indeterminate={readCount > 0 && readCount < fields.length}
                                        onChange={setAllRead}
                                    />
                                    See
                                </span>
                            </th>
                            {canEdit && (
                                <th scope="col" className="perm-table__check">
                                    <span className="perm-table__head">
                                        <MasterCheckbox
                                            label={`${editLabel} every field`}
                                            checked={editCount === fields.length}
                                            indeterminate={editCount > 0 && editCount < fields.length}
                                            onChange={setAllEdit}
                                        />
                                        {editLabel}
                                    </span>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>{rows}</tbody>
                </table>
            )}
        </div>
    );
}
