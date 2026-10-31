import { router } from '@inertiajs/react';
import { useRef, useState, type FormEvent } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import Field from '@/Components/form/Field';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import Dialog from '@/Components/surface/Dialog';
import type { TaskActionFlags, TaskFilters } from '@/types/tasks';
import type { TaskPeopleNames } from './taskPeople';

type ActionKey = 'accept' | 'done' | 'verify' | 'complete' | 'fallback' | 'reject' | 'kiv';

interface StatusAction {
    key: ActionKey;
    /** The button and the dialog's confirm button. */
    label: string;
    route: string;
    flag: keyof TaskActionFlags;
    icon: string;
    tone: 'good' | 'serious' | 'critical' | 'neutral';
    title: string;
    /** What happens next, in the dialog. */
    text: (names: TaskPeopleNames) => string;
    /** The comment box's label; accepting asks for nothing. */
    comment?: string;
    danger?: boolean;
}

/** The steps along the way, in order; the first one this person may take is the page's main button. */
const FORWARD: StatusAction[] = [
    {
        key: 'accept',
        label: 'Accept task',
        route: 'tasks.accept',
        flag: 'can_accept_task',
        icon: 'mdi-play',
        tone: 'neutral',
        title: 'Accept this task?',
        text: () => 'It moves to In progress, and you can start logging follow-ups.',
    },
    {
        key: 'done',
        label: 'Mark as done',
        route: 'tasks.done',
        flag: 'can_done_task',
        icon: 'mdi-check',
        tone: 'good',
        title: 'Mark this task as done?',
        text: ({ checker }) => `${checker ?? 'The checker'} checks it next. You can still log follow-ups.`,
        comment: 'Note for the checker',
    },
    {
        key: 'verify',
        label: 'Verify',
        route: 'tasks.verified',
        flag: 'can_verify_task',
        icon: 'mdi-check-decagram-outline',
        tone: 'good',
        title: 'Verify this task?',
        text: ({ owners }) => `It moves to Verified, and ${owners ?? 'an owner'} completes it.`,
        comment: 'Comment',
    },
    {
        key: 'complete',
        label: 'Complete',
        route: 'tasks.completed',
        flag: 'can_complete_task',
        icon: 'mdi-flag-checkered',
        tone: 'good',
        title: 'Complete this task?',
        text: () => 'It moves to Completed and leaves the open list.',
        comment: 'Comment',
    },
];

/** The other ways a task can go, under More. */
const ASIDE: StatusAction[] = [
    {
        key: 'fallback',
        label: 'Send back',
        route: 'tasks.fallback',
        flag: 'can_fallback_task',
        icon: 'mdi-undo-variant',
        tone: 'serious',
        title: 'Send this task back?',
        text: ({ assignee }) => `It goes back to In progress for ${assignee ?? 'the person assigned'}.`,
        comment: 'What still needs doing',
    },
    {
        key: 'kiv',
        label: 'Keep in view',
        route: 'tasks.kiv',
        flag: 'can_kiv_task',
        icon: 'mdi-eye-outline',
        tone: 'serious',
        title: 'Keep this task in view?',
        text: () => 'It leaves the open list until someone reactivates it from Edit task.',
        comment: 'Why it is kept in view',
    },
    {
        key: 'reject',
        label: 'Reject',
        route: 'tasks.rejected',
        flag: 'can_reject_task',
        icon: 'mdi-close-circle-outline',
        tone: 'critical',
        title: 'Reject this task?',
        text: () => 'It moves to Rejected and leaves the open list.',
        comment: 'Why it is rejected',
        danger: true,
    },
];

const COMMENT_MAX = 500;

/** The step the signed-in user can take next, if any (the page's main button). */
export function nextAction(actions: TaskActionFlags): { key: ActionKey; label: string } | null {
    const action = FORWARD.find((candidate) => actions[candidate.flag]);
    return action ? { key: action.key, label: action.label } : null;
}

interface TaskActionsProps {
    taskId: number;
    actions: TaskActionFlags;
    names: TaskPeopleNames;
    /** The list's filters, so the list opens the way it was left. */
    filters: TaskFilters;
}

/**
 * The status changes the signed-in user may make on a task: the next step
 * along the way as the main button, the rest under More. Each opens a dialog
 * that says what happens and who acts next.
 */
