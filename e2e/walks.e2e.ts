import {expect, type Page} from '@playwright/test';
import {setLocationAndOpenToday, test} from './fixtures.ts';

function chip(page: Page, name: string) {
    return page.getByRole('button', {
        name,
        exact: true,
    });
}

function section(page: Page, name: string) {
    return page.getByRole('group', {
        name,
    });
}

/** From Today (weather loaded): log a walk with the kids' answers. */
async function logWalk(
    page: Page,
    {
        feeling = 'Just right',
        kidsClothing,
        kidsFeeling,
    }: Readonly<{feeling?: string; kidsClothing: ReadonlyArray<string>; kidsFeeling: string}>,
): Promise<void> {
    await page
        .getByRole('button', {
            name: 'Log a run I already did',
        })
        .click();
    await chip(page, 'Walk').click();
    await expect(
        page.getByRole('heading', {
            name: 'Log a walk',
        }),
    ).toBeVisible();
    await section(page, 'How did you feel?')
        .getByRole('button', {
            name: feeling,
        })
        .click();
    for (const item of kidsClothing) {
        await section(page, 'Kids wore')
            .getByRole('button', {
                name: item,
                exact: true,
            })
            .click();
    }
    await section(page, 'How were the kids?')
        .getByRole('button', {
            name: kidsFeeling,
        })
        .click();
    await page
        .getByRole('button', {
            name: 'Save walk',
        })
        .click();
    await expect(
        page.getByRole('button', {
            name: 'Start run',
        }),
    ).toBeVisible();
}

test('a walk needs the kids feeling, and shows kids advice on Today', async ({page}) => {
    await setLocationAndOpenToday(page);
    await page
        .getByRole('button', {
            name: 'Log a run I already did',
        })
        .click();
    await chip(page, 'Walk').click();
    await section(page, 'How did you feel?')
        .getByRole('button', {
            name: 'Just right',
            exact: true,
        })
        .click();
    await page
        .getByRole('button', {
            name: 'Save walk',
        })
        .click();
    await expect(page.getByRole('alert')).toHaveText('Pick how the kids felt.');
    await page
        .getByRole('button', {
            name: 'Cancel',
        })
        .click();

    await logWalk(page, {
        kidsClothing: [
            'Jacket',
            'Hat',
        ],
        kidsFeeling: 'Too cold',
    });

    await section(page, 'Activity')
        .getByRole('button', {
            name: 'Walk',
        })
        .click();
    await expect(
        page.getByRole('button', {
            name: 'Start walk',
        }),
    ).toBeVisible();
    await expect(page.getByText('Bundle up: add a layer.')).toBeVisible();
    await expect(page.locator('.advice')).toContainText('jacket and hat');

    await section(page, 'Activity')
        .getByRole('button', {
            name: 'Run',
        })
        .click();
    await expect(page.getByText('No runs near 51°F yet')).toBeVisible();

    await logWalk(page, {
        feeling: 'Too warm',
        kidsClothing: ['Boots'],
        kidsFeeling: 'Miserable',
    });
    await section(page, 'Activity')
        .getByRole('button', {
            name: 'Walk',
        })
        .click();
    await expect(page.getByText("Don't go outside.")).toBeVisible();
    await expect(page.locator('.advice')).toContainText('The kids were miserable at 51°F.');

    await page.goto('/runs');
    await expect(page.locator('.tag').first()).toHaveText('Walk');
    await section(page, 'Show')
        .getByRole('button', {
            name: 'Runs',
        })
        .click();
    await expect(page.getByText('No runs yet.')).toBeVisible();
    await section(page, 'Show')
        .getByRole('button', {
            name: 'Walks',
        })
        .click();
    await page
        .locator('li > button')
        .filter({
            hasText: 'Too warm',
        })
        .click();
    await expect(page.locator('.kids')).toContainText('Boots');
    await page
        .getByRole('button', {
            name: 'Edit',
        })
        .click();
    await expect(
        page.getByRole('heading', {
            name: 'Edit walk',
        }),
    ).toBeVisible();
    await expect(
        section(page, 'How were the kids?').getByRole('button', {
            name: 'Miserable',
        }),
    ).toHaveAttribute('aria-pressed', 'true');
});
