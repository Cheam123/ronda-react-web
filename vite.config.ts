import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            // legal.scss styles the public legal pages, which are plain Blade.
            // map-frame.ts is the bare map page inside the phone app's map picker.
            input: ['resources/js/app.tsx', 'resources/scss/legal.scss', 'resources/js/map-frame.ts'],
            refresh: true,
        }),
        react(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
    },
    build: {
        rollupOptions: {
            output: {
                // React in its own chunk: it caches across deploys, and lazy
                // chunks import it rather than the entry. (A lazy chunk that
                // imports the entry makes Vite load the entry's stylesheet a
                // second time, and fail the import if that load fails.)
                manualChunks: (id) =>
                    /node_modules\/(react|react-dom|scheduler|use-sync-external-store|clsx)\//.test(id)
                        ? 'vendor'
                        : undefined,
                // MapLibre's map worker ships as .mjs, which Nginx serves as
                // application/octet-stream, and browsers refuse to start a
                // module worker of that type (a blank map). A .js name is
                // served as JavaScript everywhere.
                assetFileNames: (asset) =>
                    (asset.names?.[0] ?? '').endsWith('.mjs')
                        ? 'assets/[name]-[hash].js'
                        : 'assets/[name]-[hash][extname]',
            },
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
