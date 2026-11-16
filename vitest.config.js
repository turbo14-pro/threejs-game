import { defineConfig } from 'vitest/config';

export default defineConfig({
    // Vitest must not share `node_modules/.vite` with the dev server: its Vite
    // instance would otherwise optimize deps into the dev server's cache, and a
    // concurrent/emptied cache leaves the browser with "504 Outdated Optimize Dep".
    cacheDir: 'node_modules/.vitest-cache',
    test: {
        environment: 'happy-dom',
        globals: true,
        exclude: ['**/node_modules/**', '**/dist/**', '**/tests/**'],
    },
});
