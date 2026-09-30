import clsx from 'clsx';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { BRANCH_META, findNode, participantIds, STEP_META, type StepType } from '@/lib/forms/process';
import type {
    BranchArm,
    BranchNode,
    ConditionOperator,
    FieldElement,
    Person,
    ProcessNode,
    StepNode,
} from '@/types/forms';

/** Operators as a branch card summarises them. */
const OPERATOR_TEXT: Record<ConditionOperator, string> = {
    equals: 'is',
    not_equals: 'is not',
    includes: 'includes',
    not_includes: 'does not include',
    gt: '>',
    lt: '<',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
};

/** What the flow's cards can ask for. */
export interface FlowActions {
    add: (armId: string | null, index: number, type: StepType | 'branch') => void;
    open: (nodeId: string) => void;
    move: (nodeId: string, delta: -1 | 1) => void;
    remove: (nodeId: string) => void;
    addArm: (branchId: string) => void;
    removeArm: (armId: string) => void;
    renameArm: (armId: string) => void;
    setLoop: (armId: string, value: string) => void;
    editCondition: (armId: string) => void;
}

interface FlowData {
    nodes: ProcessNode[];
    fields: FieldElement[];
    people: Person[];
    /** node id -> what is wrong with it (after a failed check). */
    badNodes: Record<string, string>;
    actions: FlowActions;
}

const Flow = createContext<FlowData | null>(null);

function useFlow(): FlowData {
    const flow = useContext(Flow);
    if (!flow) throw new Error('ProcessFlow parts must render inside <ProcessFlow>.');
    return flow;
}

