import type { ReactNode } from 'react';
import { formatPhone, phoneHref } from '@/lib/phone';
import type { User } from '../types';

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <>
            <dt>{label}</dt>
            <dd>{children || <span className="rd-muted">—</span>}</dd>
        </>
    );
}

/** A user's contact and settings as label / value rows (their page and their profile). */
export default function UserDetails({ user, settings = true }: { user: User; settings?: boolean }) {
    const phone = phoneHref(user.mobile);

    return (
        <dl className="rd-facts">
            <Fact label="Email">{user.email && <a href={`mailto:${user.email}`}>{user.email}</a>}</Fact>
            <Fact label="Mobile">
                {user.mobile &&
                    (phone ? (
                        <a href={phone} className="rd-facts__phone">
                            <i className="mdi mdi-phone-outline" aria-hidden="true" />
                            {formatPhone(user.mobile)}
                        </a>
                    ) : (
                        formatPhone(user.mobile)
                    ))}
            </Fact>
            <Fact label="User type">{user.type_label}</Fact>
            <Fact label="Team">{user.team_label}</Fact>
            <Fact label="Gender">{user.gender_label}</Fact>
            {settings && (
                <>
                    <Fact label="Telegram chat">
                        {user.telegram_chat_id && <span className="rd-mono">{user.telegram_chat_id}</span>}
                    </Fact>
                    <Fact label="Task alerts">{user.enable_notification === 1 ? 'On' : 'Off'}</Fact>
                </>
            )}
        </dl>
    );
}
