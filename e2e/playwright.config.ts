import {defineConfig} from '@playwright/test';
import {e2eOrigin, e2ePort} from './e2e-settings.ts';

/**
 * Run through `npm run test:e2e`, which builds first. Serves the built app with `wrangler dev` (the
 * same Worker and headers as production, including the CSP). Weather is always mocked by the tests;
 * nothing here reaches Open-Meteo.
 */
export default defineConfig({
    testDir: '.',
    testMatch: '*.e2e.ts',
    outputDir: '../test-results',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: e2eOrigin,
        viewport: {
            width: 390,
            height: 844,
        },
        /** For local runs only, to use an already downloaded browser. CI installs its own. */
        ...(process.env['E2E_CHROMIUM_PATH']
            ? {
                  launchOptions: {
                      executablePath: process.env['E2E_CHROMIUM_PATH'],
                  },
              }
            : {}),
        geolocation: {
            latitude: 40,
            longitude: -105,
        },
        permissions: ['geolocation'],
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: `node_modules/.bin/wrangler dev --host localhost:${e2ePort} --port ${e2ePort}`,
        cwd: '..',
        url: `${e2eOrigin}/api/health`,
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
