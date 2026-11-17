import {defineConfig} from '@virmator/deps/configs/dep-cruiser.config.base.js';
import {type IConfiguration} from 'dependency-cruiser';

const baseConfig = defineConfig({
    fileExceptions: {
        // enter file exceptions by rule name here
        'no-orphans': {
            from: [
                'src/index\\.ts$',
                'src/worker/index\\.ts$',
            ],
        },
    },
    omitRules: [
        // enter rule names here to omit
    ],
});

const depCruiserConfig: IConfiguration = {
    ...baseConfig,
    forbidden: [
        ...(baseConfig.forbidden ?? []),
        {
            name: 'worker-not-from-ui',
            severity: 'error',
            comment:
                'src/worker runs on Cloudflare Workers and must not depend on UI code. Share logic by putting it in src/data (pure, environment-agnostic).',
            from: {
                path: '^src/worker/',
            },
            to: {
                path: '^src/(ui|router\\.ts)',
            },
        },
        {
            name: 'ui-not-from-worker',
            severity: 'error',
            comment:
                'src/worker runs server-side with secrets. Browser code (src/ui, src/router.ts) must never import it. Share logic by putting it in src/data.',
            from: {
                path: '^src/(ui|router\\.ts)',
            },
            to: {
                path: '^src/worker/',
            },
        },
        {
            name: 'data-not-from-ui-or-worker',
            severity: 'error',
            comment:
                'src/data is pure shared logic and shapes; it must not import UI or Worker code.',
            from: {
                path: '^src/data/',
            },
            to: {
                path: '^src/(ui|worker)/',
            },
        },
        {
            name: 'worker-skips-kit-ui',
            severity: 'error',
            comment:
                'The Worker may use @bdemann/app-kit/server and /data, never the browser elements in /ui.',
            from: {
                path: '^src/worker/',
            },
            to: {
                path: '@bdemann/app-kit/dist/ui/',
            },
        },
    ],
};

module.exports = depCruiserConfig;
