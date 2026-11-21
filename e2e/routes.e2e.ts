import {expect, type Page} from '@playwright/test';
import {openTab, setLocationAndOpenToday, test} from './fixtures.ts';

/** 0.0007 degrees of latitude is about 0.048 miles. */
const stepDegrees = 0.0007;

async function walk(page: Page, steps: number): Promise<void> {
    for (let step = 1; step <= steps; step++) {
        /** Fix times come from `Date.now()`, so give each step a minute (about 3 mph). */
        await page.clock.fastForward(60_000);
        await page.context().setGeolocation({
            latitude: 40 + step * stepDegrees,
            longitude: -105,
        });
    }
}

async function pickRoute(page: Page, label: string): Promise<void> {
    await page
        .getByLabel('Route', {
            exact: true,
        })
        .selectOption({
            label,
        });
}

test('record a route once, then reuse it for distance and pace', async ({page}) => {
    await page.clock.install();
    await setLocationAndOpenToday(page);

    /** First run: record the route. */
    await pickRoute(page, 'Record a new route');
    await page
        .getByRole('button', {
            name: 'Start run',
        })
        .click();
    await expect(page.locator('.recording')).toContainText('keep the screen on');
    await walk(page, 4);
    await expect(page.locator('.recording')).toContainText('0.19 mi');

    await page
        .getByRole('button', {
            name: 'Finish run',
        })
        .click();
    await expect(
        page.getByLabel('Distance (mi)', {
            exact: true,
        }),
    ).toHaveValue('0.19');
    await expect(
        page.getByRole('img', {
            name: 'Route outline',
        }),
    ).toBeVisible();
    await page.getByLabel('Minutes').fill('2');
    await page.getByLabel('Save this route as').fill('River loop');
    await page
        .getByRole('button', {
            name: 'Just right',
            exact: true,
        })
        .click();
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

    /** Second run: pick the saved route, no GPS needed. */
    await pickRoute(page, 'River loop · 0.19 mi');
    await page
        .getByRole('button', {
            name: 'Start run',
        })
        .click();
    await expect(page.locator('.recording')).toBeHidden();
    await page
        .getByRole('button', {
            name: 'Finish run',
        })
        .click();
    await expect(
        page.getByLabel('Distance (mi)', {
            exact: true,
        }),
    ).toHaveValue('0.19');
    await expect(page.getByLabel('Save this route as')).toBeHidden();
    await page.getByLabel('Minutes').fill('3');
    await page
        .getByRole('button', {
            name: 'Just right',
            exact: true,
        })
        .click();
    await page
        .getByRole('button', {
            name: 'Save run',
        })
        .click();

    await openTab(page, 'Runs');
    await expect(
        page.locator('li').filter({
            hasText: '10:32 /mi',
        }),
    ).toContainText('0.19 mi · 10:32 /mi · River loop');
    await expect(
        page.locator('li').filter({
            hasText: '15:47 /mi',
        }),
    ).toContainText('0.19 mi · 15:47 /mi · River loop');

    /** Settings lists the route; deleting it keeps the runs' distances. */
    await openTab(page, 'Settings');
    await expect(page.getByText('River loop · 0.19 mi')).toBeVisible();
    await page
        .getByRole('button', {
            name: 'Delete River loop',
        })
        .click();
    await page
        .getByRole('button', {
            name: 'Confirm delete River loop',
        })
        .click();
    await expect(page.getByText('River loop · 0.19 mi')).toBeHidden();
    await openTab(page, 'Runs');
    await expect(
        page.locator('li').filter({
            hasText: '10:32 /mi',
        }),
    ).toContainText('0.19 mi');
});

test('a recording survives a reload and keeps its earlier points', async ({page}) => {
    await page.clock.install();
    await setLocationAndOpenToday(page);
    await pickRoute(page, 'Record a new route');
    await page
        .getByRole('button', {
            name: 'Start run',
        })
        .click();
    await walk(page, 2);
    await expect(page.locator('.recording')).toContainText('0.10 mi');

    await page.reload();
    await expect(page.locator('.recording')).toContainText('0.10 mi');
    await page
        .getByRole('button', {
            name: 'Finish run',
        })
        .click();
    await expect(
        page.getByLabel('Distance (mi)', {
            exact: true,
        }),
    ).toHaveValue('0.1');
});
