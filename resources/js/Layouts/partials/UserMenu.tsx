import { Link, router } from '@inertiajs/react';
import Dropdown from 'react-bootstrap/Dropdown';
import { useAuth } from '@/hooks/useAuth';
import { avatarFor } from '@/lib/avatar';

/** The avatar button on the right of the header: profile and sign out. */
export default function UserMenu() {
    const { user } = useAuth();

    if (!user) {
        return null;
    }

    const name = user.name.charAt(0).toUpperCase() + user.name.slice(1);

    return (
        <Dropdown align="end" className="d-inline-block">
            <Dropdown.Toggle
                as="button"
                type="button"
                bsPrefix="btn"
                className="header-item"
                id="page-header-user-dropdown"
            >
                <img className="rounded-circle header-profile-user" src={avatarFor(user.gender)} alt="" height={22} />
                <span className="d-none d-xl-inline-block ms-1 fw-medium custom-font-xsmall text-nowrap">{name}</span>
            </Dropdown.Toggle>
            <Dropdown.Menu>
                <Dropdown.Item as={Link} href={route('users.profile')}>
                    <i className="uil uil-user-circle align-middle text-muted me-1" />
                    <span className="align-middle custom-font-small">View Profile</span>
                </Dropdown.Item>
                <Dropdown.Item as="button" type="button" onClick={() => router.post(route('logout'))}>
                    <i className="uil uil-sign-out-alt align-middle me-1 text-muted" />
                    <span className="align-middle custom-font-small">Sign out</span>
                </Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown>
    );
}
