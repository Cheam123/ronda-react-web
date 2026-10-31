import clsx from 'clsx';
import type { TaskActionFlags } from '@/types/tasks';
import { nextAction } from './TaskActions';
import type { TaskPeopleNames } from './taskPeople';

/** The way a task normally goes, by status number (Tasks::getTaskStatus). */
const STEPS = [
    { status: 1, label: 'New' },
    { status: 2, label: 'In progress' },
    { status: 3, label: 'Done' },
    { status: 4, label: 'Verified' },
    { status: 5, label: 'Completed' },
];

/** Where the task is and who moves it on: "Next: you mark it as done, then Aina checks it." */
function nextLine(status: number, actions: TaskActionFlags, { assignee, checker, owners }: TaskPeopleNames): string {
    const mine = nextAction(actions) !== null;
    const person = assignee ?? 'the person assigned';

    switch (status) {
        case 1:
            return mine ? 'Next: you accept it, and it moves to In progress.' : `Waiting for ${person} to accept it.`;
        case 2:
            return mine
                ? `Next: you mark it as done, then ${checker ?? 'the checker'} checks it.`
                : `Waiting for ${person} to mark it as done.`;
        case 3:
            return mine
                ? `Next: you verify it, or send it back to ${person}.`
                : `Waiting for ${checker ?? 'the checker'} to verify it.`;
        case 4:
            return mine ? 'Next: you complete it.' : `Waiting for ${owners ?? 'an owner'} to complete it.`;
        case 5:
            return 'Completed. Nothing is left to do.';
        case 6:
            return 'Kept in view. It comes back to the open list from Edit task.';
        case 7:
            return 'Rejected.';
        default:
            return 'On hold.';
    }
}

interface TaskProgressProps {
    status: number;
    actions: TaskActionFlags;
    names: TaskPeopleNames;
}

/** The five steps of a task with this one marked, and a line on who acts next. */
export default function TaskProgress({ status, actions, names }: TaskProgressProps) {
    const onPath = STEPS.some((step) => step.status === status);

    return (
        <section className="rd-panel task-progress" aria-label="Where this task is">
            <ol className={clsx('task-progress__steps', !onPath && 'is-off-path')}>
                {STEPS.map((step) => {
                    const state = !onPath
                        ? 'ahead'
                        : step.status < status
                          ? 'past'
                          : step.status === status
                            ? 'now'
                            : 'ahead';

                    return (
                        <li
                            key={step.status}
                            className={`task-progress__step is-${state}`}
                            aria-current={state === 'now' ? 'step' : undefined}
                        >
                            <span className="task-progress__bar" aria-hidden="true" />
                            <span className="task-progress__label">
                                {step.label}
                                {state === 'past' && <span className="visually-hidden"> (done)</span>}
                                {state === 'now' && <span className="task-progress__now"> · now</span>}
                            </span>
                        </li>
                    );
                })}
            </ol>
            <p className="task-progress__next">{nextLine(status, actions, names)}</p>
        </section>
    );
}
