import FormActions from '@/Components/form/FormActions';
import Card from '@/Components/ui/Card';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import type { BreadcrumbProps } from '@/types';
import UserDetails from './Partials/UserDetails';
import type { User } from './types';

interface ShowUserProps extends BreadcrumbProps {
    user: User;
}

export default function ShowUser({ user, ...breadcrumb }: ShowUserProps) {
    return (
        <AppLayout title="Users" breadcrumb={breadcrumbFrom(breadcrumb)}>
            <Card>
                <UserDetails user={user} />
                <FormActions backHref={route('users.index')} />
            </Card>
        </AppLayout>
    );
}
