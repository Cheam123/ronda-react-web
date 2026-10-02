/** "Mei Ling Tan" -> "MT", "Administrator" -> "AD" */
export function initialsOf(name: string | null | undefined): string {
    const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/** Toned colours for initials avatars; every one carries white text at 4.5:1 or better. */
const INITIALS_COLORS = ['#0D729E', '#3F6B4F', '#9A5B2E', '#6B4E7A', '#7A5C3E', '#2F5D86', '#8A4B5C'];

/** The same person always gets the same colour. */
export function initialsColor(key: string | number): string {
    const text = String(key);
    let hash = 0;
    for (let index = 0; index < text.length; index++) {
        hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return INITIALS_COLORS[hash % INITIALS_COLORS.length];
}

/** The cartoon avatar the app shows for a user of the given gender. */
export function avatarFor(gender: string | null | undefined): string {
    return gender === 'F'
        ? '/assets/images/users/cartoon-girl-profile.png'
        : '/assets/images/users/cartoon-boy-profile.png';
}
