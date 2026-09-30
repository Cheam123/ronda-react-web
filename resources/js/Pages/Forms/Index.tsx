import { router } from '@inertiajs/react';
import { closestCenter, DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useCallback, useMemo, useState, type FormEvent } from 'react';
import GroupNameModal from '@/Components/forms/GroupNameModal';
import TextInput from '@/Components/form/TextInput';
import { useToast } from '@/Components/feedback/ToastProvider';
import { ButtonLink } from '@/Components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/Layouts/AppLayout';
import { alertError, alertSuccess, confirm } from '@/lib/dialogs';
import { pluralize } from '@/lib/format';
import { postJson } from '@/lib/http';
import type { FormSummary } from '@/types/forms';
import FormListGroup from './Partials/FormListGroup';
import FormListRow from './Partials/FormListRow';
import { groupKey, UNGROUPED, useFormArrangement, type Arrangement } from './Partials/useFormArrangement';

interface FormGroupRow {
    id: number;
    name: string;
    forms: FormSummary[];
}

interface FormsIndexProps {
    groups: FormGroupRow[];
    ungrouped: FormSummary[];
    search: string;
    formCount: number;
}

type GroupDialog = { mode: 'create' } | { mode: 'rename'; id: number; name: string };

/** The Form List: forms filed in groups, arranged by dragging. */
export default function FormsIndex({ groups, ungrouped, search, formCount }: FormsIndexProps) {
    const { can } = useAuth();
    const toast = useToast();
    const canManage = can('form_creation');
    // Arranging a filtered list would save an order built from part of it.
    const canArrange = canManage && !search;

    const [query, setQuery] = useState(search);
    // The dialog keeps its content while it animates closed.
    const [dialog, setDialog] = useState<GroupDialog>({ mode: 'create' });
    const [dialogOpen, setDialogOpen] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);

    const forms = useMemo(() => {
        const byId = new Map<number, FormSummary>();
        [...groups.flatMap((group) => group.forms), ...ungrouped].forEach((form) => byId.set(form.id, form));
        return byId;
    }, [groups, ungrouped]);

    const initial: Arrangement = useMemo(
        () => ({
            groups: groups.map((group) => group.id),
            lists: {
                ...Object.fromEntries(groups.map((group) => [String(group.id), group.forms.map((form) => form.id)])),
                [UNGROUPED]: ungrouped.map((form) => form.id),
            },
        }),
        [groups, ungrouped],
    );

    const persist = useCallback(async (next: Arrangement) => {
        const payload = {
            forms: Object.entries(next.lists).flatMap(([list, ids]) =>
                ids.map((id, position) => ({ id, group_id: list === UNGROUPED ? null : Number(list), position })),
            ),
            groups: next.groups.map((id, position) => ({ id, position })),
        };

        setSaving('Saving order…');
        try {
            await postJson(route('form.groups.reorder'), payload);
            setSaving('Order saved');
            window.setTimeout(() => setSaving(null), 900);
        } catch {
            setSaving('Could not save the order — reloading');
            window.setTimeout(() => router.reload(), 1200);
        }
    }, []);

    const { arrangement, sensors, dragging, onDragStart, onDragOver, onDragEnd, onDragCancel } = useFormArrangement(
        initial,
        persist,
    );

    const groupName = (id: number) => groups.find((group) => group.id === id)?.name ?? '';
    const draggingForm = dragging?.startsWith('form:') ?? false;

    const searchForms = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('form.index'), query ? { search: query } : {}, { preserveState: true });
    };

    const deleteGroup = async (id: number, count: number) => {
        const ok = await confirm({
            title: `Delete "${groupName(id)}"?`,
            text:
                count === 0
                    ? 'This empty group will be removed.'
                    : `${count} form(s) will move to Ungrouped. No form is deleted.`,
            icon: 'warning',
            confirmText: 'Delete group',
            danger: true,
        });
        if (ok) router.post(route('form.groups.destroy', id));
    };

    const toggleForm = async (form: FormSummary) => {
        const action = form.is_enabled ? 'disable' : 'enable';
        if (
            !(await confirm({
                title: `${form.is_enabled ? 'Disable' : 'Enable'} this form?`,
                text: `Are you sure you want to ${action} this form?`,
                icon: 'warning',
            }))
        ) {
            return;
        }
        try {
            await postJson(route('form.toggle'), { id: form.id });
            await alertSuccess('Success!', `Form has been ${action}d.`);
            router.reload();
        } catch {
            await alertError('Error!', 'Something went wrong.');
        }
    };

    const deleteForm = async (form: FormSummary) => {
        const ok = await confirm({
            title: 'Please confirm to proceed on the deletion!',
            text: "You won't be able to revert this!",
            icon: 'warning',
            danger: true,
        });
        if (!ok) return;
        try {
            await postJson(route('form.delete'), { id: form.id });
            await alertSuccess('Deleted!', 'Your form has been deleted.');
            router.reload();
        } catch {
            await alertError('Error!', 'Something went wrong.');
        }
    };

    const openDialog = (next: GroupDialog) => {
        setDialog(next);
        setDialogOpen(true);
    };

    const groupSaved = ({ message }: { message: string }) => {
        setDialogOpen(false);
        toast(message);
        router.reload();
    };

    const renderRows = (list: string) =>
        (arrangement.lists[list] ?? []).map((id) => {
            const form = forms.get(id);
            return form ? (
                <FormListRow
                    key={id}
                    form={form}
                    canManage={canManage}
                    canArrange={canArrange}
                    onToggle={toggleForm}
                    onDelete={deleteForm}
                />
            ) : null;
        });

    return (
        <AppLayout title="Form List" breadcrumb={['Form List']}>
            <div className="page-title-box d-flex align-items-center justify-content-between flex-wrap gap-2">
                <h4 className="mb-0">Form List</h4>
                {canManage && (
                    <div className="d-flex gap-1">
                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => openDialog({ mode: 'create' })}
                        >
                            <i className="mdi mdi-folder-plus-outline me-1" /> Create Group
                        </button>
                        <ButtonLink href={route('form.create')} icon="mdi mdi-plus">
                            Create New Form
                        </ButtonLink>
                    </div>
                )}
            </div>

            <div className="fl-toolbar">
                <form onSubmit={searchForms} className="fl-search">
                    <div className="input-group">
                        <span className="input-group-text">
                            <i className="mdi mdi-magnify" />
                        </span>
                        <TextInput
                            large
                            placeholder="Search forms..."
                            aria-label="Search forms"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                        {search && (
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                title="Clear"
                                onClick={() => router.get(route('form.index'))}
                            >
                                <i className="mdi mdi-close" />
                            </button>
                        )}
                    </div>
                </form>
                <div className="text-muted small">
                    {formCount === 0 ? 'No forms' : pluralize(formCount, 'form')}
                    {search && <> matching &ldquo;{search}&rdquo;</>}
                    {canArrange && (
                        <>
                            {' '}
                            &middot; drag <i className="mdi mdi-drag-horizontal-variant" /> to arrange
                        </>
                    )}
                </div>
            </div>

            {search && (
                <div className="alert alert-light border small py-2 px-3">
                    <i className="mdi mdi-information-outline me-1" />
                    Clear the search to rearrange forms.
                </div>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDragCancel={onDragCancel}
            >
                <SortableContext items={arrangement.groups.map(groupKey)} strategy={verticalListSortingStrategy}>
                    {arrangement.groups.map((id) => {
                        const list = String(id);
                        const count = arrangement.lists[list]?.length ?? 0;
                        return (
                            <FormListGroup
                                key={id}
                                group={{ id, name: groupName(id) }}
                                list={list}
                                formIds={arrangement.lists[list] ?? []}
                                canArrange={canArrange}
                                dragging={draggingForm}
                                emptyText="Drag forms here."
                                actions={
                                    canManage && (
                                        <>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary"
                                                title="Rename group"
                                                onClick={() => openDialog({ mode: 'rename', id, name: groupName(id) })}
                                            >
                                                <i className="mdi mdi-pencil-outline" />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger"
                                                title="Delete group"
                                                onClick={() => deleteGroup(id, count)}
                                            >
                                                <i className="mdi mdi-trash-can-outline" />
                                            </button>
                                        </>
                                    )
                                }
                            >
                                {renderRows(list)}
                            </FormListGroup>
                        );
                    })}
                </SortableContext>

                <FormListGroup
                    group={null}
                    list={UNGROUPED}
                    formIds={arrangement.lists[UNGROUPED] ?? []}
                    canArrange={canArrange}
                    dragging={draggingForm}
                    emptyText={formCount === 0 ? 'No forms yet.' : 'Every form is filed in a group.'}
                >
                    {renderRows(UNGROUPED)}
                </FormListGroup>
            </DndContext>

            {saving && <div className="fl-saving">{saving}</div>}

            <GroupNameModal
                show={dialogOpen}
                onHide={() => setDialogOpen(false)}
                action={dialog.mode === 'rename' ? route('form.groups.update', dialog.id) : route('form.groups.store')}
                title={dialog.mode === 'rename' ? 'Rename group' : 'Create group'}
                submitLabel={dialog.mode === 'rename' ? 'Save' : 'Create group'}
                initialName={dialog.mode === 'rename' ? dialog.name : ''}
                hint={
                    dialog.mode === 'create'
                        ? 'Groups only organise the list. Who may submit a form is still set on the form itself.'
                        : undefined
                }
                onSaved={groupSaved}
            />
        </AppLayout>
    );
}
