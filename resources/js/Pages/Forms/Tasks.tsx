import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import { useState } from 'react';
import Initials from '@/Components/surface/Initials';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import { STEP_META } from '@/lib/forms/process';
import { tagClass } from '@/lib/tags';

interface FormTask {
    submission_id: number;
    record_id: number;
    record_title: string;
    record_ref: string;
    form_name: string;
    submitted_by: string;
    submitted_at: string | null;
    submitted_ago: string | null;
    stage_name: string | null;
    stage_type: 'fill' | 'approval' | string | null;
}

type Tab = 'all' | 'approval' | 'fill';

/** My tasks: approvals waiting on the signed-in user, and parts of forms for them to fill in. */
export default function FormTasks({ tasks }: { tasks: FormTask[] }) {
    const [tab, setTab] = useState<Tab>('all');
    const isFill = (task: FormTask) => task.stage_type === 'fill';
    const shown = tasks.filter((task) => tab === 'all' || (tab === 'fill' ? isFill(task) : !isFill(task)));

    const tabs: { key: Tab; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: tasks.length },
        { key: 'approval', label: 'To approve', count: tasks.filter((task) => !isFill(task)).length },
        { key: 'fill', label: 'To fill in', count: tasks.filter(isFill).length },
    ];

    return (
        <AppLayout title="My tasks">
            <SurfacePage>
                <PageHeader
                    crumbs={[{ label: 'Home', href: '/index' }, { label: 'My tasks' }]}
                    title="My tasks"
                    lede="Forms waiting on you: approvals to give and parts to fill in."
                />

                <section className="rd-panel rd-list records-list" aria-label="Waiting on you">
                    <nav className="rd-tabs records-list__tabs" aria-label="Kind of task">
                        {tabs.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                className={clsx('rd-tabs__tab', tab === item.key && 'is-active')}
                                aria-pressed={tab === item.key}
                                onClick={() => setTab(item.key)}
                            >
                                {item.label} <span className="rd-count">{item.count}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="rd-scroll">
                        <table className="rd-table rd-table--band records-table">
                            <thead>
                                <tr>
                                    <th scope="col">Record</th>
                                    <th scope="col">Submitted</th>
                                    <th scope="col">Waiting for you to</th>
                                    <th scope="col" className="rd-col-actions">
                                        <span className="visually-hidden">Open</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map((task) => {
                                    const fill = isFill(task);
                                    const meta = STEP_META[fill ? 'fill' : 'approval'];
                                    const href = route('form.records.show', task.record_id);

                                    return (
                                        <tr key={task.submission_id}>
                                            <td className="records-table__record">
                                                <Link href={href} className="records-table__title">
                                                    {task.record_title}
                                                </Link>
                                                <span className="records-table__sub">
                                                    <span className="rd-mono">{task.record_ref}</span>
                                                    {task.form_name}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="rd-person rd-person--sm">
                                                    <Initials name={task.submitted_by} size="sm" />
                                                    <span className="rd-person__text">
                                                        <span className="rd-person__name">{task.submitted_by}</span>
                                                        <span
                                                            className="rd-person__sub"
                                                            title={task.submitted_at ?? undefined}
                                                        >
                                                            {task.submitted_ago ?? task.submitted_at}
                                                        </span>
                                                    </span>
                                                </span>
                                            </td>
                                            <td>
                                                <span className={tagClass(meta.hue)}>
                                                    {fill ? 'Fill in' : 'Approve'}: {task.stage_name ?? meta.label}
                                                </span>
                                            </td>
                                            <td className="rd-col-actions">
                                                <Link href={href} className="rd-btn">
                                                    {fill ? 'Fill in' : 'Review'}
                                                    <i className="mdi mdi-arrow-right" aria-hidden="true" />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {shown.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="rd-list__empty">
                                            {tasks.length === 0 ? 'Nothing is waiting on you.' : 'None of this kind.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {tasks.length > 0 && (
                        <p className="rd-muted records-list__note">
                            When you finish one it leaves this list. The Form menu shows how many are waiting.
                        </p>
                    )}
                </section>
            </SurfacePage>
        </AppLayout>
    );
}