export default function TaskActions({ taskId, actions, names, filters }: TaskActionsProps) {
    const available = [...FORWARD, ...ASIDE].filter((action) => actions[action.flag]);
    const main = FORWARD.find((action) => actions[action.flag]) ?? null;
    const others = available.filter((action) => action !== main);

    const [open, setOpen] = useState<StatusAction | null>(null);
    // The dialog keeps its content while it animates closed.
    const shown = useRef<StatusAction | null>(null);
    if (open) shown.current = open;

    if (available.length === 0) {
        return null;
    }

    return (
        <>
            {others.length > 0 && (
                <Dropdown align="end">
                    <Dropdown.Toggle as="button" type="button" bsPrefix="rd-btn rd-btn--lg">
                        {main ? 'More' : 'Change status'}
                        <i className="mdi mdi-chevron-down rd-nav__chevron" aria-hidden="true" />
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="rd-menu task-status-menu">
                        {others.map((action) => (
                            <Dropdown.Item
                                key={action.key}
                                as="button"
                                type="button"
                                className={action.danger ? 'is-danger' : undefined}
                                onClick={() => setOpen(action)}
                            >
                                <i className={`mdi ${action.icon}`} aria-hidden="true" />
                                {action.label}
                            </Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </Dropdown>
            )}
            {main && (
                <button type="button" className="rd-btn rd-btn--primary rd-btn--lg" onClick={() => setOpen(main)}>
                    <i className={`mdi ${main.icon}`} aria-hidden="true" />
                    {main.label}
                </button>
            )}

            {shown.current && (
                <StatusDialog
                    key={shown.current.key}
                    action={shown.current}
                    show={open !== null}
                    names={names}
                    taskId={taskId}
                    filters={filters}
                    onClose={() => setOpen(null)}
                />
            )}
        </>
    );
}

interface StatusDialogProps {
    action: StatusAction;
    show: boolean;
    names: TaskPeopleNames;
    taskId: number;
    filters: TaskFilters;
    onClose: () => void;
}

function StatusDialog({ action, show, names, taskId, filters, onClose }: StatusDialogProps) {
    const [comment, setComment] = useState('');
    const [invoice, setInvoice] = useState('');
    const [sales, setSales] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [sending, setSending] = useState(false);
    const commentRef = useRef<HTMLTextAreaElement>(null);
    const confirmRef = useRef<HTMLButtonElement>(null);
    const done = action.key === 'done';

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (action.comment && comment.trim() === '') {
            setError('Add a few words; they are kept with the task’s history.');
            commentRef.current?.focus();
            return;
        }

        router.post(
            route(action.route),
            {
                ...filters,
                task_id: taskId,
                ...(action.comment ? { special_remark: comment.trim() } : {}),
                // The server reads both keys whenever a task is marked done.
                ...(done ? { invoice_no: invoice.trim(), sales_amt: sales.trim() } : {}),
            },
            {
                onStart: () => setSending(true),
                onFinish: () => setSending(false),
                onSuccess: onClose,
            },
        );
    };

    return (
        <Dialog
            show={show}
            onHide={onClose}
            onSubmit={submit}
            onEntered={() => (action.comment ? commentRef : confirmRef).current?.focus()}
            title={action.title}
            text={action.text(names)}
            icon={action.icon}
            tone={action.tone}
            footer={
                <>
                    <button type="button" className="rd-btn rd-btn--quiet" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        ref={confirmRef}
                        type="submit"
                        className={action.danger ? 'rd-btn rd-btn--danger' : 'rd-btn rd-btn--primary'}
                        disabled={sending}
                    >
                        {sending && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                        {action.label}
                    </button>
                </>
            }
        >
            {done && (
                <div className="task-status-dialog__row">
                    <Field
                        label={
                            <>
                                Invoice number <span className="rd-muted fw-normal">Optional</span>
                            </>
                        }
                        htmlFor="status-invoice"
                    >
                        <TextInput
                            id="status-invoice"
                            large
                            className="rd-input--mono"
                            maxLength={30}
                            value={invoice}
                            onChange={(event) => setInvoice(event.target.value)}
                        />
                    </Field>
                    <Field
                        label={
                            <>
                                Sales amount <span className="rd-muted fw-normal">Optional</span>
                            </>
                        }
                        htmlFor="status-sales"
                    >
                        <div className="rd-affix rd-affix--full">
                            <span className="rd-affix__start" aria-hidden="true">
                                RM
                            </span>
                            <input
                                id="status-sales"
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step="0.01"
                                value={sales}
                                onChange={(event) => setSales(event.target.value)}
                            />
                        </div>
                    </Field>
                </div>
            )}
            {action.comment && (
                <Field label={action.comment} htmlFor="status-comment" required error={error}>
                    <TextArea
                        id="status-comment"
                        ref={commentRef}
                        rows={4}
                        maxLength={COMMENT_MAX}
                        value={comment}
                        onChange={(event) => {
                            setComment(event.target.value);
                            if (error) setError(undefined);
                        }}
                    />
                    <span className="rd-form__counter">
                        {comment.length} / {COMMENT_MAX}
                    </span>
                </Field>
            )}
        </Dialog>
    );
}
