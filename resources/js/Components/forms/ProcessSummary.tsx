import clsx from 'clsx';
import { BRANCH_META, describeCondition, findNode, STEP_META } from '@/lib/forms/process';
import { tagClass } from '@/lib/tags';
import type { BranchArm, FieldElement, ProcessNode, StepNode } from '@/types/forms';

interface ProcessSummaryProps {
    nodes: ProcessNode[];
    /** user id -> name, for everyone the process names (FormController::userNamesInProcess). */
    names: Record<string, string>;
    /** The form's fields, to word branch conditions and Person-field steps. */
    fields: FieldElement[];
}

/** A form's process in words: each step, who takes it, and which answers pick a path. */
export default function ProcessSummary({ nodes, names, fields }: ProcessSummaryProps) {
    if (nodes.length === 0) {
        return <p className="process-summary__none">No steps: it is approved as soon as it is submitted.</p>;
    }

    return <StepList nodes={nodes} all={nodes} names={names} fields={fields} />;
}

interface ListProps {
    nodes: ProcessNode[];
    /** The whole flow, to name the step a path goes back to. */
    all: ProcessNode[];
    names: Record<string, string>;
    fields: FieldElement[];
}

function StepList({ nodes, all, names, fields }: ListProps) {
    return (
        <ol className="process-summary">
            {nodes.map((node) =>
                node.type === 'branch' ? (
                    <li key={node.id} className="process-summary__item">
                        <span className={clsx(tagClass(BRANCH_META.hue), 'process-summary__icon')} aria-hidden="true">
                            <i className={`mdi ${BRANCH_META.icon}`} />
                        </span>
                        <span className="process-summary__text">
                            <span className="process-summary__name">Depends on the answers</span>
                            <span className="process-summary__paths">
                                {node.branches.map((arm, index) => (
                                    <Path
                                        key={arm.id}
                                        arm={arm}
                                        last={index === node.branches.length - 1}
                                        all={all}
                                        names={names}
                                        fields={fields}
                                    />
                                ))}
                            </span>
                        </span>
                    </li>
                ) : (
                    <Step key={node.id} node={node} names={names} fields={fields} />
                ),
            )}
        </ol>
    );
}

function Path({ arm, last, all, names, fields }: { arm: BranchArm; last: boolean } & Omit<ListProps, 'nodes'>) {
    const when = last ? 'Otherwise' : (describeCondition(arm.when, fields) ?? 'When its condition matches');
    const target = arm.loop_to ? findNode(all, arm.loop_to)?.node : null;
    const back = target && target.type !== 'branch' ? target.name || STEP_META[target.type].label : null;

    return (
        <span className="process-summary__path">
            <span className="process-summary__when">
                {arm.name && !last ? `${arm.name}: ` : ''}
                {when}
            </span>
            {arm.nodes.length > 0 ? (
                <StepList nodes={arm.nodes} all={all} names={names} fields={fields} />
            ) : (
                <span className="process-summary__who">No steps on this path.</span>
            )}
            {arm.loop && <span className="process-summary__who">Repeats while this still matches.</span>}
            {back && <span className="process-summary__who">Then goes back to {back}.</span>}
        </span>
    );
}

function Step({ node, names, fields }: { node: StepNode; names: Record<string, string>; fields: FieldElement[] }) {
    const meta = STEP_META[node.type];

    return (
        <li className="process-summary__item">
            <span className={clsx(tagClass(meta.hue), 'process-summary__icon')} aria-hidden="true">
                <i className={`mdi ${meta.icon}`} />
            </span>
            <span className="process-summary__text">
                <span className="process-summary__name">{node.name || meta.label}</span>
                <span className="process-summary__who">{whoTakes(node, names, fields)}</span>
            </span>
        </li>
    );
}

function people(ids: number[] = [], names: Record<string, string>): string {
    const list = ids.map((id) => names[String(id)]).filter(Boolean);
    if (list.length === 0) return 'Someone';
    if (list.length <= 3) return list.join(', ');

    return `${list.slice(0, 3).join(', ')} and ${list.length - 3} more`;
}

/** "Nur Aisyah approves", "Whoever is picked in “Supervisor” fills in their part"… */
function whoTakes(node: StepNode, names: Record<string, string>, fields: FieldElement[]): string {
    switch (node.type) {
        case 'approval': {
            const count = node.approver_ids.length;
            if (count > 1) {
                return `${people(node.approver_ids, names)}: ${node.approval_mode === 'all' ? 'everyone approves' : 'any one approves'}`;
            }
            return `${people(node.approver_ids, names)} approves or rejects`;
        }
        case 'fill': {
            if (node.assignee_mode === 'runtime') return 'Someone picked when it gets here fills in their part';
            if (node.assignee_mode === 'field') {
                const field = fields.find((candidate) => candidate.id === node.assignee_field);
                return field?.label
                    ? `Whoever is picked in “${field.label}” fills in their part`
                    : 'Whoever is picked in a Person field fills in their part';
            }
            return `${people(node.assignee_ids, names)} fill${node.assignee_ids.length === 1 ? 's' : ''} in their part`;
        }
        case 'cc':
            return `${people(node.user_ids, names)} can read it. Nothing waits on them`;
    }
}
