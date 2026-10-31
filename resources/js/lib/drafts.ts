import type { Answers } from '@/types/forms';

/** Answers to a form not yet submitted, kept in this browser (files are not). */
export interface FormDraft {
    answers: Answers;
    title: string;
    parent: string;
    /** When it was last written (ms since the epoch). */
    savedAt: number;
}

/** Drafts older than this are dropped rather than offered. */
const KEEP_FOR = 7 * 24 * 60 * 60 * 1000;

/** The storage key of one person's draft of one form. */
export const draftKey = (userId: number, formId: number) => `ronda-form-draft-${userId}-${formId}`;

export function readDraft(key: string): FormDraft | null {
    try {
        const draft = JSON.parse(localStorage.getItem(key) ?? 'null') as FormDraft | null;
        if (!draft || typeof draft.savedAt !== 'number' || Date.now() - draft.savedAt > KEEP_FOR) {
            return null;
        }
        return draft;
    } catch {
        return null;
    }
}

export function writeDraft(key: string, draft: FormDraft) {
    try {
        localStorage.setItem(key, JSON.stringify(draft));
    } catch {
        // Storage blocked or full: the form still works, it just isn't kept.
    }
}

export function clearDraft(key: string) {
    try {
        localStorage.removeItem(key);
    } catch {
        // Nothing was kept.
    }
}

const TIME = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** "10:42 am", or "23 Oct, 10:42 am" for an earlier day. */
export function draftTime(savedAt: number): string {
    const saved = new Date(savedAt);
    const time = TIME.format(saved).replace(/\s?([AP]M)$/i, (_, half: string) => ` ${half.toLowerCase()}`);
    return saved.toDateString() === new Date().toDateString() ? time : `${DAY.format(saved)}, ${time}`;
}
