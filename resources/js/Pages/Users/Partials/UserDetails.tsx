import Field from '@/Components/form/Field';
import TextInput from '@/Components/form/TextInput';
import type { User } from '../types';

/** A user's details as read-only fields (the View page). */
export default function UserDetails({ user }: { user: User }) {
    const fields: [label: string, value: string | null | undefined, wide?: boolean][] = [
        ['Name', user.name, true],
        ['Username', user.username, true],
        ['Team', user.team_label],
        ['User Type', user.type_label],
        ['Chat ID', user.telegram_chat_id],
        ['Gender', user.gender_label],
        ['Email', user.email],
        ['Mobile', user.mobile],
        ['Status', user.status === 1 ? 'Active' : 'Inactive'],
        ['Enable Notification', user.enable_notification === 1 ? 'Yes' : 'No'],
    ];

    return (
        <div className="row">
            {fields.map(([label, value, wide]) => (
                <Field key={label} label={label} className={wide ? 'col-12' : 'col-md-6'}>
                    <TextInput value={value ?? ''} readOnly />
                </Field>
            ))}
        </div>
    );
}
