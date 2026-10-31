/**
 * The app's confirm and prompt dialogs. Pages ask with `confirm()` /
 * `promptText()` and await the answer; DialogHost (mounted once in app.tsx)
 * draws each request as a surface Dialog, so every dialog looks and behaves
 * the same.
 */

export type DialogIcon = 'question' | 'warning' | 'error' | 'success' | 'info';

export interface ConfirmOptions {
    title: string;
    text?: string;
    confirmText?: string;
    cancelText?: string;
    icon?: DialogIcon;
    /** A destructive step: a red confirm button, and Cancel has the focus. */
    danger?: boolean;
    /**
     * Cancelling is the safe, expected choice ("Keep editing"): Cancel is the
     * primary button and has the focus; confirming is drawn as a soft danger.
     */
    safeCancel?: boolean;
}

export interface PromptOptions {
    title: string;
    text?: string;
    /** The input's label; the title stands in (unseen) when there is none. */
    inputLabel?: string;
    inputPlaceholder?: string;
    /** Text the input starts with. */
    inputValue?: string;
    inputType?: 'text' | 'textarea' | 'password';
    confirmText?: string;
    /** The message shown when it is left empty, or false when it may be. */
    required?: string | false;
    minLength?: number;
    maxLength?: number;
}

export type DialogRequest =
    | { kind: 'confirm'; options: ConfirmOptions; resolve: (confirmed: boolean) => void }
    | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

type Show = (request: DialogRequest) => void;

let show: Show | null = null;
const waiting: DialogRequest[] = [];

/** DialogHost registers itself here; requests made before it mounted are passed on. */
export function registerDialogHost(host: Show): () => void {
    show = host;
    waiting.splice(0).forEach(host);

    return () => {
        if (show === host) show = null;
    };
}

function open(request: DialogRequest) {
    if (show) {
        show(request);
    } else {
        waiting.push(request);
    }
}

/** Ask a yes / no question. Resolves to true when the user confirms. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => open({ kind: 'confirm', options, resolve }));
}

/** Ask for a line of text. Resolves to null when the user cancels. */
export function promptText(options: PromptOptions): Promise<string | null> {
    return new Promise((resolve) => open({ kind: 'prompt', options, resolve }));
}
