import { useEffect, useRef } from 'react';
import type { DesignSection } from '@/lib/forms/design';
import type { FieldElement, FieldPermissions, PermissionLevel } from '@/types/forms';

interface PermissionsTableProps {
    /** fill: Read + Fill; approval: Read + Edit; cc: Read only. */
    stepType: 'fill' | 'approval' | 'cc';
    fields: FieldElement[];
    sections: DesignSection[];
    permissions: FieldPermissions;
    onChange: (permissions: FieldPermissions) => void;
}

/** A master checkbox that shows "some" as indeterminate. */
function MasterCheckbox({
    checked,
    indeterminate,
    onChange,
}: {
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
            className="form-check-input me-1"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
        />
    );
}

/**
 * "Form Permissions": per field, whether this step's people may read it and
 * edit (or, for a Handler, fill) it. A section's name spans its fields' rows.
 * Saved as explicit per-field overrides; the default stays for fields added later.
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
    const editLabel = stepType === 'fill' ? 'Fill' : 'Edit';

    const apply = (next: Record<string, PermissionLevel>) =>
        onChange({ default: permissions.default ?? 'read', overrides: { ...next } });

    // Edit implies Read; unticking Read clears Edit.
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

    const cells = (field: FieldElement) => (
        <>
            <td className="text-center">
                <input
                    type="checkbox"
                    className="form-check-input"
                    aria-label={`Read ${field.label}`}
                    checked={levels[field.id] !== 'hidden'}
                    onChange={(event) => setRead(field.id, event.target.checked)}
                />
            </td>
            {canEdit ? (
                <td className="text-center">
                    <input
                        type="checkbox"
                        className="form-check-input"
                        aria-label={`${editLabel} ${field.label}`}
                        checked={levels[field.id] === 'edit'}
                        onChange={(event) => setEdit(field.id, event.target.checked)}
                    />
                </td>
            ) : (
                <td className="text-center text-muted">—</td>
            )}
        </>
    );

    // In form order: loose fields span both label columns; a section's name spans its fields.
    const rows: JSX.Element[] = [];
    const done = new Set<string>();
    fields.forEach((field) => {
        if (!field.group_id) {
            rows.push(
                <tr key={field.id}>
                    <td className="lk-perm-field" colSpan={2}>
                        {field.label || '(untitled)'}
                    </td>
                    {cells(field)}
                </tr>,
            );
            return;
        }
        if (done.has(field.group_id)) return;
        done.add(field.group_id);

        const members = fields.filter((member) => member.group_id === field.group_id);
        const section = sections.find((candidate) => candidate.id === field.group_id);
        members.forEach((member, index) =>
            rows.push(
                <tr key={member.id}>
                    {index === 0 && (
                        <td className="lk-perm-group" rowSpan={members.length}>
                            {section?.label || '(unnamed group)'}
                        </td>
                    )}
                    <td className="lk-perm-field">{member.label || '(untitled)'}</td>
                    {cells(member)}
                </tr>,
            ),
        );
    });

    return (
        <>
            <div className="small text-muted mb-2">
                {stepType === 'fill' ? (
                    <>
                        Tick <strong>Fill</strong> for the fields this handler must complete. Untick{' '}
                        <strong>Read</strong> to hide a field from them.
                    </>
                ) : stepType === 'cc' ? (
                    <>
                        Untick <strong>Read</strong> to hide a field from the CC recipients.
                    </>
                ) : (
                    <>
                        Untick <strong>Read</strong> to hide a field from the approvers; tick <strong>Edit</strong> to
                        let them change it.
                    </>
                )}
            </div>
            <div className="table-responsive">
                <table className="table table-sm table-bordered lk-perm-table mb-0">
                    <thead>
                        <tr>
                            <th colSpan={2} className="small">
                                Form fields
                            </th>
                            <th className="text-center small lk-perm-col">
                                <MasterCheckbox
                                    checked={fields.length > 0 && readCount === fields.length}
                                    indeterminate={readCount > 0 && readCount < fields.length}
                                    onChange={setAllRead}
                                />
                                Read
                            </th>
                            <th className="text-center small lk-perm-col">
                                {canEdit && (
                                    <>
                                        <MasterCheckbox
                                            checked={fields.length > 0 && editCount === fields.length}
                                            indeterminate={editCount > 0 && editCount < fields.length}
                                            onChange={setAllEdit}
                                        />
                                        {editLabel}
                                    </>
                                )}
                            </th>
                        </tr>
                    </thead>
                    <tbody>{rows}</tbody>
                </table>
            </div>
        </>
    );
}
