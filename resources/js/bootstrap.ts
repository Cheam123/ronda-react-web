import { router } from '@inertiajs/react';
import axios from 'axios';
import type { Page } from '@inertiajs/core';

// Laravel treats requests carrying this header as AJAX (JSON errors, no
// redirects to HTML error pages).
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

/**
 * Every request carries the session's CSRF token in X-CSRF-TOKEN. The token
 * comes with each page (it changes on sign-in and sign-out), and Inertia's
 * router shares this axios instance, so page visits and our own JSON calls
 * are both covered.
 */
export function applyCsrfToken(page: Page): void {
    const token = page.props.csrfToken;
    if (typeof token === 'string') {
        axios.defaults.headers.common['X-CSRF-TOKEN'] = token;
    }
}

router.on('navigate', (event) => applyCsrfToken(event.detail.page));
