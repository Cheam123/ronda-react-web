import { useEffect, useRef, useState } from 'react';
import type { DesignSection } from '@/lib/forms/design';
import { promptText } from '@/lib/dialogs';
import { editTree, findArm, findNode, newArm, newNode } from '@/lib/forms/process';
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
    /** Who may submit, as the Submit card says it. */
    submitters: string;
    badNodes: Record<string, string>;
    /** The first problem found (+ how many more); null when valid or not checked yet. */
    error: string | null;
    /** Bumped on every failed check, to bring the first bad step into view. */
    checkCount: number;
}

/** Step 3, Process Design: Handler, Approval and CC steps, and conditional branches. */
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

    // A failed check brings the first bad step into view (it may be panned away).
    useEffect(() => {
        if (checkCount === 0) return;
        const first = document.querySelector('.process-chain .lk-node--invalid');
        if (first) canvas.current?.bringIntoView(first);
    }, [checkCount]);

    const edit = (change: (draft: ProcessNode[]) => void) => onChange(editTree(nodes, change));

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
        remove: (nodeId) =>
            edit((draft) => {
                const found = findNode(draft, nodeId);
                if (found) found.list.splice(found.index, 1);
            }),
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
        renameArm: async (armId) => {
            const found = findArm(nodes, armId);
            if (!found) return;
            const name = await promptText({
                title: 'Branch name',
                inputValue: found.arm.name ?? '',
                confirmText: 'Rename',
            });
            if (name === null || !name.trim()) return;
            edit((draft) => {
                const arm = findArm(draft, armId)?.arm;
                if (arm) arm.name = name.trim();
            });
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

    const drawerNode = drawer ? findNode(nodes, drawer.nodeId)?.node : undefined;
    const conditionArm = condition ? findArm(nodes, condition.armId)?.arm : undefined;

    return (
        <div className="card mt-3">
            <div className="card-body">
                <h4 className="card-title mb-1">Process Design</h4>
                <p className="text-muted small mb-3">
                    Define what happens after submission: <strong>Handler</strong> steps (other users fill their part of
                    the form — no approval), <strong>Approval</strong> steps, <strong>CC</strong>, and{' '}
                    <strong>Conditional Branches</strong>. Fields assigned to a Handler are hidden from the original
                    submitter. Click a step to set its people and Form Permissions. A form with no steps is
                    auto-approved on submission.
                </p>

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

                {error && (
                    <div className="process-error mt-3">
                        <i className="mdi mdi-alert-circle-outline" />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {drawer && drawerNode && drawerNode.type !== 'branch' && (
                <NodeDrawer
                    key={drawer.key}
                    show={drawer.open}
                    node={drawerNode}
                    fields={fields}
                    sections={sections}
                    people={people}
                    onHide={() => setDrawer({ ...drawer, open: false })}
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
        </div>
    );
}
