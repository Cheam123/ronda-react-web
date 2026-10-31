const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), select, textarea, button:not([disabled]), [tabindex]';

/** Smooth scrolling, unless the person has asked for less motion. */
export function scrollBehaviour(): ScrollBehavior {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/**
 * Bring a form field into view and put the cursor in it. `id` may name the
 * control itself, a fieldset, or a label-like element beside the control
 * (GPS and file fields). Returns false when nothing has that id.
 */
export function focusField(id: string): boolean {
    const element = document.getElementById(id);
    if (!element) return false;

    const target = element.matches(FOCUSABLE)
        ? element
        : (element.querySelector<HTMLElement>(FOCUSABLE) ??
          element.closest('.rd-field, .rd-fieldset')?.querySelector<HTMLElement>(FOCUSABLE) ??
          null);

    element.scrollIntoView({ block: 'center', behavior: scrollBehaviour() });
    (target ?? element).focus({ preventScroll: true });
    return true;
}
