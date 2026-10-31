import { Link, router } from '@inertiajs/react';
import clsx from 'clsx';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { pluralize } from '@/lib/format';
import type { Ability } from '@/types';
import type { AdminSummary } from '../types';

interface TodoItem {
    key: string;
    icon: string;
    tone: 'brand' | 'serious' | 'critical' | 'neutral';
    title: string;
    detail: string;
    /** A link to where it is sorted out, or `regenerate` for the round-up's button. */
    action?: { label: string; href: string } | 'regenerate';
}

/** "A, B and 1 more" */
function listNames(names: string[], total: number): string {
    const rest = total - names.length;
    if (names.length === 0) return '';
    if (rest > 0) return `${names.join(', ')} and ${rest} more`;
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function todoItems(summary: AdminSummary, can: (...abilities: Ability[]) => boolean): TodoItem[] {
    const items: TodoItem[] = [];
    const { approvals, outlets, stale_products: stale, users } = summary;

    // A missed job means something has stopped, so these come first.
    for (const job of summary.missed_jobs) {
        if (job.job === 'digest') {
            items.push({
                key: 'digest',
                icon: 'mdi-clock-alert-outline',
                tone: 'critical',
                title: job.last_label ? 'The Morning Round-Up didn’t run today' : 'The Morning Round-Up hasn’t run yet',
                detail: job.last_label
                    ? `It is due at ${job.schedule}. The last one is from ${job.last_label}, and managers see that one until a new one is written.`
                    : `It is due at ${job.schedule} each day, at the top of the managers’ dashboard.`,
                action: 'regenerate',
            });
        } else {
            items.push({
                key: 'recommendations',
                icon: 'mdi-lightbulb-outline',
                tone: 'critical',
                title: job.last_label
                    ? `Suggested orders haven’t refreshed since ${job.last_label}`
                    : 'Suggested orders haven’t been worked out yet',
                detail: `They refresh at ${job.schedule} each night. If the Morning Round-Up is missing too, the server’s scheduler has probably stopped.`,
            });
        }
    }

    if (approvals.pending > 0 && can('form_admin')) {
        items.push({
            key: 'approvals',
            icon: 'mdi-file-check-outline',
            tone: 'serious',
            title: `${pluralize(approvals.pending, 'form submission')} awaiting approval`,
            detail: `Across ${pluralize(approvals.forms, 'form')}. The oldest has waited ${approvals.oldest_label}.`,
            action: { label: 'Review', href: route('form.records.all', { status: 'pending' }) },
        });
    }

    if (outlets.without_area > 0) {
        items.push({
            key: 'areas',
            icon: 'mdi-map-marker-outline',
            tone: 'brand',
            title: `${pluralize(outlets.without_area, 'outlet has', 'outlets have')} no IFE area`,
            detail: `${listNames(outlets.without_area_names, outlets.without_area)}. Their reports can't be grouped by area.`,
            action: { label: 'Assign', href: route('lead.index', { ifearea: 'none' }) },
        });
    }

    if (stale.length > 0 && can('manage_product')) {
        items.push({
            key: 'stale',
            icon: 'mdi-package-variant-closed',
            tone: 'brand',
            title: `${pluralize(stale.length, 'product')} not ordered in 90 days`,
            detail: `${listNames(stale.slice(0, 2), stale.length)}. Still offered to reps and recommended to outlets.`,
            action: { label: 'Review', href: route('product.index', { stale: 1, active: 'all' }) },
        });
    }

    if (users.unlinked > 0 && can('manage_user')) {
        items.push({
            key: 'telegram',
            icon: 'mdi-telegram',
            tone: 'neutral',
            title: `${pluralize(users.unlinked, 'user hasn’t', 'users haven’t')} linked Telegram`,
            detail: `${listNames(users.unlinked_names, users.unlinked)} won't get task alerts outside the app.`,
            action: { label: 'View', href: route('users.index', { telegram: 'none' }) },
        });
    }

    return items;
}

/** Things only an admin can sort out, most pressing first. */
export default function AdminTodo({ summary, className }: { summary: AdminSummary; className?: string }) {
    const { can } = useAuth();
    const [regenerating, setRegenerating] = useState(false);
    const items = todoItems(summary, can);

    // The server sends admins to the team view afterwards, where the new round-up is.
    const regenerate = () => {
        router.post(
            route('dashboard.digest'),
            {},
            {
                onStart: () => setRegenerating(true),
                onFinish: () => setRegenerating(false),
            },
        );
    };

    return (
        <section className={clsx('rd-panel', className)} aria-labelledby="todo-title">
            <div className="rd-panel__head">
                <h2 id="todo-title" className="rd-panel__title">
                    Needs your attention
                </h2>
                {items.length > 0 && <span className="rd-chip rd-chip--dark">{items.length}</span>}
            </div>

            {items.length === 0 ? (
                <p className="rd-empty">
                    <i className="mdi mdi-check-circle-outline" aria-hidden="true" />
                    Nothing needs you right now.
                </p>
            ) : (
                <ul className="rd-rows dash-todo">
                    {items.map((item) => (
                        <li key={item.key}>
                            <span
                                className={clsx(
                                    'rd-icon rd-icon--lg',
                                    item.tone !== 'brand' && `rd-icon--${item.tone}`,
                                )}
                            >
                                <i className={`mdi ${item.icon}`} aria-hidden="true" />
                            </span>
                            <span className="dash-todo__text">
                                <span className="dash-todo__title">{item.title}</span>
                                <span className="dash-todo__detail">{item.detail}</span>
                            </span>
                            {item.action === 'regenerate' ? (
                                <button
                                    type="button"
                                    className="dash-todo__action"
                                    title="Write today's Morning Round-Up now from the latest figures"
                                    disabled={regenerating}
                                    onClick={regenerate}
                                >
                                    {regenerating && (
                                        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                                    )}
                                    {regenerating ? 'Writing…' : 'Regenerate'}
                                </button>
                            ) : (
                                item.action && (
                                    <Link href={item.action.href} className="dash-todo__action">
                                        {item.action.label}
                                    </Link>
                                )
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
