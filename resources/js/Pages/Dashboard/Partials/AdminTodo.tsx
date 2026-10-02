import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { pluralize } from '@/lib/format';
import type { Ability } from '@/types';
import type { AdminSummary } from '../types';

interface TodoItem {
    key: string;
    icon: string;
    tone: 'brand' | 'serious' | 'neutral';
    title: string;
    detail: string;
    action: string;
    href: string;
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
    const { approvals, outlets, stale_products: stale, people } = summary;

    if (approvals.pending > 0 && can('form_admin')) {
        items.push({
            key: 'approvals',
            icon: 'mdi-file-check-outline',
            tone: 'serious',
            title: `${pluralize(approvals.pending, 'form submission')} awaiting approval`,
            detail: `Across ${pluralize(approvals.forms, 'form')}. The oldest has waited ${approvals.oldest_label}.`,
            action: 'Review',
            href: route('form.records.all', { status: 'pending' }),
        });
    }

    if (outlets.without_area > 0) {
        items.push({
            key: 'areas',
            icon: 'mdi-map-marker-outline',
            tone: 'brand',
            title: `${pluralize(outlets.without_area, 'outlet has', 'outlets have')} no IFE area`,
            detail: `${listNames(outlets.without_area_names, outlets.without_area)}. Their reports can't be grouped by area.`,
            action: 'Assign',
            href: route('lead.index'),
        });
    }

    if (stale.length > 0 && can('manage_product')) {
        items.push({
            key: 'stale',
            icon: 'mdi-package-variant-closed',
            tone: 'brand',
            title: `${pluralize(stale.length, 'product')} not ordered in 90 days`,
            detail: `${listNames(stale.slice(0, 2), stale.length)}. Still offered to reps and recommended to outlets.`,
            action: 'Review',
            href: route('product.index', { stale: 1, active: 'all' }),
        });
    }

    const unlinked = people.filter((person) => !person.telegram);
    if (unlinked.length > 0 && can('manage_user')) {
        items.push({
            key: 'telegram',
            icon: 'mdi-telegram',
            tone: 'neutral',
            title: `${pluralize(unlinked.length, 'user hasn’t', 'users haven’t')} linked Telegram`,
            detail: `${listNames(
                unlinked.slice(0, 2).map((person) => person.name),
                unlinked.length,
            )} won't get task alerts outside the app.`,
            action: 'View',
            href: route('users.index'),
        });
    }

    return items;
}

/** Things only an admin can sort out, most pressing first. */
export default function AdminTodo({ summary, className }: { summary: AdminSummary; className?: string }) {
    const { can } = useAuth();
    const items = todoItems(summary, can);

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
                            <Link href={item.href} className="dash-todo__action">
                                {item.action}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
