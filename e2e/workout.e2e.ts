import {expect} from '@playwright/test';
import {openTab, test} from './fixtures.ts';

test('baseline test, then a training workout shows in recent workouts', async ({page}) => {
    await page.goto('/');
    await openTab(page, 'Workout');
    await expect(page.getByText('No workouts yet.')).toBeVisible();

    await page
        .getByRole('button', {
            name: 'Start baseline test',
        })
        .click();
    await expect(
        page.getByRole('heading', {
            name: 'Baseline test',
        }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', {
            name: 'Finish',
        }),
    ).toBeDisabled();

    const inputs = page.getByLabel('As many as you can with good form');
    await expect(inputs).toHaveCount(5);
    for (let index = 0; index < 5; index++) {
        await inputs.nth(index).fill('10');
    }
    await page
        .getByRole('button', {
            name: 'Finish',
        })
        .click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(page.getByText(/Next time: Pushup 6 · Sit-up 6/)).toBeVisible();
    await expect(page.getByText('5 sets')).toBeVisible();
    await expect(
        page.getByText('Test', {
            exact: true,
        }),
    ).toBeVisible();

    await page
        .getByRole('button', {
            name: 'Start workout',
        })
        .click();
    await expect(
        page.getByRole('heading', {
            name: 'Workout',
            exact: true,
        }),
    ).toBeVisible();
    /** A workout in progress survives a reload. */
    await page.reload();
    const sixes = page.getByRole('button', {
        name: '6',
        exact: true,
    });
    await expect(sixes).toHaveCount(10);
    await sixes.nth(0).click();
    await expect(sixes.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await sixes.nth(1).click();
    await expect(sixes.nth(1)).toHaveAttribute('aria-pressed', 'true');

    await page
        .getByRole('button', {
            name: 'Finish',
        })
        .click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(page.getByText('2 sets')).toBeVisible();
    await expect(
        page.getByText('Test', {
            exact: true,
        }),
    ).toHaveCount(1);

    await page
        .getByRole('button', {
            name: /2 sets/,
        })
        .click();
    await expect(page.getByText('Delete this workout?')).toBeVisible();
    await page
        .getByRole('button', {
            name: 'Delete',
        })
        .click();
    await expect(page.getByText('2 sets')).toBeHidden();
});

test('cancel discards a workout in progress after a confirm step', async ({page}) => {
    await page.goto('/workout');
    await page
        .getByRole('button', {
            name: 'Start baseline test',
        })
        .click();
    await page
        .getByRole('button', {
            name: 'Cancel',
        })
        .click();
    await expect(page.getByText('Discard this workout?')).toBeVisible();
    await page
        .getByRole('button', {
            name: 'Discard',
        })
        .click();
    await expect(
        page.getByRole('button', {
            name: 'Start baseline test',
        }),
    ).toBeVisible();
});
