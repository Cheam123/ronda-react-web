import '../scss/bootstrap.scss';
import '../scss/icons.scss';
import '../scss/app.scss';
import '../scss/ronda.scss';
import { applyCsrfToken } from './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import DialogHost from '@/Components/feedback/DialogHost';
import { ToastProvider } from '@/Components/feedback/ToastProvider';
import { startTheme } from '@/lib/theme';

const appName = import.meta.env.VITE_APP_NAME || 'Ronda';

startTheme();

createInertiaApp({
    title: (title) => (title ? `${title} | ${appName}` : appName),
    resolve: (name) => resolvePageComponent(`./Pages/${name}.tsx`, import.meta.glob('./Pages/**/*.tsx')),
    setup({ el, App, props }) {
        applyCsrfToken(props.initialPage);
        createRoot(el).render(
            <ToastProvider>
                <App {...props} />
                <DialogHost />
            </ToastProvider>,
        );
    },
    // A bar across the top of the window while a page loads; no corner spinner.
    // The colour goes into a stylesheet, so a token works and follows the theme.
    progress: {
        color: 'var(--rd-brand)',
        showSpinner: false,
    },
});
