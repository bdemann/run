import {test as base, expect, type Page} from '@playwright/test';

/** The forecast the mocked weather service answers with, changeable by a test. */
export type MockWeather = {
    temperatureF: number;
    feelsLikeF: number;
    windMph: number;
    /** What is falling; the Worker mock sends it as is and Open-Meteo gets a matching WMO code. */
    precipitation?: {kind: 'rain' | 'snow'; intensity: 'light' | 'moderate' | 'heavy'};
};

const wmoCodes = {
    rain: {
        light: 61,
        moderate: 63,
        heavy: 65,
    },
    snow: {
        light: 71,
        moderate: 73,
        heavy: 75,
    },
};

export const defaultWeather: Readonly<MockWeather> = {
    temperatureF: 51,
    feelsLikeF: 47,
    windMph: 4,
};

/**
 * Every test gets a fresh browser context (so empty storage), a mocked Worker weather endpoint (an
 * NWS reading) and Open-Meteo, and fails on any page error or console error (a CSP violation shows
 * up as one).
 */
export const test = base.extend<{weather: MockWeather; allowedConsoleErrors: string[]}>({
    /** Substrings of console errors a test expects (e.g. a mocked network failure). */
    allowedConsoleErrors: [
        // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructured first argument
        async ({}, use) => {
            await use([]);
        },
        {},
    ],
    weather: [
        async ({page, allowedConsoleErrors}, use) => {
            const weather: MockWeather = {
                ...defaultWeather,
            };
            await page.route('**/api/weather?**', async (route) => {
                await route.fulfill({
                    json: {
                        ok: true,
                        weather: {
                            ...weather,
                        },
                        source: 'nws',
                        observedAt: '2026-11-19T13:35:00+00:00',
                        station: 'KTST',
                    },
                });
            });
            await page.route('https://api.open-meteo.com/**', async (route) => {
                await route.fulfill({
                    json: {
                        current: {
                            temperature_2m: weather.temperatureF,
                            apparent_temperature: weather.feelsLikeF,
                            wind_speed_10m: weather.windMph,
                            weather_code: weather.precipitation
                                ? wmoCodes[weather.precipitation.kind][
                                      weather.precipitation.intensity
                                  ]
                                : 0,
                        },
                    },
                });
            });
            await page.route('https://geocoding-api.open-meteo.com/**', async (route) => {
                await route.fulfill({
                    json: {
                        results: [
                            {
                                name: 'Boulder',
                                admin1: 'Colorado',
                                country_code: 'US',
                                latitude: 40.01,
                                longitude: -105.27,
                            },
                        ],
                    },
                });
            });
            const problems: string[] = [];
            page.on('pageerror', (error) => {
                problems.push(`pageerror: ${error.message}`);
            });
            page.on('console', (message) => {
                if (
                    message.type() === 'error' &&
                    !allowedConsoleErrors.some((allowed) => message.text().includes(allowed))
                ) {
                    problems.push(`console error: ${message.text()}`);
                }
            });
            page.on('dialog', (dialog) => {
                void dialog.accept();
            });
            await use(weather);
            expect(problems).toEqual([]);
        },
        {
            auto: true,
        },
    ],
});

export async function openTab(
    page: Page,
    label: 'Today' | 'Workout' | 'Runs' | 'Settings',
): Promise<void> {
    await page
        .locator('kit-bottom-nav')
        .getByText(label, {
            exact: true,
        })
        .click();
}

/** Settings, "Use my current location", then back to Today with the mocked weather loaded. */
export async function setLocationAndOpenToday(page: Page): Promise<void> {
    await page.goto('/settings');
    await page
        .getByRole('button', {
            name: 'Use my current location',
        })
        .click();
    await expect(page.getByText(/Temperatures are for/)).toBeVisible();
    await openTab(page, 'Today');
    await expect(
        page.getByLabel('Temperature', {
            exact: true,
        }),
    ).toContainText('51°');
    await expect(page.locator('.source')).toContainText(/Measured at KTST · \d{1,2}:\d{2}/);
}
