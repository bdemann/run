import {expect, type Page} from '@playwright/test';
import {openTab, setLocationAndOpenToday, test} from './fixtures.ts';

function chip(page: Page, name: string) {
    return page.getByRole('button', {
        name,
        exact: true,
    });
}

/** From Today: log a past run by hand. The temperature is only typed when given. */
async function logRun(
    page: Page,
    {
        temperatureF,
        clothing,
        feeling,
    }: Readonly<{temperatureF?: number; clothing: ReadonlyArray<string>; feeling: string}>,
): Promise<void> {
    await page
        .getByRole('button', {
            name: 'Log a run I already did',
        })
        .click();
    if (temperatureF != undefined) {
        await page.getByLabel('Temp °F').fill(String(temperatureF));
        /** The form refills on `change`, which fires on blur. */
        await page.getByLabel('Temp °F').press('Tab');
    }
    for (const item of clothing) {
        const button = chip(page, item);
        if ((await button.getAttribute('aria-pressed')) !== 'true') {
            await button.click();
        }
    }
    await chip(page, feeling).click();
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

test('first run: set location, run, and log what was worn', async ({page}) => {
    await setLocationAndOpenToday(page);
    await expect(page.getByText('No runs near 51°F yet')).toBeVisible();
    await expect(page.getByText('Feels like 47°')).toBeVisible();
    await expect(page.getByText('Wind 4 mph')).toBeVisible();

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

    await expect(page.getByLabel('Temp °F')).toHaveValue('51');
    await chip(page, 'Shirt').click();
    await chip(page, 'Shorts').click();
    await chip(page, 'Just right').click();
    await page
        .getByRole('button', {
            name: 'Save run',
        })
        .click();

    await openTab(page, 'Runs');
    await expect(
        page.getByRole('heading', {
            name: 'Runs',
        }),
    ).toBeVisible();
    await expect(page.getByText('No runs yet.')).toBeHidden();
    await expect(
        page.getByText('51°', {
            exact: true,
        }),
    ).toHaveCount(1);
    await expect(page.getByText(/feels 47°/)).toBeVisible();
});

test('advice comes from a past run at the same temperature', async ({page}) => {
    await setLocationAndOpenToday(page);
    await logRun(page, {
        clothing: [
            'Shirt',
            'Sweater',
        ],
        feeling: 'A bit cold, but fine',
    });

    const advice = page.locator('.advice');
    await expect(advice).toContainText('The last time you ran at 51°F');
    await expect(advice).toContainText('you wore shirt and sweater and felt a bit cold, but fine.');
});

test('a new run starts with what was worn at that temperature, until the temperature changes', async ({
    page,
}) => {
    await setLocationAndOpenToday(page);
    await logRun(page, {
        clothing: [
            'Shirt',
            'Sweater',
        ],
        feeling: 'A bit cold, but fine',
    });

    await page
        .getByRole('button', {
            name: 'Log a run I already did',
        })
        .click();
    await expect(page.getByLabel('Temp °F')).toHaveValue('51');
    await expect(chip(page, 'Shirt')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page, 'Sweater')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page, 'A bit cold, but fine')).toHaveAttribute('aria-pressed', 'true');

    /** Nothing was picked by hand, so a new temperature clears the automatic answers. */
    await page.getByLabel('Temp °F').fill('20');
    await page.getByLabel('Temp °F').press('Tab');
    await expect(chip(page, 'Shirt')).toHaveAttribute('aria-pressed', 'false');
    await expect(chip(page, 'Sweater')).toHaveAttribute('aria-pressed', 'false');
    await expect(chip(page, 'A bit cold, but fine')).toHaveAttribute('aria-pressed', 'false');
});

test('answers picked by hand survive a new temperature', async ({page}) => {
    await setLocationAndOpenToday(page);
    await logRun(page, {
        clothing: [
            'Shirt',
            'Sweater',
        ],
        feeling: 'A bit cold, but fine',
    });

    await page
        .getByRole('button', {
            name: 'Log a run I already did',
        })
        .click();
    await chip(page, 'Shorts').click();
    await page.getByLabel('Temp °F').fill('20');
    await page.getByLabel('Temp °F').press('Tab');
    await expect(chip(page, 'Shirt')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page, 'Shorts')).toHaveAttribute('aria-pressed', 'true');
});

test('too cold: a miserable run at 30 means stay inside at 25', async ({page, weather}) => {
    await setLocationAndOpenToday(page);
    await logRun(page, {
        temperatureF: 30,
        clothing: [
            'Shirt',
        ],
        feeling: "Miserable: don't go outside at this temp",
    });

    weather.temperatureF = 25;
    await page
        .getByRole('button', {
            name: 'Refresh temperature',
        })
        .click();
    await expect(
        page.getByLabel('Temperature', {
            exact: true,
        }),
    ).toContainText('25°');
    await expect(
        page.getByRole('heading', {
            name: "Don't go outside.",
        }),
    ).toBeVisible();
    await expect(page.locator('.advice')).toContainText('At 30°F you said it was miserable');
});
