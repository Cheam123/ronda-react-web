import type {
    BranchArm,
    BranchNode,
    ConditionSchema,
    FieldElement,
    ProcessDefinition,
    ProcessNode,
    StepNode,
} from '@/types/forms';
import { conditionCount } from './conditions';
import { uid } from './schema';

/**
 * The builder's "Process Design" logic: making steps, finding them in the
 * tree, and the checks FormProcessService::validateDefinition() also runs, so
 * a flow that would be refused is flagged before it is sent.
 */

export type StepType = StepNode['type'];

export const STEP_META: Record<StepType, { label: string; icon: string; color: string; role: string; hint: string }> = {
    fill: {
        label: 'Handler',
        icon: 'mdi-account-edit-outline',
        color: '#7a56d1',
        role: 'Handler',
        hint: 'User fills their part of the form — no approval',
    },
    approval: {
        label: 'Approval',
        icon: 'mdi-account-check-outline',
        color: '#e8871e',
        role: 'Approver',
        hint: 'Approve or reject the submission',
    },
    cc: {
        label: 'CC',
        icon: 'mdi-email-outline',
        color: '#3370ff',
        role: 'CC',
        hint: 'Give someone read access',
    },
};

export const BRANCH_META = { label: 'Conditional Branch', color: '#22a06b', hint: 'Different paths based on answers' };

const emptyPermissions = () => ({ default: 'read' as const, overrides: {} });

export function newNode(type: StepType | 'branch'): ProcessNode {
    switch (type) {
        case 'approval':
            return {
                id: uid('nd'),
                type,
                name: 'Approval',
                approver_ids: [],
                approval_mode: 'any',
                field_permissions: emptyPermissions(),
            };
        case 'fill':
            return { id: uid('nd'), type, name: 'Handler', assignee_ids: [], field_permissions: emptyPermissions() };
        case 'cc':
            return { id: uid('nd'), type, name: 'CC', user_ids: [], field_permissions: emptyPermissions() };
        default:
            return {
                id: uid('nd'),
                type: 'branch',
                branches: [
                    { id: uid('br'), name: 'Conditional branch 1', when: { logic: 'or', groups: [] }, nodes: [] },
                    { id: uid('br'), name: 'Else', when: null, nodes: [] },
                ],
            };
    }
}

export function newArm(position: number): BranchArm {
    return { id: uid('br'), name: `Conditional branch ${position}`, when: { logic: 'or', groups: [] }, nodes: [] };
}

/** The ids a step goes to (approvers, handlers or recipients). */
export function participantIds(node: StepNode): number[] {
    if (node.type === 'approval') return node.approver_ids ?? [];
    if (node.type === 'fill') return node.assignee_ids ?? [];
    return node.user_ids ?? [];
}

export interface Found {
    list: ProcessNode[];
    index: number;
    node: ProcessNode;
}

/** A node and the list it sits in, anywhere in the tree. */
export function findNode(nodes: ProcessNode[], id: string): Found | null {
    for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        if (node.id === id) return { list: nodes, index, node };
        if (node.type === 'branch') {
            for (const arm of node.branches) {
                const found = findNode(arm.nodes, id);
                if (found) return found;
            }
        }
    }
    return null;
}

export function findArm(
    nodes: ProcessNode[],
    armId: string,
): { branch: BranchNode; arm: BranchArm; index: number } | null {
    for (const node of nodes) {
        if (node.type !== 'branch') continue;
        const index = node.branches.findIndex((arm) => arm.id === armId);
        if (index !== -1) return { branch: node, arm: node.branches[index], index };
    }
    return null;
}

/**
 * Change the tree through a copy: `edit` mutates the draft freely and the
 * caller gets a new tree back, so React sees the change.
 */
export function editTree(nodes: ProcessNode[], edit: (draft: ProcessNode[]) => void): ProcessNode[] {
    const draft = structuredClone(nodes);
    edit(draft);
    return draft;
}

/* ----- validation (mirrors FormProcessService) ----- */

function hasBlockingStep(nodes: ProcessNode[]): boolean {
    return nodes.some(
        (node) =>
            node.type === 'approval' ||
            node.type === 'fill' ||
            (node.type === 'branch' && node.branches.some((arm) => hasBlockingStep(arm.nodes))),
    );
}

/** A loop can only end if a Handler in the repeated range can fill a field its condition checks. */
function rangeCanChangeCondition(range: ProcessNode[], when: ConditionSchema | null, fields: FieldElement[]): boolean {
    const fieldIds = (when?.groups ?? [])
        .flatMap((group) => group.conditions.map((condition) => condition.field))
        .filter(Boolean);
    if (fieldIds.length === 0) return true;

    const sectionOf = Object.fromEntries(
        fields.filter((field) => field.group_id).map((field) => [field.id, field.group_id]),
    );

    const check = (nodes: ProcessNode[]): boolean =>
        nodes.some((node) => {
            if (node.type === 'branch') return node.branches.some((arm) => check(arm.nodes));
            if (node.type !== 'fill') return false;
            const overrides = node.field_permissions?.overrides ?? {};
            return fieldIds.some(
                (id) => overrides[id] === 'edit' || (sectionOf[id] && overrides[sectionOf[id] as string] === 'edit'),
            );
        });

    return check(range);
}

