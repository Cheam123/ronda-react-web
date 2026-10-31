import { useSyncExternalStore } from 'react';

/**
 * Light / dark theme. The choice is a preference (light, dark, or follow the
 * system), kept in localStorage and resolved to a theme that sits on <html>
 * as data-theme; resources/scss/ronda/_tokens.scss swaps the palette off it.
 * The inline script in resources/views/app.blade.php applies the same rule
 * before first paint, so keep the two in step.
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ronda-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
/** The browser chrome colour (mobile address bar) for each theme. */
const CHROME_COLOR: Record<Theme, string> = { light: '#0D729E', dark: '#121823' };

interface ThemeState {
    preference: ThemePreference;
    theme: Theme;
}

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
        // Storage can be blocked (private windows); the system setting still applies.
        return 'system';
    }
}

function resolve(preference: ThemePreference): Theme {
    if (preference === 'system') {
        return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
    }
    return preference;
}

function currentState(): ThemeState {
    const preference = readPreference();
    return { preference, theme: resolve(preference) };
}

// useSyncExternalStore needs the same object back until something changes.
let state: ThemeState | null = null;

function snapshot(): ThemeState {
    state ??= currentState();
    return state;
}

function paint({ theme }: ThemeState) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME_COLOR[theme]);
}

function refresh() {
    const next = currentState();
    if (state && state.preference === next.preference && state.theme === next.theme) return;
    state = next;
    paint(next);
    listeners.forEach((notify) => notify());
}

/** Choose light, dark or the system's setting. */
export function setThemePreference(preference: ThemePreference) {
    try {
        if (preference === 'system') {
            window.localStorage.removeItem(STORAGE_KEY);
        } else {
            window.localStorage.setItem(STORAGE_KEY, preference);
        }
    } catch {
        // Not saved, but it still applies until the page is reloaded.
    }
    state = { preference, theme: resolve(preference) };
    paint(state);
    listeners.forEach((notify) => notify());
}

/** Keep the page in step with the system setting and with other tabs. Call once at start-up. */
export function startTheme() {
    paint(snapshot());
    window.matchMedia(DARK_QUERY).addEventListener('change', refresh);
    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY || event.key === null) refresh();
    });
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** The preference, the theme it resolves to, and a setter; re-renders when either changes. */
export function useTheme() {
    const { preference, theme } = useSyncExternalStore(subscribe, snapshot, snapshot);
    return { preference, theme, setPreference: setThemePreference };
}
