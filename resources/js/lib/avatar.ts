/** The cartoon avatar the app shows for a user of the given gender. */
export function avatarFor(gender: string | null | undefined): string {
    return gender === 'F'
        ? '/assets/images/users/cartoon-girl-profile.png'
        : '/assets/images/users/cartoon-boy-profile.png';
}
