import clsx from 'clsx';

/** The .rd-tag colours (resources/scss/ronda/_surface.scss). */
export type TagHue = 'blue' | 'indigo' | 'violet' | 'pink' | 'orange' | 'teal' | 'green' | 'slate';

const AREA_HUES: TagHue[] = ['blue', 'indigo', 'violet', 'pink', 'orange', 'teal', 'green', 'slate'];

/** Helper::getTeamListing() id => hue. Admin stays grey. */
const TEAM_HUES: Record<number, TagHue> = {
    2: 'pink', // Operation
    3: 'orange', // Technician
    4: 'indigo', // Marketing
    5: 'blue', // Sales
    6: 'teal', // Pre-Sales
    99: 'violet', // Manager
};

/** An IFE area's tag hue. Areas are numbered, so neighbouring areas differ and an area keeps its hue. */
export function areaHue(areaId: number | null | undefined): TagHue | null {
    return areaId ? AREA_HUES[(areaId - 1) % AREA_HUES.length] : null;
}

export function teamHue(team: number | null | undefined): TagHue | null {
    return team ? (TEAM_HUES[team] ?? null) : null;
}

/** The class list for a tag of the given hue (grey without one). */
export function tagClass(hue: TagHue | null): string {
    return clsx('rd-tag', hue && `rd-tag--${hue}`);
}
