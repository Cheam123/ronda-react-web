import Card from '@/Components/ui/Card';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import type { BreadcrumbProps, SelectOption } from '@/types';
import UserForm from './Partials/UserForm';

interface CreateUserProps extends BreadcrumbProps {
    teams: SelectOption[];
    userTypes: SelectOption[];
}

export default function CreateUser({ teams, userTypes, ...breadcrumb }: CreateUserProps) {
    return (
        <AppLayout title="Users" breadcrumb={breadcrumbFrom(breadcrumb)}>
            <Card>
                <UserForm teams={teams} userTypes={userTypes} />
            </Card>
        </AppLayout>
    );
}
