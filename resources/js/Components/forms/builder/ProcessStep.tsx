import clsx from 'clsx';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Field from '@/Components/form/Field';
import TextInput from '@/Components/form/TextInput';
import Dialog from '@/Components/surface/Dialog';
import type { DesignSection } from '@/lib/forms/design';
import { BRANCH_META, editTree, findArm, findNode, newArm, newNode, STEP_META } from '@/lib/forms/process';
import { tagClass } from '@/lib/tags';
import type { FieldElement, Person, ProcessNode, StepNode } from '@/types/forms';
import ConditionModal from './ConditionModal';
import NodeDrawer from './NodeDrawer';
import ProcessCanvas, { type ProcessCanvasHandle } from './ProcessCanvas';
import ProcessFlow, { type FlowActions } from './ProcessFlow';

interface ProcessStepProps {
    nodes: ProcessNode[];
    onChange: (nodes: ProcessNode[]) => void;
    fields: FieldElement[];
    sections: DesignSection[];
    people: Person[];
    /** Who may submit, as the Submitted card says it. */
    submitters: string;
    badNodes: Record<string, string>;
    /** The first problem found (and how many more); null when valid or not checked yet. */
    error: string | null;
    /** Bumped on every failed check, to bring the first bad step into view. */
    checkCount: number;
}

const KINDS = [
    { ...STEP_META.approval },
    { ...STEP_META.fill },
    { ...STEP_META.cc },
    { ...BRANCH_META, hint: 'Different steps for different answers. A path can repeat or go back to an earlier step.' },
];