export interface ProcessProblems {
    /** Messages in the order found. */
    errors: string[];
    /** node id -> first message about it, to outline that card. */
    badNodes: Record<string, string>;
}

export function collectProblems(nodes: ProcessNode[], fields: FieldElement[]): ProcessProblems {
    const errors: string[] = [];
    const badNodes: Record<string, string> = {};
    const fail = (nodeId: string, message: string) => {
        errors.push(message);
        if (!badNodes[nodeId]) badNodes[nodeId] = message;
    };

    const walk = (list: ProcessNode[]) => {
        list.forEach((node, nodeIndex) => {
            if (node.type === 'approval') {
                if (!node.name?.trim()) fail(node.id, 'Every approval step needs a name.');
                if (!node.approver_ids?.length)
                    fail(node.id, `Approval step "${node.name || '?'}" needs at least one approver.`);
            } else if (node.type === 'fill') {
                const name = node.name || '?';
                if (!node.name?.trim()) fail(node.id, 'Every handler step needs a name.');
                const mode = node.assignee_mode ?? 'fixed';
                if (mode === 'fixed' && !node.assignee_ids?.length)
                    fail(node.id, `Handler step "${name}" needs at least one handler.`);
                if (mode === 'field' && !node.assignee_field) {
                    fail(node.id, `Handler step "${name}" needs a Person field to take its handler from.`);
                }
                if (mode === 'field' && node.assignee_field) {
                    // An optional person field can reach the step empty.
                    const source = fields.find((field) => field.id === node.assignee_field);
                    if (source && !source.mandatory) {
                        fail(
                            node.id,
                            `Handler step "${name}" takes its handler from "${source.label || node.assignee_field}". Set that field to Required in Form Design so it must always be answered.`,
                        );
                    }
                }
                const overrides = node.field_permissions?.overrides ?? {};
                if (!Object.values(overrides).includes('edit')) {
                    fail(
                        node.id,
                        `Handler step "${name}" needs at least one field marked as "Fill" in Form Permissions.`,
                    );
                }
            } else if (node.type === 'cc') {
                if (!node.user_ids?.length)
                    fail(node.id, `CC step "${node.name || '?'}" needs at least one recipient.`);
            } else if (node.type === 'branch') {
                node.branches.forEach((arm, armIndex) => {
                    const isLast = armIndex === node.branches.length - 1;
                    const name = arm.name || '?';

                    if (!isLast && conditionCount(arm.when) === 0) fail(node.id, `Branch "${name}" needs a condition.`);

                    if (!isLast && arm.loop_to) {
                        // Rewinding: the range must hold something that blocks and something that can change the condition.
                        const target = list.findIndex((step) => step.id === arm.loop_to);
                        if (target === -1 || target >= nodeIndex) {
                            fail(node.id, `Branch "${name}" must repeat from a step that comes before it.`);
                        } else {
                            const range = list.slice(target, nodeIndex);
                            if (!hasBlockingStep(range)) {
                                fail(node.id, `Branch "${name}" repeats a range with no Handler or Approval step.`);
                            } else if (!rangeCanChangeCondition(range, arm.when, fields)) {
                                fail(
                                    node.id,
                                    `Branch "${name}" repeats steps that cannot fill the field(s) its condition checks — otherwise the loop can never end.`,
                                );
                            }
                        }
                    } else if (!isLast && arm.loop) {
                        if (!hasBlockingStep(arm.nodes)) {
                            fail(
                                node.id,
                                `Loop branch "${name}" needs at least one Handler or Approval step inside it.`,
                            );
                        } else if (!rangeCanChangeCondition(arm.nodes, arm.when, fields)) {
                            fail(
                                node.id,
                                `Loop branch "${name}" needs a Handler step that can fill the field(s) its condition checks — otherwise the loop can never end.`,
                            );
                        }
                    }

                    walk(arm.nodes);
                });
            }
        });
    };

    walk(nodes);
    return { errors, badNodes };
}

/** The definition the server stores, with runtime-only settings stripped. */
export function serializeProcess(nodes: ProcessNode[]): ProcessDefinition {
    const clean = (list: ProcessNode[]) =>
        list.forEach((node) => {
            if (node.type === 'fill') {
                // Resolved at runtime, never kept on the definition.
                if (node.assignee_mode && node.assignee_mode !== 'fixed') node.assignee_ids = [];
                if (node.assignee_mode !== 'field') delete node.assignee_field;
            }
            if (node.type !== 'branch') return;

            node.branches.forEach((arm, index) => {
                const isLast = index === node.branches.length - 1;
                if (isLast) {
                    arm.when = null;
                    delete arm.loop;
                    delete arm.loop_to;
                }
                if (arm.loop && arm.loop_to)
                    delete arm.loop_to; // mutually exclusive
                else if (arm.when && (!arm.when.groups || arm.when.groups.length === 0))
                    arm.when = { logic: 'or', groups: [] };
                clean(arm.nodes);
            });
        });

    const copy = structuredClone(nodes);
    clean(copy);
    return { process_version: 1, nodes: copy };
}
