import '../scss/bootstrap.scss';
import '../scss/icons.scss';
import '../scss/app.scss';
import '../scss/ronda.scss';
import { applyCsrfToken } from './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@/Components/feedback/ToastProvider';

const appName = import.meta.env.VITE_APP_NAME || 'Ronda';

createInertiaApp({
    title: (title) => (title ? `${title} | ${appName}` : appName),
    resolve: (name) => resolvePageComponent(`./Pages/${name}.tsx`, import.meta.glob('./Pages/**/*.tsx')),
    setup({ el, App, props }) {
        applyCsrfToken(props.initialPage);
        createRoot(el).render(
            <ToastProvider>
                <App {...props} />
            </ToastProvider>,
        );
    },
    progress: {
        color: '#f78b17',
        showSpinner: true,
    },
});
