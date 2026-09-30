import { router } from '@inertiajs/react';
import { useState } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import { confirm, promptText, promptWithFields } from '@/lib/dialogs';
import type { TaskActionFlags, TaskFilters } from '@/types/tasks';

type ActionKey = 'accept' | 'done' | 'verify' | 'fallback' | 'complete' | 'reject' | 'kiv';

interface StatusAction {
    key: ActionKey;
    label: string;
    route: string;
    flag: keyof TaskActionFlags;
    /** The comment prompt's title; accept only asks for confirmation. */
    prompt?: string;
}

const ACTIONS: StatusAction[] = [
    { key: 'accept', label: 'Accept', route: 'tasks.accept', flag: 'can_accept_task' },
    {
        key: 'done',
        label: 'Done',
        route: 'tasks.done',
        flag: 'can_done_task',
        prompt: 'Please provide below information for checker to verify your task.',
    },
    {
        key: 'verify',
        label: 'Verified',
        route: 'tasks.verified',
        flag: 'can_verify_task',
        prompt: 'Please enter your comment to mark this task as verified.',
    },
    {
        key: 'fallback',
        label: 'Fallback',
        route: 'tasks.fallback',
        flag: 'can_fallback_task',
        prompt: 'Please enter your comment to mark this task as fallback.',
    },
    {
        key: 'complete',
        label: 'Complete',
        route: 'tasks.completed',
        flag: 'can_complete_task',
        prompt: 'Please enter your comment to mark this task as complete.',
    },
    {
        key: 'reject',
        label: 'Reject',
        route: 'tasks.rejected',
        flag: 'can_reject_task',
        prompt: 'Please enter your reason to mark this task as rejected.',
    },
    {
        key: 'kiv',
        label: 'Keep In View',
        route: 'tasks.kiv',
        flag: 'can_kiv_task',
        prompt: 'Please enter your reason to mark this task as KIV.',
    },
];

const COMMENT_REQUIRED = 'Please enter your comment to proceed!';
const MAX_COMMENT = 500;

/** What the user enters for an action, or null when they back out. */
async function askFor(action: StatusAction): Promise<Record<string, string> | null> {
    if (action.key === 'accept') {
        return (await confirm({ title: 'Please confirm to accept this task.' })) ? {} : null;
    }

    if (action.key === 'done') {
        const answer = await promptWithFields({
            title: action.prompt ?? '',
            fields: [
                { name: 'invoice_no', label: 'Invoice No:', maxLength: 30 },
                { name: 'sales_amt', label: 'Sales Amount:', type: 'number', maxLength: 14 },
            ],
            inputPlaceholder: 'Enter your comment here.',
            confirmText: 'Send',
            required: 'Please enter your comment for checker to verify your task!',
            maxLength: MAX_COMMENT,
        });
        return answer && { special_remark: answer.text, ...answer.values };
    }

    const comment = await promptText({
        title: action.prompt ?? '',
        inputType: 'textarea',
        confirmText: 'Send',
        required: COMMENT_REQUIRED,
        maxLength: MAX_COMMENT,
    });
    return comment === null ? null : { special_remark: comment };
}

interface TaskStatusMenuProps {
    taskId: number;
    actions: TaskActionFlags;
    /** The list's filters, so the list opens the way it was left. */
    filters: TaskFilters;
}

/** The ⋮ menu of status changes the signed-in user may make on a task. */
export default function TaskStatusMenu({ taskId, actions, filters }: TaskStatusMenuProps) {
    const [busy, setBusy] = useState(false);
    const available = ACTIONS.filter((action) => actions[action.flag]);

    if (available.length === 0) {
        return null;
    }

    const run = async (action: StatusAction) => {
        const input = await askFor(action);
        if (input === null) return;

        router.post(
            route(action.route),
            { ...filters, ...input, task_id: taskId },
            { onStart: () => setBusy(true), onFinish: () => setBusy(false) },
        );
    };

    return (
        <Dropdown>
            <Dropdown.Toggle variant="light" className="custom-button-shadow" disabled={busy} aria-label="Task actions">
                <i className="fas fa-ellipsis-v me-1" /> Actions
            </Dropdown.Toggle>
            <Dropdown.Menu className="task-status-menu">
                {available.map((action) => (
                    <Dropdown.Item key={action.key} as="button" type="button" onClick={() => run(action)}>
                        {action.label}
                    </Dropdown.Item>
                ))}
            </Dropdown.Menu>
        </Dropdown>
    );
}
