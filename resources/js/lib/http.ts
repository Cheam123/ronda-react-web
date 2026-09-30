import axios, { isAxiosError } from 'axios';
import type { ApiEnvelope } from '@/types';

/**
 * Calls to the controllers' JSON endpoints (the ones answering with
 * response_success / response_failed). Page navigation and form posts that
 * redirect go through Inertia's router instead.
 */

export async function getJson<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await axios.get<T>(url, { params });
    return response.data;
}

export async function postJson<T = ApiEnvelope>(url: string, data?: unknown): Promise<T> {
    const response = await axios.post<T>(url, data);
    return response.data;
}

/** The most useful human-readable message an error carries. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
    if (isAxiosError(error)) {
        const body = error.response?.data as Partial<ApiEnvelope> | undefined;
        const firstFieldError = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
        return firstFieldError || body?.message || error.message || fallback;
    }

    return error instanceof Error ? error.message : fallback;
}
