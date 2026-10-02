import { Link, router } from '@inertiajs/react';
import Dropdown from 'react-bootstrap/Dropdown';
import Initials from '@/Components/surface/Initials';
import { useAuth } from '@/hooks/useAuth';

const signOut = () => router.post(route('logout'));

/** The account button on the right of the bar: profile, password, sign out. */
export default function UserMenu() {
    const { user } = useAuth();

    if (!user) {
        return null;
    }

    return (
        <Dropdown align="end">
            <Dropdown.Toggle as="button" type="button" bsPrefix="rd-account" aria-label={`Account: ${user.name}`}>
                <Initials name={user.name} colorKey={user.id} />
                <span className="rd-account__name">{user.name}</span>
                <i className="mdi mdi-chevron-down rd-nav__chevron" aria-hidden="true" />
            </Dropdown.Toggle>
            <Dropdown.Menu className="rd-menu rd-account__menu">
                <div className="rd-account__who">
                    <Initials name={user.name} colorKey={user.id} size="lg" />
                    <span className="rd-person__text">
                        <span className="rd-person__name">{user.name}</span>
                        <span className="rd-person__sub">{user.typeLabel}</span>
                    </span>
                </div>
                <Link href={route('users.profile')} className="dropdown-item">
                    <i className="mdi mdi-account-circle-outline" aria-hidden="true" />
                    Your profile
                </Link>
                <Link href={route('users.changepassword')} className="dropdown-item">
                    <i className="mdi mdi-lock-outline" aria-hidden="true" />
                    Change password
                </Link>
                <Dropdown.Item as="button" type="button" onClick={signOut}>
                    <i className="mdi mdi-logout" aria-hidden="true" />
                    Sign out
                </Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown>
    );
}

/** The account block at the foot of the phone menu. */
export function UserSheet() {
    const { user } = useAuth();

    if (!user) {
        return null;
    }

    return (
        <div className="rd-sheet__account">
            <div className="rd-person">
                <Initials name={user.name} colorKey={user.id} size="lg" />
                <span className="rd-person__text">
                    <span className="rd-person__name">{user.name}</span>
                    <span className="rd-person__sub">{user.typeLabel}</span>
                </span>
            </div>
            <div className="rd-sheet__account-actions">
                <Link href={route('users.profile')} className="rd-btn rd-btn--lg">
                    Your profile
                </Link>
                <button type="button" className="rd-btn rd-btn--lg" onClick={signOut}>
                    Sign out
                </button>
            </div>
        </div>
    );
}
