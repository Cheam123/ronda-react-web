import Card from '@/Components/ui/Card';
import AppLayout from '@/Layouts/AppLayout';
import { avatarFor } from '@/lib/avatar';
import type { User } from './types';

function ProfileItem({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="mt-4">
            <p className="profile-label">{label} :</p>
            <h5 className="font-size-16">{value || '-'}</h5>
        </div>
    );
}

/** The signed-in user's own profile. */
export default function Profile({ user }: { user: User }) {
    return (
        <AppLayout title="User Profile">
            <Card>
                <div className="text-center">
                    <img src={avatarFor(user.gender)} alt="" className="avatar-lg rounded-circle img-thumbnail" />
                    <h5 className="mt-3 mb-1">{user.name}</h5>
                    <p className="text-muted">{user.type_label}</p>
                </div>

                <hr className="my-4" />

                <div className="col-md-6 mx-auto text-center">
                    <ProfileItem label="Name" value={user.name} />
                    <ProfileItem label="Mobile" value={user.mobile} />
                    <ProfileItem label="Email" value={user.email} />
                    <ProfileItem label="Team" value={user.team_label} />
                </div>
            </Card>
        </AppLayout>
    );
}
