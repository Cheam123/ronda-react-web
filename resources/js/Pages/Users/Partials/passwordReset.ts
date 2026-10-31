import { confirm } from '@/lib/dialogs';
import type { User } from '../types';

/**
 * "Reset password" on the user list and page: Ronda emails them a link to
 * choose their own, so the admin never sets or sees it.
 */
export function confirmPasswordReset(user: Pick<User, 'name' | 'email'>): Promise<boolean> {
    return confirm({
        title: `Email ${user.name} a reset link?`,
        text:
            `Ronda emails ${user.email} a link to choose a new password. It works for 60 minutes. ` +
            'Their current password keeps working until they use it.',
        confirmText: 'Send link',
    });
}
