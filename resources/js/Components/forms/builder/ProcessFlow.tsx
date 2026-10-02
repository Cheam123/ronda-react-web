import clsx from 'clsx';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import SearchSelect from '@/Components/form/SearchSelect';
import {
    BRANCH_META,
    describeCondition,
    findNode,
    participantIds,
    STEP_META,
    type StepType,
} from '@/lib/forms/process';
import { tagClass } from '@/lib/tags';
import type { BranchArm, BranchNode, FieldElement, Person, ProcessNode, StepNode } from '@/types/forms';

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

/** "+" between steps, opening the kinds of step. */
function AddStepMenu({
    armId,
    index,
    allowBranch,
    after,
}: {
    armId: string | null;
    index: number;
    allowBranch: boolean;
    /** What it adds after, for its label. */
    after: string;
}) {
    const { actions } = useFlow();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent) => {
            if (!ref.current?.contains(event.target as Node)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    const choices = [
        // In the order of "Kinds of step" beside the flow.
        ...(['approval', 'fill', 'cc'] as const).map((type) => ({
            type: type as StepType | 'branch',
            ...STEP_META[type],
        })),
        ...(allowBranch ? [{ type: 'branch' as const, ...BRANCH_META }] : []),
    ];

    return (
        <div ref={ref} className="flow-add">
            <button
                type="button"
                className="flow-add__button"
                aria-label={`Add a step after ${after}`}
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
            >
                <i className="mdi mdi-plus" aria-hidden="true" />
            </button>
            {open && (
                <div className="flow-add__menu" role="menu">
                    {choices.map((choice) => (
                        <button
                            key={choice.type}
                            type="button"
                            role="menuitem"
                            className="flow-add__item"
                            onClick={() => {
                                setOpen(false);
                                actions.add(armId, index, choice.type);
                            }}
                        >
                            <span className={clsx(tagClass(choice.hue), 'flow-icon')} aria-hidden="true">
                                <i className={`mdi ${choice.icon}`} />
                            </span>
                            <span className="flow-add__text">
                                <span className="flow-add__label">{choice.label}</span>
                                <span className="flow-add__hint">{choice.hint}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function Connector(props: { armId: string | null; index: number; allowBranch: boolean; after: string }) {
    return (
        <div className="flow-connector">
            <span className="flow-line" aria-hidden="true" />
            <AddStepMenu {...props} />
            <span className="flow-line" aria-hidden="true" />
        </div>
    );
}

const stepName = (node: StepNode) => node.name || STEP_META[node.type].label;

/** The steps of one list (the main flow, or a path) with "+" between them. */
function StepList({ nodes, armId, start }: { nodes: ProcessNode[]; armId: string | null; start: string }) {
    // Branches nest one level deep, as the server allows.
    const allowBranch = armId === null;
    return (
        <>
            <Connector armId={armId} index={0} allowBranch={allowBranch} after={start} />
            {nodes.map((node, index) => (
                <div key={node.id} className="flow-item">
                    {node.type === 'branch' ? <BranchBlock node={node} /> : <StepCard node={node} />}
                    <Connector
                        armId={armId}
                        index={index + 1}
                        allowBranch={allowBranch}
                        after={node.type === 'branch' ? 'the branch' : stepName(node)}
                    />
                </div>
            ))}
        </>
    );
}

function listNames(ids: number[], people: Person[]): string {
    const list = ids.map((id) => people.find((person) => person.id === Number(id))?.name ?? `User ${id}`);
    return list.slice(0, 2).join(', ') + (list.length > 2 ? ` and ${list.length - 2} more` : '');
}

/** Who a step goes to and what they do, as its card says it. */
function StepWho({ node }: { node: StepNode }) {
    const { fields, people } = useFlow();

    if (node.type === 'fill' && node.assignee_mode === 'runtime') {
        return <>Whoever the step before picks fills it in</>;
    }
    if (node.type === 'fill' && node.assignee_mode === 'field') {
        const field = fields.find((candidate) => candidate.id === node.assignee_field);
        return field ? (
            <>Whoever is picked in &ldquo;{field.label || 'Person'}&rdquo; fills it in</>
        ) : (
            <span className="flow-step__missing">Choose a Person field</span>
        );
    }

    const ids = participantIds(node);
    if (ids.length === 0) {
        return <span className="flow-step__missing">Nobody yet. Press to choose.</span>;
    }
    const who = listNames(ids, people);
    if (node.type === 'approval') {
        return (
            <>
                {who}
                {ids.length > 1 && ` · ${node.approval_mode === 'all' ? 'everyone approves' : 'any one approves'}`}
            </>
        );
    }
    return (
        <>
            {who} {node.type === 'cc' ? 'can read it' : `fill${ids.length === 1 ? 's' : ''} in their part`}
        </>
    );
}

function NodeTools({ nodeId, label }: { nodeId: string; label: string }) {
    const { actions } = useFlow();
    return (
        <span className="flow-tools">
            <button
                type="button"
                className="flow-tools__button"
                aria-label={`Move ${label} up`}
                onClick={() => actions.move(nodeId, -1)}
            >
                <i className="mdi mdi-arrow-up" aria-hidden="true" />
            </button>
            <button
                type="button"
                className="flow-tools__button"
                aria-label={`Move ${label} down`}
                onClick={() => actions.move(nodeId, 1)}
            >
                <i className="mdi mdi-arrow-down" aria-hidden="true" />
            </button>
            <button
                type="button"
                className="flow-tools__button is-danger"
                aria-label={`Delete ${label}`}
                onClick={() => actions.remove(nodeId)}
            >
                <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
            </button>
        </span>
    );
}

function StepCard({ node }: { node: StepNode }) {
    const { badNodes, actions } = useFlow();
    const meta = STEP_META[node.type];
    const problem = badNodes[node.id];

    return (
        <div className={clsx('flow-step', problem && 'is-invalid')} data-node-id={node.id}>
            <div className="flow-step__head">
                <button type="button" className="flow-step__open" onClick={() => actions.open(node.id)}>
                    <span className={clsx(tagClass(meta.hue), 'flow-icon')} aria-hidden="true">
                        <i className={`mdi ${meta.icon}`} />
                    </span>
                    <span className="flow-step__title">
                        <span className="flow-step__kind">{meta.label}</span>
                        <span className="flow-step__name">{stepName(node)}</span>
                    </span>
                </button>
                <NodeTools nodeId={node.id} label={stepName(node)} />
            </div>
            <button type="button" className="flow-step__body" onClick={() => actions.open(node.id)}>
                <StepWho node={node} />
            </button>
            {problem && (
                <span className="flow-step__problem">
                    <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                    {problem}
                </span>
            )}
        </div>
    );
}

/** Carry on, repeat this path, or go back to an earlier step in the same flow. */
function LoopControl({ branch, arm }: { branch: BranchNode; arm: BranchArm }) {
    const { nodes, actions } = useFlow();
    const found = findNode(nodes, branch.id);
    // Only steps above this branch, and not other branches, can be gone back to.
    const earlier = found
        ? found.list.slice(0, found.index).filter((step): step is StepNode => step.type !== 'branch')
        : [];
    const value = arm.loop ? 'loop' : arm.loop_to ? `to:${arm.loop_to}` : '';

    return (
        <div className="flow-path__loop">
            <SearchSelect
                compact
                ariaLabel={`After ${arm.name || 'this path'}`}
                clearable={false}
                searchable={false}
                options={[
                    { value: '', label: 'Then carry on' },
                    { value: 'loop', label: 'Repeat while it still matches' },
                    ...earlier.map((step) => ({ value: `to:${step.id}`, label: `Then go back to ${stepName(step)}` })),
                ]}
                value={value}
                onChange={(next) => actions.setLoop(arm.id, next)}
            />
        </div>
    );
}

/** Where a repeating path goes once its steps are done. */
function LoopTail({ arm }: { arm: BranchArm }) {
    const { nodes } = useFlow();
    if (arm.loop) {
        return (
            <span className="flow-path__tail">
                <i className="mdi mdi-repeat" aria-hidden="true" />
                Checks again, and repeats while it matches
            </span>
        );
    }
    if (!arm.loop_to) return null;
    const target = findNode(nodes, arm.loop_to);
    const name = target && target.node.type !== 'branch' ? stepName(target.node) : 'an earlier step';
    return (
        <span className="flow-path__tail">
            <i className="mdi mdi-history" aria-hidden="true" />
            Goes back to {name}
        </span>
    );
}

function BranchBlock({ node }: { node: BranchNode }) {
    const { fields, badNodes, actions } = useFlow();
    const problem = badNodes[node.id];

    return (
        <div className={clsx('flow-branch', problem && 'is-invalid')} data-node-id={node.id}>
            <div className="flow-branch__head">
                <span className="flow-branch__title">
                    <i className={`mdi ${BRANCH_META.icon}`} aria-hidden="true" />
                    Branch: one path, by the answers
                </span>
                <span className="flow-branch__actions">
                    <button type="button" className="flow-branch__add" onClick={() => actions.addArm(node.id)}>
                        <i className="mdi mdi-plus" aria-hidden="true" />
                        Add a path
                    </button>
                    <NodeTools nodeId={node.id} label="the branch" />
                </span>
            </div>
            {problem && (
                <span className="flow-step__problem">
                    <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                    {problem}
                </span>
            )}
            <div className="flow-branch__paths" style={{ ['--flow-paths' as string]: node.branches.length }}>
                {node.branches.map((arm, index) => {
                    const isDefault = index === node.branches.length - 1;
                    const name = isDefault ? 'Otherwise' : arm.name || `Path ${index + 1}`;
                    return (
                        <div key={arm.id} className="flow-path">
                            {isDefault ? (
                                <div className="flow-path__card is-default">
                                    <span className="flow-path__name">Otherwise</span>
                                    <span className="flow-path__when">Every other answer</span>
                                </div>
                            ) : (
                                <div className="flow-path__card">
                                    <span className="flow-path__top">
                                        <button
                                            type="button"
                                            className="flow-path__name"
                                            aria-label={`Rename ${name}`}
                                            onClick={() => actions.renameArm(arm.id)}
                                        >
                                            {name}
                                            <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                                        </button>
                                        {node.branches.length > 2 && (
                                            <button
                                                type="button"
                                                className="flow-tools__button is-danger"
                                                aria-label={`Remove ${name}`}
                                                onClick={() => actions.removeArm(arm.id)}
                                            >
                                                <i className="mdi mdi-close" aria-hidden="true" />
                                            </button>
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        className="flow-path__when"
                                        onClick={() => actions.editCondition(arm.id)}
                                    >
                                        {describeCondition(arm.when, fields) ?? (
                                            <span className="flow-step__missing">Set when to take this path</span>
                                        )}
                                    </button>
                                    <LoopControl branch={node} arm={arm} />
                                </div>
                            )}
                            <div className="flow-path__steps">
                                <StepList nodes={arm.nodes} armId={arm.id} start={name} />
                            </div>
                            {!isDefault && <LoopTail arm={arm} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface ProcessFlowProps extends FlowData {
    /** "Everyone", "3 people and 1 user type". */
    submitters: string;
}

/** The whole flow: Submitted, the steps and branches, Done. */
export default function ProcessFlow({ submitters, ...data }: ProcessFlowProps) {
    return (
        <Flow.Provider value={data}>
            <div className="flow-submitted">
                <span className="flow-icon flow-icon--dark" aria-hidden="true">
                    <i className="mdi mdi-send-outline" />
                </span>
                <span className="flow-submitted__text">
                    <span className="flow-submitted__name">Submitted</span>
                    <span className="flow-submitted__who">By {submitters.toLowerCase()}</span>
                </span>
            </div>
            <StepList nodes={data.nodes} armId={null} start="Submitted" />
            <span className="flow-done">
                <i className="mdi mdi-check" aria-hidden="true" />
                Done
            </span>
        </Flow.Provider>
    );
}