/** "+" between steps, opening the list of step types. */
function AddStepMenu({ armId, index, allowBranch }: { armId: string | null; index: number; allowBranch: boolean }) {
    const { actions } = useFlow();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent) => {
            if (!ref.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const choices: { type: StepType | 'branch'; label: string; color: string; hint: string }[] = [
        ...(Object.entries(STEP_META) as [StepType, (typeof STEP_META)[StepType]][]).map(([type, meta]) => ({
            type,
            label: meta.label,
            color: meta.color,
            hint: meta.hint,
        })),
        ...(allowBranch
            ? [{ type: 'branch' as const, label: BRANCH_META.label, color: BRANCH_META.color, hint: BRANCH_META.hint }]
            : []),
    ];

    return (
        <div ref={ref} className="lk-add">
            <button
                type="button"
                className="lk-add-btn"
                title="Add step"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
            >
                <i className="mdi mdi-plus" />
            </button>
            {open && (
                <ul className="lk-add-menu dropdown-menu show shadow-sm">
                    {choices.map((choice) => (
                        <li key={choice.type}>
                            <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => {
                                    setOpen(false);
                                    actions.add(armId, index, choice.type);
                                }}
                            >
                                <span className="lk-menu-dot" style={{ background: choice.color }} />
                                {choice.label}
                                <span className="lk-menu-hint">{choice.hint}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function Connector({ armId, index, allowBranch }: { armId: string | null; index: number; allowBranch: boolean }) {
    return (
        <div className="lk-connector">
            <div className="lk-line" />
            <AddStepMenu armId={armId} index={index} allowBranch={allowBranch} />
            <div className="lk-line lk-line-arrow" />
        </div>
    );
}

/** The steps of one list (the main flow, or a branch arm) with "+" between them. */
function StepList({ nodes, armId }: { nodes: ProcessNode[]; armId: string | null }) {
    // Branches nest one level deep, as the server allows.
    const allowBranch = armId === null;
    return (
        <>
            <Connector armId={armId} index={0} allowBranch={allowBranch} />
            {nodes.map((node, index) => (
                <FlowNode key={node.id} node={node} armId={armId} index={index + 1} allowBranch={allowBranch} />
            ))}
        </>
    );
}

function FlowNode({
    node,
    armId,
    index,
    allowBranch,
}: {
    node: ProcessNode;
    armId: string | null;
    index: number;
    allowBranch: boolean;
}) {
    return (
        <>
            {node.type === 'branch' ? <BranchBlock node={node} /> : <StepCard node={node} />}
            <Connector armId={armId} index={index} allowBranch={allowBranch} />
        </>
    );
}

function names(ids: number[], people: Person[]): ReactNode {
    if (ids.length === 0) return <span className="lk-missing">Click to set</span>;
    const list = ids.map((id) => people.find((person) => person.id === Number(id))?.name ?? `User #${id}`);
    return list.slice(0, 3).join(', ') + (list.length > 3 ? ` +${list.length - 3}` : '');
}

/** Who a step goes to, as its card says it. */
function AssigneeLine({ node }: { node: StepNode }) {
    const { fields, people } = useFlow();

    if (node.type === 'fill' && node.assignee_mode === 'runtime') {
        return (
            <span className="lk-runtime-tag">
                <i className="mdi mdi-account-question-outline" /> Picked when the flow gets here
            </span>
        );
    }
    if (node.type === 'fill' && node.assignee_mode === 'field') {
        const field = fields.find((candidate) => candidate.id === node.assignee_field);
        return field ? (
            <span className="lk-runtime-tag">
                <i className="mdi mdi-account-arrow-right-outline" /> From “{field.label || 'Person field'}”
            </span>
        ) : (
            <span className="lk-missing">Click to pick a Person field</span>
        );
    }
    return <>{names(participantIds(node), people)}</>;
}

function MiniActions({ nodeId, dark = false }: { nodeId: string; dark?: boolean }) {
    const { actions } = useFlow();
    const buttonClass = dark ? 'lk-mini-dark' : 'lk-mini';
    return (
        <span className={clsx('lk-head-actions', dark && 'lk-branch-actions')}>
            <button type="button" className={buttonClass} title="Move up" onClick={() => actions.move(nodeId, -1)}>
                <i className="mdi mdi-arrow-up" />
            </button>
            <button type="button" className={buttonClass} title="Move down" onClick={() => actions.move(nodeId, 1)}>
                <i className="mdi mdi-arrow-down" />
            </button>
            <button
                type="button"
                className={buttonClass}
                title={dark ? 'Delete branch block' : 'Delete'}
                onClick={() => actions.remove(nodeId)}
            >
                <i className="mdi mdi-close" />
            </button>
        </span>
    );
}

function StepCard({ node }: { node: StepNode }) {
    const { badNodes, actions } = useFlow();
    const meta = STEP_META[node.type];
    const problem = badNodes[node.id];

    return (
        <div
            className={clsx('lk-node', problem && 'lk-node--invalid')}
            data-node-id={node.id}
            title={problem}
            role="button"
            tabIndex={0}
            onClick={(event) => {
                if (!(event.target as HTMLElement).closest('button')) actions.open(node.id);
            }}
            onKeyDown={(event) => event.key === 'Enter' && actions.open(node.id)}
        >
            <div className="lk-node-head" style={{ background: meta.color }}>
                <span className="lk-head-title">{node.name || meta.label}</span>
                <MiniActions nodeId={node.id} />
            </div>
            <div className="lk-node-body">
                <span className="lk-body-label">{meta.role}:</span> <AssigneeLine node={node} />
                <i className="mdi mdi-chevron-right lk-chevron" />
            </div>
        </div>
    );
}

function conditionSummary(arm: BranchArm, fields: FieldElement[]): ReactNode {
    const groups = arm.when?.groups ?? [];
    const conditions = groups[0]?.conditions ?? [];
    if (conditions.length === 0) return <span className="lk-missing">Click to set condition</span>;

    const first = conditions[0];
    const field = fields.find((candidate) => candidate.id === first.field);
    const label = field ? field.label || '(untitled)' : first.field;
    let text = `When ${label} ${OPERATOR_TEXT[first.operator] ?? first.operator}`;
    if (first.value !== null && first.value !== undefined && !['is_empty', 'is_not_empty'].includes(first.operator)) {
        text += ` "${first.value}"`;
    }
    const total = groups.reduce((count, group) => count + (group.conditions ?? []).length, 0);
    return total > 1 ? `${text} +${total - 1} more` : text;
}

/** "Don't repeat", repeat this path, or rewind to an earlier step in the same flow. */
function LoopControl({ branch, arm }: { branch: BranchNode; arm: BranchArm }) {
    const { nodes, actions } = useFlow();
    const found = findNode(nodes, branch.id);
    // Only steps above this branch, and not other branch blocks, can be rewound to.
    const earlier = found
        ? found.list.slice(0, found.index).filter((step): step is StepNode => step.type !== 'branch')
        : [];
    const value = arm.loop ? 'loop' : arm.loop_to ? `to:${arm.loop_to}` : '';

    return (
        <div
            className={clsx('lk-cond-loop', value && 'lk-loop-on')}
            title="Repeat while this condition still matches — e.g. keep going while Status is Pending."
            onClick={(event) => event.stopPropagation()}
        >
            <i className="mdi mdi-repeat me-1" />
            <select
                className="lk-loop-select"
                aria-label="Repeat"
                value={value}
                onChange={(event) => actions.setLoop(arm.id, event.target.value)}
            >
                <option value="">Don&apos;t repeat</option>
                <option value="loop">Repeat this path</option>
                {earlier.map((step) => (
                    <option key={step.id} value={`to:${step.id}`}>
                        Repeat from: {step.name || STEP_META[step.type].label}
                    </option>
                ))}
                {earlier.length === 0 && (
                    <option value="" disabled>
                        Repeat from… (add a step above this branch first)
                    </option>
                )}
            </select>
        </div>
    );
}

function LoopTail({ arm }: { arm: BranchArm }) {
    const { nodes } = useFlow();
    if (arm.loop) {
        return (
            <span className="lk-loop-tail">
                <i className="mdi mdi-repeat" /> loops back
            </span>
        );
    }
    if (!arm.loop_to) return null;
    const target = findNode(nodes, arm.loop_to);
    const name =
        target && target.node.type !== 'branch'
            ? target.node.name || STEP_META[target.node.type].label
            : 'earlier step';
    return (
        <span className="lk-loop-tail">
            <i className="mdi mdi-repeat" /> back to {name}
        </span>
    );
}

function BranchBlock({ node }: { node: BranchNode }) {
    const { fields, badNodes, actions } = useFlow();

    return (
        <div
            className={clsx('lk-branch', badNodes[node.id] && 'lk-node--invalid')}
            data-node-id={node.id}
            title={badNodes[node.id]}
        >
            <div className="lk-branch-top">
                <button type="button" className="lk-branch-pill" onClick={() => actions.addArm(node.id)}>
                    <i className="mdi mdi-plus me-1" />
                    Add Conditional Branch
                </button>
                <MiniActions nodeId={node.id} dark />
            </div>
            <div className="lk-branch-center-drop" />
            <div className="lk-branch-columns">
                {node.branches.map((arm, index) => {
                    const isDefault = index === node.branches.length - 1;
                    const rails = clsx(
                        index === 0 && 'lk-rail-first',
                        index === node.branches.length - 1 && 'lk-rail-last',
                    );
                    return (
                        <div key={arm.id} className="lk-branch-column">
                            <div className={clsx('lk-rail lk-rail-top', rails)} />
                            {isDefault ? (
                                <div className="lk-cond-card lk-cond-default">
                                    <div className="lk-cond-head">
                                        <span>Else</span>
                                        <span className="lk-priority">Priority {index + 1}</span>
                                    </div>
                                    <div className="lk-cond-body text-muted">All other cases</div>
                                </div>
                            ) : (
                                <div
                                    className="lk-cond-card"
                                    role="button"
                                    tabIndex={0}
                                    onClick={(event) => {
                                        if (!(event.target as HTMLElement).closest('button, select'))
                                            actions.editCondition(arm.id);
                                    }}
                                    onKeyDown={(event) => event.key === 'Enter' && actions.editCondition(arm.id)}
                                >
                                    <div className="lk-cond-head">
                                        <span
                                            className="lk-cond-name"
                                            title="Double-click to rename"
                                            onDoubleClick={(event) => {
                                                event.stopPropagation();
                                                actions.renameArm(arm.id);
                                            }}
                                        >
                                            {arm.name || `Conditional branch ${index + 1}`}
                                        </span>
                                        <span className="lk-priority">Priority {index + 1}</span>
                                        <button
                                            type="button"
                                            className="lk-mini-grey"
                                            title="Remove branch"
                                            onClick={() => actions.removeArm(arm.id)}
                                        >
                                            <i className="mdi mdi-close" />
                                        </button>
                                    </div>
                                    <div className="lk-cond-body">
                                        {conditionSummary(arm, fields)}{' '}
                                        <i className="mdi mdi-chevron-right lk-chevron" />
                                    </div>
                                    <LoopControl branch={node} arm={arm} />
                                </div>
                            )}
                            <div className="lk-branch-chain">
                                <StepList nodes={arm.nodes} armId={arm.id} />
                            </div>
                            <div className="lk-col-tail">{!isDefault && <LoopTail arm={arm} />}</div>
                            <div className={clsx('lk-rail lk-rail-bottom', rails)} />
                        </div>
                    );
                })}
            </div>
            <div className="lk-branch-center-drop" />
        </div>
    );
}

interface ProcessFlowProps extends FlowData {
    /** "All members", "3 members, 1 user type"… */
    submitters: string;
}

/** The whole flow: Submit, the steps and branches, End. */
export default function ProcessFlow({ submitters, ...data }: ProcessFlowProps) {
    return (
        <Flow.Provider value={data}>
            <div className="lk-node lk-node-submit">
                <div className="lk-node-head lk-node-head--submit">Submit</div>
                <div className="lk-node-body">
                    <span className="lk-body-label">Submitted by:</span> {submitters}
                </div>
            </div>
            <StepList nodes={data.nodes} armId={null} />
            <div className="lk-end">
                <span>End</span>
            </div>
        </Flow.Provider>
    );
}
