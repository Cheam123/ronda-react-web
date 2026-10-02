import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import type { SelectOption } from '@/types';
import UserForm from './Partials/UserForm';
import type { User } from './types';

interface EditUserProps {
    user: User;
    teams: SelectOption[];
    userTypes: SelectOption[];
}

export default function EditUser({ user, teams, userTypes }: EditUserProps) {
    return (
        <AppLayout title={`Edit ${user.name}`}>
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Admin' },
                        { label: 'Users', href: route('users.index') },
                        { label: user.name, href: route('users.view', user.id) },
                        { label: 'Edit' },
                    ]}
                    title={`Edit ${user.name}`}
                />
                <UserForm user={user} teams={teams} userTypes={userTypes} />
            </SurfacePage>
        </AppLayout>
    );
}
