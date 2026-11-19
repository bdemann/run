import {expect} from '@playwright/test';
import {openTab, test} from './fixtures.ts';

test('add a goal, see its progress, see the weekly count, delete the goal', async ({page}) => {
    await page.goto('/workout');
    await page
        .getByRole('button', {
            name: 'Start baseline test',
        })
        .click();
    const inputs = page.getByLabel('As many as you can with good form');
    await page.getByLabel('Variation').first().selectOption('full');
    for (let index = 0; index < 5; index++) {
        await inputs.nth(index).fill('10');
    }
    await page
        .getByRole('button', {
            name: 'Finish',
        })
        .click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page
        .getByRole('button', {
            name: 'Goals',
            exact: true,
        })
        .click();
    await expect(
        page.getByRole('heading', {
            name: 'Goals',
        }),
    ).toBeVisible();
    await expect(page.getByText('No goals yet.')).toBeVisible();

    await page.getByLabel('Variation').selectOption('full');
    await page.getByLabel('Target (reps in one set)').fill('20');
    await page.getByLabel('Deadline (optional)').fill('2099-12-31');
    await page
        .getByRole('button', {
            name: 'Add goal',
        })
        .click();
    await expect(
        page.getByText('Pushup, 20', {
            exact: true,
        }),
    ).toBeVisible();
    await expect(page.getByText(/Best 10/)).toBeVisible();
    await expect(page.getByText(/by Dec 31/)).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveJSProperty('value', 10);
    await expect(page.getByRole('progressbar')).toHaveJSProperty('max', 20);

    await openTab(page, 'Today');
    await expect(page.getByText('1 of 3 this week')).toBeVisible();
    await page
        .getByRole('button', {
            name: '1 of 3 this week',
        })
        .click();
    await expect(
        page.getByRole('heading', {
            name: 'Goals',
        }),
    ).toBeVisible();

    await page
        .getByRole('button', {
            name: /Delete goal/,
        })
        .click();
    await expect(page.getByText('Delete this goal?')).toBeVisible();
    await page
        .getByRole('button', {
            name: 'Delete',
            exact: true,
        })
        .click();
    await expect(page.getByText('No goals yet.')).toBeVisible();
});
