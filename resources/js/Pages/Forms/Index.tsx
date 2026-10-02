import { Link, router } from '@inertiajs/react';
import { closestCenter, DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { useToast } from '@/Components/feedback/ToastProvider';
import GroupNameModal from '@/Components/forms/GroupNameModal';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/Layouts/AppLayout';
import { confirm } from '@/lib/dialogs';
import { pluralize } from '@/lib/format';
import { errorMessage, postJson } from '@/lib/http';
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

/** The forms list: forms filed in groups, arranged by dragging. */
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

        setSaving('Saving the order…');
        try {
            await postJson(route('form.groups.reorder'), payload);
            setSaving('Order saved');
            window.setTimeout(() => setSaving(null), 900);
        } catch {
            setSaving('The order could not be saved. Reloading…');
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
            title: `Delete the ${groupName(id)} group?`,
            text:
                count === 0
                    ? 'It is empty, so nothing else changes.'
                    : `Its ${pluralize(count, 'form')} move to Ungrouped. No form is deleted.`,
            confirmText: 'Delete group',
            danger: true,
        });
        if (ok) router.post(route('form.groups.destroy', id));
    };

    const toggleForm = async (form: FormSummary) => {
        const ok = await confirm({
            title: form.is_enabled ? `Turn off ${form.name}?` : `Turn on ${form.name}?`,
            text: form.is_enabled
                ? 'People can no longer start it. Records already made stay as they are.'
                : 'People who may submit it see it in Start a form again.',
            confirmText: form.is_enabled ? 'Turn off' : 'Turn on',
        });
        if (!ok) return;

        try {
            await postJson(route('form.toggle'), { id: form.id });
            toast(form.is_enabled ? 'Form turned off.' : 'Form turned on.');
            router.reload();
        } catch (error) {
            toast(errorMessage(error, 'The form could not be changed.'), 'error');
        }
    };

    const deleteForm = async (form: FormSummary) => {
        const ok = await confirm({
            title: `Delete ${form.name}?`,
            text: 'This cannot be undone.',
            confirmText: 'Delete form',
            danger: true,
        });
        if (!ok) return;

        try {
            await postJson(route('form.delete'), { id: form.id });
            toast('Form deleted.');
            router.reload();
        } catch (error) {
            toast(errorMessage(error, 'The form could not be deleted.'), 'error');
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
        <AppLayout title="Forms">
            <SurfacePage>
                <PageHeader
                    crumbs={[{ label: 'Home', href: '/index' }, { label: 'Forms' }]}
                    title="Forms"
                    lede="The forms people fill in from Ronda, filed in groups."
                    actions={
                        canManage && (
                            <>
                                <button
                                    type="button"
                                    className="rd-btn rd-btn--lg"
                                    onClick={() => openDialog({ mode: 'create' })}
                                >
                                    <i className="mdi mdi-folder-plus-outline" aria-hidden="true" />
                                    New group
                                </button>
                                <Link href={route('form.create')} className="rd-btn rd-btn--primary rd-btn--lg">
                                    <i className="mdi mdi-plus" aria-hidden="true" />
                                    New form
                                </Link>
                            </>
                        )
                    }
                />

                <section className="rd-panel rd-panel--flush forms-list" aria-label="Forms">
                    <div className="forms-list__toolbar">
                        <form role="search" onSubmit={searchForms} className="forms-list__search">
                            <label className="rd-search">
                                <i className="mdi mdi-magnify" aria-hidden="true" />
                                <input
                                    type="search"
                                    className="rd-input"
                                    aria-label="Search forms"
                                    placeholder="Search forms"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                />
                            </label>
                            {search && (
                                <Link href={route('form.index')} className="rd-btn rd-btn--quiet">
                                    Clear the search
                                </Link>
                            )}
                        </form>
                        <span className="forms-list__count">
                            <strong>{formCount === 0 ? 'No forms' : pluralize(formCount, 'form')}</strong>
                            {search && <> matching &ldquo;{search}&rdquo;</>}
                            {canArrange && formCount > 1 && (
                                <>
                                    {' '}
                                    · drag <i className="mdi mdi-drag" aria-label="the handle" /> to arrange
                                </>
                            )}
                            {canManage && search && ' · clear the search to arrange them'}
                        </span>
                    </div>

                    <div className="forms-list__head" aria-hidden="true">
                        <span />
                        <span>Form</span>
                        <span>Status</span>
                        <span>Fields</span>
                        <span>Created</span>
                        <span />
                    </div>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={onDragStart}
                        onDragOver={onDragOver}
                        onDragEnd={onDragEnd}
                        onDragCancel={onDragCancel}
                    >
                        <SortableContext
                            items={arrangement.groups.map(groupKey)}
                            strategy={verticalListSortingStrategy}
                        >
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
                                        emptyText="No forms yet. Drag one here."
                                        actions={
                                            canManage && (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="rd-btn rd-btn--icon"
                                                        aria-label={`Rename ${groupName(id)}`}
                                                        title="Rename"
                                                        onClick={() =>
                                                            openDialog({ mode: 'rename', id, name: groupName(id) })
                                                        }
                                                    >
                                                        <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rd-btn rd-btn--icon rd-btn--icon-danger"
                                                        aria-label={`Delete ${groupName(id)}`}
                                                        title="Delete the group (its forms move to Ungrouped)"
                                                        onClick={() => deleteGroup(id, count)}
                                                    >
                                                        <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
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
                            emptyText={
                                formCount === 0 ? 'No forms yet.' : 'Drop a form here to take it out of its group.'
                            }
                        >
                            {renderRows(UNGROUPED)}
                        </FormListGroup>
                    </DndContext>

                    {formCount === 0 && (
                        <p className="rd-list__empty">
                            {search
                                ? 'No forms match.'
                                : canManage
                                  ? 'No forms yet. Make one with New form.'
                                  : 'No forms yet.'}
                        </p>
                    )}
                </section>

                {saving && (
                    <div className="forms-list__saving" role="status">
                        {saving}
                    </div>
                )}

                <GroupNameModal
                    show={dialogOpen}
                    onHide={() => setDialogOpen(false)}
                    action={
                        dialog.mode === 'rename' ? route('form.groups.update', dialog.id) : route('form.groups.store')
                    }
                    title={dialog.mode === 'rename' ? 'Rename the group' : 'New group'}
                    submitLabel={dialog.mode === 'rename' ? 'Save' : 'Make group'}
                    initialName={dialog.mode === 'rename' ? dialog.name : ''}
                    hint={
                        dialog.mode === 'create'
                            ? 'Groups only order the list. Who may submit is set on each form.'
                            : undefined
                    }
                    onSaved={groupSaved}
                />
            </SurfacePage>
        </AppLayout>
    );
}
