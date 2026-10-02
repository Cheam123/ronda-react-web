import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import type { SelectOption } from '@/types';
import UserForm from './Partials/UserForm';

interface CreateUserProps {
    teams: SelectOption[];
    userTypes: SelectOption[];
}

export default function CreateUser({ teams, userTypes }: CreateUserProps) {
    return (
        <AppLayout title="Add a user">
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Admin' },
                        { label: 'Users', href: route('users.index') },
                        { label: 'Add a user' },
                    ]}
                    title="Add a user"
                    lede="Ronda emails them a password when you save."
                />
                <UserForm teams={teams} userTypes={userTypes} />
            </SurfacePage>
        </AppLayout>
    );
}
