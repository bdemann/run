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
    /** Someone who can already do full pushups starts the baseline there. */
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
    await expect(page.locator('p.variation').first()).toHaveText('Pushup');
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

test('a done set can be edited, marked not done, and marked done again', async ({page}) => {
    await page.goto('/workout');
    await page
        .getByRole('button', {
            name: 'Start baseline test',
        })
        .click();
    const inputs = page.getByLabel('As many as you can with good form');
    for (let index = 0; index < 5; index++) {
        await inputs.nth(index).fill('10');
    }
    await page
        .getByRole('button', {
            name: 'Finish',
        })
        .click();
    await page
        .getByRole('button', {
            name: 'Start workout',
        })
        .click();

    const editor = page.locator('.set-editor');
    const sets = page.getByRole('button', {
        name: '6',
        exact: true,
    });
    await sets.nth(0).click();
    await expect(sets.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(editor).toBeHidden();

    await sets.nth(0).click();
    await expect(editor).toBeVisible();
    await expect(editor).toContainText('Set 1 · reps');
    await expect(editor.locator('.set-editor-value')).toHaveText('6');

    await page
        .getByRole('button', {
            name: 'More',
        })
        .click();
    await expect(editor.locator('.set-editor-value')).toHaveText('7');
    await expect(
        page.getByRole('button', {
            name: '7',
            exact: true,
        }),
    ).toBeVisible();
    await editor
        .getByRole('button', {
            name: 'OK',
        })
        .click();
    await expect(editor).toBeHidden();

    await page
        .getByRole('button', {
            name: '7',
            exact: true,
        })
        .click();
    await expect(editor).toBeVisible();
    await editor
        .getByRole('button', {
            name: 'Not done',
        })
        .click();
    await expect(editor).toBeHidden();
    await expect(sets.nth(0)).toHaveAttribute('aria-pressed', 'false');

    await sets.nth(0).click();
    await expect(sets.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(editor).toBeHidden();
});
