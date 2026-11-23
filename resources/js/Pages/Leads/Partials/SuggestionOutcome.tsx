import clsx from 'clsx';
import type { FeedbackStatus } from '@/types/leads';

const OUTCOMES: { status: FeedbackStatus; label: string; icon: string }[] = [
    { status: 'pitched', label: 'Pitched', icon: 'mdi-message-text-outline' },
    { status: 'accepted', label: 'Accepted', icon: 'mdi-check' },
    { status: 'declined', label: 'Declined', icon: 'mdi-close' },
];

/** What the rep did with one drink idea. A second tap on the chosen one takes it back. */
export function OutcomeButtons({
    name,
    status,
    busy,
    onPick,
}: {
    name: string;
    status: FeedbackStatus | undefined;
    busy: boolean;
    onPick: (status: FeedbackStatus | 'cleared') => void;
}) {
    return (
        <span className="lead-outcome" role="group" aria-label={`What happened with ${name}`}>
            {OUTCOMES.map((outcome) => {
                const chosen = status === outcome.status;

                return (
                    <button
                        key={outcome.status}
                        type="button"
                        className={clsx('lead-outcome__btn', chosen && `is-${outcome.status}`)}
                        aria-pressed={chosen}
                        disabled={busy}
                        onClick={() => onPick(chosen ? 'cleared' : outcome.status)}
                    >
                        <i className={`mdi ${outcome.icon}`} aria-hidden="true" />
                        {outcome.label}
                    </button>
                );
            })}
        </span>
    );
}

/**
 * Why it was declined, once it is: optional, one tap. The answer tells the
 * admin whether the price, a competitor or the fit was the problem.
 */
export function DeclineReasons({
    name,
    reasons,
    value,
    busy,
    onPick,
}: {
    name: string;
    reasons: Record<string, string>;
    value: string | undefined;
    busy: boolean;
    onPick: (reason: string) => void;
}) {
    return (
        <div className="drink-reason" role="group" aria-label={`Why ${name} was declined`}>
            <span className="drink-reason__label">Why? Optional.</span>
            {Object.entries(reasons).map(([key, label]) => (
                <button
                    key={key}
                    type="button"
                    className="rd-choice rd-choice--sm"
                    aria-pressed={value === key}
                    disabled={busy}
                    onClick={() => onPick(key)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
