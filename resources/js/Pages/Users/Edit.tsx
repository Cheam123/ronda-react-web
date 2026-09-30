import Card from '@/Components/ui/Card';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import type { BreadcrumbProps, SelectOption } from '@/types';
import UserForm from './Partials/UserForm';
import type { User } from './types';

interface EditUserProps extends BreadcrumbProps {
    user: User;
    teams: SelectOption[];
    userTypes: SelectOption[];
}

export default function EditUser({ user, teams, userTypes, ...breadcrumb }: EditUserProps) {
    return (
        <AppLayout title="Users" breadcrumb={breadcrumbFrom(breadcrumb)}>
            <Card>
                <UserForm user={user} teams={teams} userTypes={userTypes} />
            </Card>
        </AppLayout>
    );
}
