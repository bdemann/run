import {defineConfig} from '@virmator/frontend/configs/vite.config.base.js';
import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {VitePWA} from 'vite-plugin-pwa';

const packageDirPath = resolve(import.meta.dirname, '..');
/** CI sets GITHUB_SHA; locally ask the repo; otherwise "dev". */
function findCommit(): string {
    if (process.env['GITHUB_SHA']) {
        return process.env['GITHUB_SHA'];
    }
    try {
        return execSync('git rev-parse HEAD', {
            cwd: packageDirPath,
            stdio: [
                'ignore',
                'pipe',
                'ignore',
            ],
        })
            .toString()
            .trim();
    } catch {
        return 'dev';
    }
}

const packageVersion = (
    JSON.parse(readFileSync(resolve(packageDirPath, 'package.json'), 'utf8')) as {version: string}
).version;

export default defineConfig(
    {
        /** Served from a Cloudflare Worker at the domain root, not from a sub-path. */
        forGitHubPages: false,
        packageDirPath,
    },
    (baseConfig) => {
        return {
            ...baseConfig,
            /** Build info for the About page. */
            define: {
                ...baseConfig.define,
                __APP_VERSION__: JSON.stringify(packageVersion),
                __APP_COMMIT__: JSON.stringify(findCommit()),
                __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
            },
            plugins: [
                ...(baseConfig.plugins ?? []),
                ...VitePWA({
                    registerType: 'autoUpdate',
                    manifest: {
                        name: 'Run Log',
                        short_name: 'Run',
                        description:
                            'Remembers what you wore at each temperature and tells you how to dress.',
                        display: 'standalone',
                        theme_color: '#1f6f5c',
                        background_color: '#f6f5f1',
                        start_url: '/',
                        scope: '/',
                        icons: [
                            {
                                src: '/icon-192.png',
                                sizes: '192x192',
                                type: 'image/png',
                                purpose: 'any',
                            },
                            {
                                src: '/icon-512.png',
                                sizes: '512x512',
                                type: 'image/png',
                                purpose: 'any',
                            },
                            {
                                src: '/icon-512-maskable.png',
                                sizes: '512x512',
                                type: 'image/png',
                                purpose: 'maskable',
                            },
                        ],
                    },
                    /**
                     * The service worker is `src/sw.ts` (precache and network-first pages).
                     * Index.html is never precached and there is no navigate fallback: a cached
                     * index.html served its old headers (including the CSP) forever.
                     */
                    strategies: 'injectManifest',
                    srcDir: '.',
                    filename: 'sw.ts',
                    injectManifest: {
                        globPatterns: [
                            '**/*.{js,css,woff2,png,ico}',
                        ],
                    },
                }),
            ],
        };
    },
);
