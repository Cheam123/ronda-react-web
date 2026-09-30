import Swal, { type SweetAlertIcon, type SweetAlertOptions } from 'sweetalert2';

/**
 * SweetAlert2 dialogs used across the app. Pages ask for a decision with
 * `confirm()` / `promptText()` and never touch Swal directly, so every
 * dialog looks and behaves the same.
 */

interface ConfirmOptions {
    title: string;
    text?: string;
    confirmText?: string;
    cancelText?: string;
    icon?: SweetAlertIcon;
    danger?: boolean;
}

export async function confirm({
    title,
    text,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    icon = 'question',
    danger = false,
}: ConfirmOptions): Promise<boolean> {
    const result = await Swal.fire({
        title,
        text,
        icon,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        confirmButtonColor: danger ? '#f46a6a' : undefined,
        focusCancel: danger,
    });

    return result.isConfirmed;
}

interface PromptOptions {
    title: string;
    text?: string;
    inputLabel?: string;
    inputPlaceholder?: string;
    inputType?: 'text' | 'textarea' | 'password';
    confirmText?: string;
    required?: string | false;
    minLength?: number;
    maxLength?: number;
}

/** Ask for a line of text. Resolves to null when the user cancels. */
export async function promptText({
    title,
    text,
    inputLabel,
    inputPlaceholder,
    inputType = 'text',
    confirmText = 'Submit',
    required = false,
    minLength,
    maxLength,
}: PromptOptions): Promise<string | null> {
    const result = await Swal.fire({
        title,
        text,
        input: inputType,
        inputLabel,
        inputPlaceholder,
        inputAttributes: {
            autocapitalize: 'off',
            ...(minLength ? { minlength: String(minLength) } : {}),
            ...(maxLength ? { maxlength: String(maxLength) } : {}),
        },
        showCancelButton: true,
        confirmButtonText: confirmText,
        inputValidator: (value: string) => (required && !value.trim() ? required : undefined),
    });

    return result.isConfirmed ? String(result.value ?? '') : null;
}

export function alertSuccess(title: string, text?: string): Promise<unknown> {
    return Swal.fire({ title, text, icon: 'success' });
}

export function alertError(title: string, text?: string): Promise<unknown> {
    return Swal.fire({ title, text, icon: 'error' });
}

/** Fire a dialog the server queued with alert()->... (see HandleInertiaRequests). */
export function fireServerAlert(config: Record<string, unknown>): Promise<unknown> {
    return Swal.fire(config as SweetAlertOptions);
}
