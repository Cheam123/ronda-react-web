import { isAxiosError } from 'axios';
import { errorMessage, postJson } from '@/lib/http';
import type { ApiEnvelope } from '@/types';

/** The rep assistant's endpoints on an outlet (OutletAssistantController). */
type AssistantAction = 'brief' | 'chat' | 'followUp' | 'pitches';

/** Most messages in one Ask Ronda chat (OutletAssistantService::MAX_TURNS). */
export const MAX_CHAT_MESSAGES = 20;

/** Longest message (OutletAssistantService::MAX_MESSAGE). */
export const MAX_CHAT_MESSAGE_LENGTH = 2000;

export async function callAssistant<T>(action: AssistantAction, leadId: number, data?: unknown): Promise<T> {
    const response = await postJson<ApiEnvelope<T>>(route(`lead.assistant.${action}`, leadId), data);
    return response.data as T;
}

/** What to tell the rep when a call fails; 429 is the per-minute limit. */
export function assistantError(error: unknown, fallback: string): string {
    if (isAxiosError(error) && error.response?.status === 429) {
        return 'You have asked Ronda a lot in the last minute. Please wait a moment and try again.';
    }

    return errorMessage(error, fallback);
}

const TIME = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "at 8:42 am today" or "on 3 Oct 2026". */
export function writtenWhen(iso: string): string {
    const date = new Date(iso);

    return date.toDateString() === new Date().toDateString()
        ? `at ${TIME.format(date)} today`
        : `on ${DAY.format(date)}`;
}