/** Step 3, Process: approval, fill-in and copy-to steps, and branches by the answers. */
export default function ProcessStep({
    nodes,
    onChange,
    fields,
    sections,
    people,
    submitters,
    badNodes,
    error,
    checkCount,
}: ProcessStepProps) {
    const canvas = useRef<ProcessCanvasHandle>(null);
    const [drawer, setDrawer] = useState<{ nodeId: string; open: boolean; key: number } | null>(null);
    const [condition, setCondition] = useState<{ armId: string; open: boolean; key: number } | null>(null);
    const [renaming, setRenaming] = useState<{ armId: string; name: string; open: boolean } | null>(null);

    // A failed check brings the first bad step into view (it may be panned away).
    useEffect(() => {
        if (checkCount === 0) return;
        const first = document.querySelector('.process-chain .is-invalid');
        if (first) canvas.current?.bringIntoView(first);
    }, [checkCount]);

    const edit = (change: (draft: ProcessNode[]) => void) => onChange(editTree(nodes, change));

    const removeNode = (nodeId: string) =>
        edit((draft) => {
            const found = findNode(draft, nodeId);
            if (found) found.list.splice(found.index, 1);
        });

    const actions: FlowActions = {
        add: (armId, index, type) => {
            const node = newNode(type);
            edit((draft) => {
                const list = armId ? findArm(draft, armId)?.arm.nodes : draft;
                list?.splice(index, 0, node);
            });
            // A new step opens its settings straight away.
            if (type !== 'branch') {
                setDrawer((current) => ({ nodeId: node.id, open: true, key: (current?.key ?? 0) + 1 }));
            }
        },
        open: (nodeId) => setDrawer((current) => ({ nodeId, open: true, key: (current?.key ?? 0) + 1 })),
        move: (nodeId, delta) =>
            edit((draft) => {
                const found = findNode(draft, nodeId);
                if (!found) return;
                const to = found.index + delta;
                if (to < 0 || to >= found.list.length) return;
                found.list.splice(to, 0, found.list.splice(found.index, 1)[0]);
            }),
        remove: removeNode,
        addArm: (branchId) =>
            edit((draft) => {
                const found = findNode(draft, branchId);
                if (found?.node.type !== 'branch') return;
                const arms = found.node.branches;
                arms.splice(arms.length - 1, 0, newArm(arms.length));
            }),
        removeArm: (armId) =>
            edit((draft) => {
                const found = findArm(draft, armId);
                if (found) found.branch.branches.splice(found.index, 1);
            }),
        renameArm: (armId) => {
            const found = findArm(nodes, armId);
            if (found) setRenaming({ armId, name: found.arm.name ?? '', open: true });
        },
        setLoop: (armId, value) =>
            edit((draft) => {
                const arm = findArm(draft, armId)?.arm;
                if (!arm) return;
                delete arm.loop;
                delete arm.loop_to;
                if (value === 'loop') arm.loop = true;
                else if (value.startsWith('to:')) arm.loop_to = value.slice(3);
            }),
        editCondition: (armId) => setCondition((current) => ({ armId, open: true, key: (current?.key ?? 0) + 1 })),
    };

    const rename = (event: FormEvent) => {
        event.preventDefault();
        if (!renaming || !renaming.name.trim()) return;
        const name = renaming.name.trim();
        edit((draft) => {
            const arm = findArm(draft, renaming.armId)?.arm;
            if (arm) arm.name = name;
        });
        setRenaming({ ...renaming, open: false });
    };

    const drawerNode = drawer ? findNode(nodes, drawer.nodeId)?.node : undefined;
    const conditionArm = condition ? findArm(nodes, condition.armId)?.arm : undefined;

    return (
        <>
            {error && (
                <div className="rd-notice rd-notice--critical" role="alert">
                    <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                    {error}
                </div>
            )}

            <section className="process-board" aria-label="Process">
                <ProcessCanvas ref={canvas}>
                    <ProcessFlow
                        nodes={nodes}
                        fields={fields}
                        people={people}
                        badNodes={badNodes}
                        actions={actions}
                        submitters={submitters}
                    />
                </ProcessCanvas>

                <aside className="process-board__aside">
                    <h2 className="builder-pane__title">Kinds of step</h2>
                    <p className="process-board__lede">
                        Steps run top to bottom after someone submits. Press + to add one; press a step to set who does
                        it and what they can see. With no steps, a submission is approved straight away.
                    </p>
                    <ul className="process-kinds">
                        {KINDS.map((kind) => (
                            <li key={kind.label} className="process-kinds__item">
                                <span className={clsx(tagClass(kind.hue), 'flow-icon')} aria-hidden="true">
                                    <i className={`mdi ${kind.icon}`} />
                                </span>
                                <span className="process-kinds__text">
                                    <span className="process-kinds__name">{kind.label}</span>
                                    <span className="process-kinds__hint">{kind.hint}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </aside>
            </section>

            {drawer && drawerNode && drawerNode.type !== 'branch' && (
                <NodeDrawer
                    key={drawer.key}
                    show={drawer.open}
                    node={drawerNode}
                    fields={fields}
                    sections={sections}
                    people={people}
                    onHide={() => setDrawer({ ...drawer, open: false })}
                    onDelete={() => {
                        setDrawer({ ...drawer, open: false });
                        removeNode(drawerNode.id);
                    }}
                    onSave={(saved: StepNode) => {
                        edit((draft) => {
                            const found = findNode(draft, saved.id);
                            if (found) found.list[found.index] = saved;
                        });
                        setDrawer({ ...drawer, open: false });
                    }}
                />
            )}

            {condition && conditionArm && (
                <ConditionModal
                    key={condition.key}
                    show={condition.open}
                    pathName={conditionArm.name ?? ''}
                    initial={conditionArm.when}
                    sources={fields}
                    people={people}
                    onHide={() => setCondition({ ...condition, open: false })}
                    onSave={(schema) => {
                        edit((draft) => {
                            const arm = findArm(draft, condition.armId)?.arm;
                            if (arm) arm.when = schema ?? { logic: 'or', groups: [] };
                        });
                        setCondition({ ...condition, open: false });
                    }}
                />
            )}

            {renaming && (
                <Dialog
                    show={renaming.open}
                    onHide={() => setRenaming({ ...renaming, open: false })}
                    title="Rename the path"
                    text='People see its name under "After you submit" when they fill in the form.'
                    footer={
                        <>
                            <button
                                type="button"
                                className="rd-btn rd-btn--quiet rd-btn--lg"
                                onClick={() => setRenaming({ ...renaming, open: false })}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="rename-path"
                                className="rd-btn rd-btn--primary rd-btn--lg"
                                disabled={!renaming.name.trim()}
                            >
                                Rename
                            </button>
                        </>
                    }
                >
                    <form id="rename-path" onSubmit={rename}>
                        <Field label="Path name" htmlFor="path-name" required>
                            <TextInput
                                id="path-name"
                                large
                                autoFocus
                                maxLength={100}
                                value={renaming.name}
                                onChange={(event) => setRenaming({ ...renaming, name: event.target.value })}
                            />
                        </Field>
                    </form>
                </Dialog>
            )}
        </>
    );
}
