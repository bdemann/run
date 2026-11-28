import {expect, type Page} from '@playwright/test';
import {openTab, setLocationAndOpenToday, test} from './fixtures.ts';

function chip(page: Page, name: string) {
    return page.getByRole('button', {
        name,
        exact: true,
    });
}

async function openLogForm(page: Page): Promise<void> {
    await page
        .getByRole('button', {
            name: 'Log a run I already did',
        })
        .click();
}

async function fillField({
    page,
    label,
    value,
}: Readonly<{page: Page; label: string; value: string}>): Promise<void> {
    await page.getByLabel(label).fill(value);
    /** The form refills on `change`, which fires on blur. */
    await page.getByLabel(label).press('Tab');
}

async function saveRun(page: Page): Promise<void> {
    await page
        .getByRole('button', {
            name: 'Save run',
        })
        .click();
    await expect(
        page.getByRole('button', {
            name: 'Start run',
        }),
    ).toBeVisible();
}

test('a typed temperature (even below zero) carries through Start and Finish into Runs', async ({
    page,
    allowedConsoleErrors,
}) => {
    allowedConsoleErrors.push('Failed to load resource');
    await page.route('**/api/weather?**', async (route) => {
        await route.fulfill({
            status: 502,
            json: {
                ok: false,
                error: 'No weather source answered.',
            },
        });
    });
    await page.route('https://api.open-meteo.com/**', async (route) => {
        await route.abort('timedout');
    });
    await page.goto('/settings');
    await page
        .getByRole('button', {
            name: 'Use my current location',
        })
        .click();
    await expect(page.getByText(/Temperatures are for/)).toBeVisible();
    await openTab(page, 'Today');
    await page
        .getByRole('button', {
            name: 'Refresh temperature',
        })
        .click();
    await expect(page.locator('.error')).toContainText("Couldn't get the weather right now");

    await page.getByLabel('Temperature °F').fill('-5');
    await expect(page.getByText('No runs near -5°F yet')).toBeVisible();
    await page
        .getByRole('button', {
            name: 'Start run',
        })
        .click();
    await expect(page.getByRole('timer')).toBeVisible();
    await page
        .getByRole('button', {
            name: 'Finish run',
        })
        .click();

    await expect(page.getByLabel('Temp °F')).toHaveValue('-5');
    await chip(page, 'Shirt').click();
    await chip(page, 'Just right').click();
    await page
        .getByRole('button', {
            name: 'Save run',
        })
        .click();

    await openTab(page, 'Runs');
    await expect(
        page.getByText('-5°', {
            exact: true,
        }),
    ).toHaveCount(1);
});

test('Today notes when it is windier or feels colder than the reference run', async ({
    page,
    weather,
}) => {
    weather.temperatureF = 30;
    weather.feelsLikeF = 30;
    weather.windMph = 2;
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
    ).toContainText('30°');

    await openLogForm(page);
    await fillField({
        page,
        label: 'Feels like °F',
        value: '30',
    });
    await fillField({
        page,
        label: 'Wind mph',
        value: '2',
    });
    await chip(page, 'Shirt').click();
    await chip(page, 'Just right').click();
    await saveRun(page);
    await expect(page.locator('.advice')).toContainText('The last time you ran at 30°F');
    await expect(page.locator('.advice')).not.toContainText('windier');

    weather.feelsLikeF = 20;
    weather.windMph = 15;
    await page
        .getByRole('button', {
            name: 'Refresh temperature',
        })
        .click();
    await expect(page.locator('.advice')).toContainText("It's windier today (15 mph vs 2 mph).");

    /** Wind wins over feels-like; with calm wind, the feels-like note shows. */
    weather.windMph = 2;
    await page
        .getByRole('button', {
            name: 'Refresh temperature',
        })
        .click();
    await expect(page.locator('.advice')).toContainText('It feels colder today (20°F vs 30°F).');
});

test('custom clothing: add in a run, remove in Settings, older runs keep it', async ({page}) => {
    await setLocationAndOpenToday(page);
    await openLogForm(page);
    await page.getByLabel('Add a clothing item').fill('Rain shell');
    await page
        .getByRole('button', {
            name: 'Add',
            exact: true,
        })
        .click();
    await expect(chip(page, 'Rain shell')).toHaveAttribute('aria-pressed', 'true');
    await chip(page, 'Just right').click();
    await saveRun(page);

    await openTab(page, 'Settings');
    await expect(page.locator('.custom-items')).toContainText('Rain shell');
    await page
        .getByRole('button', {
            name: 'Remove Rain shell',
        })
        .click();
    await expect(page.locator('.custom-items')).toHaveCount(0);

    await openTab(page, 'Today');
    await openLogForm(page);
    /** The form prefills from the same-temperature run, so a new temperature clears it. */
    await fillField({
        page,
        label: 'Temp °F',
        value: '20',
    });
    await expect(chip(page, 'Rain shell')).toHaveCount(0);

    await openTab(page, 'Runs');
    await expect(page.getByText(/rain shell/i)).toBeVisible();
});
