import { Link, router } from '@inertiajs/react';
import type { FormEvent } from 'react';
import SearchSelect from '@/Components/form/SearchSelect';
import Initials from '@/Components/surface/Initials';
import PageHeader from '@/Components/surface/PageHeader';
import Segmented from '@/Components/surface/Segmented';
import SurfacePage from '@/Components/surface/SurfacePage';
import { useFilters } from '@/hooks/useFilters';
import AppLayout from '@/Layouts/AppLayout';
import { confirm, promptText } from '@/lib/dialogs';
import { pluralize } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { tagClass, teamHue } from '@/lib/tags';
import type { QueryParams, SelectOption } from '@/types';
import type { User } from './types';

/** The status filter: users.status 1 (active), 2 (inactive), or both. */
type Status = '1' | '2' | 'all';

interface UsersIndexProps {
    users: User[];
    /** What the other filters leave, per status. */
    counts: { active: number; inactive: number; all: number };
    filters: QueryParams;
    userTypes: SelectOption[];
}

export default function UsersIndex({ users, counts, filters, userTypes }: UsersIndexProps) {
    const { values, set, apply, reset } = useFilters(route('users.index'), {
        active: filters.active ?? '1',
        user_type: filters.user_type ?? '',
        search: filters.search ?? '',
    });

    const choose = (key: keyof typeof values, value: string) => {
        set(key, value);
        apply({ [key]: value });
    };

    const search = (event: FormEvent) => {
        event.preventDefault();
        apply();
    };

    const resetPassword = async (user: User) => {
        const password = await promptText({
            title: 'Reset Password !',
            text: user.name,
            confirmText: 'Send',
            minLength: 6,
            maxLength: 12,
            required: 'Please enter new password to proceed!',
        });
        if (password) {
            router.post(route('users.resetpassword'), { id: user.id, pwd: password }, { preserveScroll: true });
        }
    };

    const deleteUser = async (user: User) => {
        if (await confirm({ title: 'Please confirm to proceed on the deletion!', text: user.name, danger: true })) {
            router.post(route('users.delete'), { id: user.id }, { preserveScroll: true });
        }
    };

    const filtered = Boolean(filters.search || filters.user_type);

    return (
        <AppLayout title="Users">
            <SurfacePage>
                <PageHeader crumbs={[{ label: 'Admin' }, { label: 'Users' }]} title="Users" />

                <section className="rd-panel rd-panel--flush rd-list rd-list--flush" aria-labelledby="users-title">
                    <div className="rd-list__head">
                        <div className="rd-list__heading">
                            <h2 id="users-title" className="rd-list__title">
                                All users
                            </h2>
                            <span className="rd-count rd-count--label">{pluralize(users.length, 'user')}</span>
                        </div>
                        <div className="rd-list__actions">
                            <Segmented<Status>
                                label="Status"
                                value={values.active as Status}
                                onChange={(value) => choose('active', value)}
                                options={[
                                    { value: '1', label: `Active ${counts.active}` },
                                    { value: '2', label: `Inactive ${counts.inactive}` },
                                    { value: 'all', label: `All ${counts.all}` },
                                ]}
                            />
                            <form role="search" onSubmit={search}>
                                <label className="rd-search users-search">
                                    <i className="mdi mdi-magnify" aria-hidden="true" />
                                    <input
                                        type="search"
                                        className="rd-input"
                                        aria-label="Search users"
                                        placeholder="Name, email or mobile"
                                        maxLength={255}
                                        value={values.search}
                                        onChange={(event) => set('search', event.target.value)}
                                    />
                                </label>
                            </form>
                            <SearchSelect
                                compact
                                ariaLabel="User type"
                                options={[{ value: '', label: 'All user types' }, ...userTypes]}
                                clearable={false}
                                searchable={false}
                                value={values.user_type}
                                onChange={(value) => choose('user_type', value)}
                            />
                            <Link href={route('users.create')} className="rd-btn rd-btn--primary">
                                <i className="mdi mdi-plus" aria-hidden="true" />
                                Add user
                            </Link>
                        </div>
                    </div>

                    <div className="rd-scroll">
                        <table className="rd-table rd-table--flush rd-table--striped users-table">
                            <thead>
                                <tr>
                                    <th scope="col" aria-sort="ascending">
                                        <span className="rd-sorted">
                                            Name
                                            <i className="mdi mdi-arrow-down" aria-hidden="true" />
                                        </span>
                                    </th>
                                    <th scope="col">Status</th>
                                    <th scope="col">Email address</th>
                                    <th scope="col">Mobile</th>
                                    <th scope="col">User type</th>
                                    <th scope="col">Team</th>
                                    <th scope="col" className="rd-col-actions">
                                        <span className="visually-hidden">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <UserRow
                                        key={user.id}
                                        user={user}
                                        onResetPassword={() => resetPassword(user)}
                                        onDelete={() => deleteUser(user)}
                                    />
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="rd-list__empty">
                                            No users match.{' '}
                                            {filtered && (
                                                <button
                                                    type="button"
                                                    className="btn btn-link p-0 align-baseline"
                                                    onClick={reset}
                                                >
                                                    Clear the filters
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </SurfacePage>
        </AppLayout>
    );
}

interface UserRowProps {
    user: User;
    onResetPassword: () => void;
    onDelete: () => void;
}

function UserRow({ user, onResetPassword, onDelete }: UserRowProps) {
    const active = user.status === 1;

    return (
        <tr>
            <td>
                <div className="rd-person">
                    <Initials name={user.name} colorKey={user.id} size="lg" />
                    <span className="rd-person__text">
                        <Link href={route('users.view', user.id)} className="rd-person__name">
                            {user.name}
                        </Link>
                        {user.username && <span className="rd-person__sub rd-mono">{user.username}</span>}
                    </span>
                </div>
            </td>
            <td>
                {active ? (
                    <span className="rd-chip rd-chip--good">
                        <span className="rd-dot" />
                        Active
                    </span>
                ) : (
                    <span className="rd-chip">
                        <span className="rd-dot" />
                        Inactive
                    </span>
                )}
            </td>
            <td className="users-table__soft">{user.email}</td>
            <td className="rd-num text-nowrap users-table__soft">
                {user.mobile ? formatPhone(user.mobile) : <span className="rd-muted">—</span>}
            </td>
            <td>{user.type_label}</td>
            <td>
                {user.team_label ? (
                    <span className={tagClass(teamHue(user.team))}>{user.team_label}</span>
                ) : (
                    <span className="rd-muted">—</span>
                )}
            </td>
            <td className="rd-col-actions">
                <div className="rd-actions">
                    <button
                        type="button"
                        className="rd-btn rd-btn--icon"
                        aria-label={`Reset the password for ${user.name}`}
                        title="Reset password"
                        onClick={onResetPassword}
                    >
                        <i className="mdi mdi-key-outline" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className="rd-btn rd-btn--icon rd-btn--icon-danger"
                        aria-label={`Delete ${user.name}`}
                        title="Delete"
                        onClick={onDelete}
                    >
                        <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
                    </button>
                    <Link
                        href={route('users.edit', user.id)}
                        className="rd-btn rd-btn--icon"
                        aria-label={`Edit ${user.name}`}
                        title="Edit"
                    >
                        <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                    </Link>
                </div>
            </td>
        </tr>
    );
}
