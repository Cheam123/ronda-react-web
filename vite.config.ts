import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            input: 'resources/js/app.tsx',
            refresh: true,
        }),
        react(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                // The Minible theme imports Bootstrap as "./node_modules/...",
                // relative to the project root.
                loadPaths: [fileURLToPath(new URL('.', import.meta.url))],
                // Its partials trip Bootstrap's own deprecation notices; they
                // are not ours to fix.
                quietDeps: true,
            },
        },
    },
});
