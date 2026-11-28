import {expect, type Page} from '@playwright/test';
import {openTab, setLocationAndOpenToday, test} from './fixtures.ts';

function chip(page: Page, name: string) {
    return page.getByRole('button', {
        name,
        exact: true,
    });
}

test('light rain shows on Today, is prefilled in the form and saved on the run', async ({
    page,
    weather,
}) => {
    weather.precipitation = {
        kind: 'rain',
        intensity: 'light',
    };
    await setLocationAndOpenToday(page);
    await expect(page.locator('.precipitation')).toHaveText('Light rain');
    /** Light rain is not worth a note under the advice. */
    await expect(page.locator('.wet-note')).toBeHidden();

    await page
        .getByRole('button', {
            name: 'Start run',
        })
        .click();
    await page
        .getByRole('button', {
            name: 'Finish run',
        })
        .click();
    await expect(chip(page, 'Rain')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page, 'Light')).toHaveAttribute('aria-pressed', 'true');
    await chip(page, 'Shirt').click();
    await chip(page, 'Just right').click();
    await page
        .getByRole('button', {
            name: 'Save run',
        })
        .click();

    await openTab(page, 'Runs');
    await page
        .locator('li')
        .filter({
            hasText: '51°',
        })
        .click();
    await expect(page.getByText('Light rain')).toBeVisible();
});

test('moderate snow adds a note under the advice', async ({page, weather}) => {
    weather.precipitation = {
        kind: 'snow',
        intensity: 'moderate',
    };
    await setLocationAndOpenToday(page);
    await expect(page.locator('.precipitation')).toHaveText('Snow');
    await expect(page.locator('.wet-note')).toHaveText("It's snowing (moderate) right now.");
});
