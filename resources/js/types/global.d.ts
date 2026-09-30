import type { route as routeFn } from 'ziggy-js';

declare global {
    /** Named-route URL builder published by Ziggy's @routes directive. */
    const route: typeof routeFn;

    interface ImportMetaEnv {
        readonly VITE_APP_NAME?: string;
    }
}
