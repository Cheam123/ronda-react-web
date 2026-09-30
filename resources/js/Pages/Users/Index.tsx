import { Link, router } from '@inertiajs/react';
import Select from '@/Components/form/Select';
import TextInput from '@/Components/form/TextInput';
import Button, { ButtonLink } from '@/Components/ui/Button';
import Card from '@/Components/ui/Card';
import DataTable, { EmptyRow } from '@/Components/ui/DataTable';
import FilterPanel from '@/Components/ui/FilterPanel';
import { useFilters } from '@/hooks/useFilters';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import { confirm, promptText } from '@/lib/dialogs';
import { digitsOnly } from '@/lib/input';
import type { BreadcrumbProps, QueryParams, SelectOption } from '@/types';
import type { User } from './types';

const STATUS_OPTIONS: SelectOption[] = [
    { value: '1', label: 'Active' },
    { value: '2', label: 'Inactive' },
];

interface UsersIndexProps extends BreadcrumbProps {
    users: User[];
    filters: QueryParams;
    userTypes: SelectOption[];
}

export default function UsersIndex({ users, filters, userTypes, ...breadcrumb }: UsersIndexProps) {
    const { values, set, apply, reset } = useFilters(route('users.index'), {
        active: filters.active ?? '1',
        user_type: filters.user_type ?? '',
        name: filters.name ?? '',
        mobile: filters.mobile ?? '',
        email: filters.email ?? '',
    });

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

    return (
        <AppLayout title="Users" breadcrumb={breadcrumbFrom(breadcrumb)}>
            <Card>
                <FilterPanel
                    onSearch={() => apply()}
                    onReset={reset}
                    actions={
                        <ButtonLink href={route('users.create')} size="sm" className="filter-button">
                            Add
                        </ButtonLink>
                    }
                >
                    <div className="row g-2">
                        <div className="col-md-3">
                            <TextInput
                                placeholder="Name"
                                value={values.name}
                                onChange={(event) => set('name', event.target.value)}
                            />
                        </div>
                        <div className="col-md-3">
                            <Select
                                placeholder="-- Select User Type --"
                                options={userTypes}
                                value={values.user_type}
                                onChange={(event) => set('user_type', event.target.value)}
                            />
                        </div>
                        <div className="col-md-3">
                            <TextInput
                                placeholder="Mobile"
                                maxLength={15}
                                onKeyDown={digitsOnly}
                                value={values.mobile}
                                onChange={(event) => set('mobile', event.target.value)}
                            />
                        </div>
                        <div className="col-md-3">
                            <TextInput
                                type="email"
                                placeholder="Email"
                                maxLength={255}
                                value={values.email}
                                onChange={(event) => set('email', event.target.value)}
                            />
                        </div>
                    </div>
                </FilterPanel>

                <hr />

                <div className="py-2 fw-semibold" style={{ maxWidth: 240 }}>
                    <Select
                        aria-label="Status"
                        placeholder="-- Select Status --"
                        options={STATUS_OPTIONS}
                        value={values.active}
                        onChange={(event) => {
                            set('active', event.target.value);
                            apply({ active: event.target.value });
                        }}
                    />
                </div>

                <DataTable>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th style={{ width: '30%' }}>Name</th>
                            <th>User Type</th>
                            <th>Team</th>
                            <th />
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user, index) => (
                            <tr key={user.id}>
                                <td>{index + 1}</td>
                                <td>{user.name}</td>
                                <td>{user.type_label}</td>
                                <td>{user.team_label}</td>
                                <td className="text-center">
                                    <Button
                                        variant="warning"
                                        size="sm"
                                        shadow={false}
                                        onClick={() => resetPassword(user)}
                                    >
                                        Reset Password
                                    </Button>
                                </td>
                                <td>
                                    <div className="d-flex gap-1">
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            className="me-3"
                                            onClick={() => deleteUser(user)}
                                        >
                                            Delete
                                        </Button>
                                        <Link
                                            className="btn btn-sm btn-primary custom-button-shadow"
                                            href={route('users.view', user.id)}
                                        >
                                            View
                                        </Link>
                                        <Link
                                            className="btn btn-sm btn-primary custom-button-shadow"
                                            href={route('users.edit', user.id)}
                                        >
                                            Edit
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && <EmptyRow colSpan={6}>No users found.</EmptyRow>}
                    </tbody>
                </DataTable>
            </Card>
        </AppLayout>
    );
}
