import {assert} from '@augment-vir/assert';
import {itCases} from '@augment-vir/test';
import {describe, it} from 'node:test';
import {activities} from './activities.js';
import {
    addClothingItem,
    clothingGroups,
    defaultClothing,
    defaultKidsClothing,
    describeClothing,
    prefillForTemperature,
    removeClothingItem,
} from './clothing.js';
import {feelingLabels, feelingOrder, feelings, feelingShortLabels} from './feelings.js';
import {testRun} from './test-runs.js';

describe(clothingGroups.name, () => {
    it('shows only the built-ins with nothing custom', () => {
        assert.deepEquals(
            clothingGroups({
                customClothing: [],
                selected: ['Shirt'],
            }).map((group) => group.name),
            Object.keys(defaultClothing),
        );
    });

    it('adds custom and unknown selected items under Other', () => {
        assert.deepEquals(
            clothingGroups({
                customClothing: ['Vest'],
                selected: [
                    'Shirt',
                    'Vest',
                    'Headlamp',
                ],
            }).at(-1),
            {
                name: 'Other',
                items: [
                    'Vest',
                    'Headlamp',
                ],
            },
        );
    });
});

describe(addClothingItem.name, () => {
    it('ignores blank input', () => {
        assert.isUndefined(
            addClothingItem({
                customClothing: [],
                typed: '   ',
            }),
        );
    });

    it('matches an existing item regardless of case', () => {
        assert.deepEquals(
            addClothingItem({
                customClothing: ['Vest'],
                typed: ' shorts ',
            }),
            {
                item: 'Shorts',
                customClothing: ['Vest'],
            },
        );
    });

    it('adds a new item with tidy spacing', () => {
        assert.deepEquals(
            addClothingItem({
                customClothing: [],
                typed: 'Rain   shell',
            }),
            {
                item: 'Rain shell',
                customClothing: ['Rain shell'],
            },
        );
    });
});

describe(describeClothing.name, () => {
    itCases(describeClothing, [
        {
            it: 'handles nothing',
            input: [],
            expect: 'nothing logged',
        },
        {
            it: 'handles one item',
            input: ['Shirt'],
            expect: 'shirt',
        },
        {
            it: 'joins several items',
            input: [
                'Shirt',
                'Sweater',
                'Shorts',
            ],
            expect: 'shirt, sweater and shorts',
        },
    ]);
});

describe(prefillForTemperature.name, () => {
    const at51 = testRun({
        temperatureF: 51,
        feeling: feelings.coldOk,
    });

    it('fills nothing without a temperature', () => {
        assert.deepEquals(
            prefillForTemperature({
                activity: activities.run,
                runs: [at51],
                temperatureF: undefined,
            }),
            {
                clothing: [],
                feeling: undefined,
                kidsClothing: [],
                kidsFeeling: undefined,
                note: undefined,
            },
        );
    });

    it('fills clothing and feeling from an exact match', () => {
        const prefill = prefillForTemperature({
            activity: activities.run,
            runs: [at51],
            temperatureF: 51,
        });
        assert.deepEquals(prefill.clothing, at51.clothing);
        assert.strictEquals(prefill.feeling, feelings.coldOk);
        assert.isTrue(prefill.note?.includes('last run at 51°F'));
    });

    it('fills only clothing from a nearby run', () => {
        const prefill = prefillForTemperature({
            activity: activities.run,
            runs: [at51],
            temperatureF: 48,
        });
        assert.deepEquals(prefill.clothing, at51.clothing);
        assert.isUndefined(prefill.feeling);
        assert.isTrue(prefill.note?.includes('closest run (51°F)'));
    });
});

describe('feelings', () => {
    it('labels every feeling', () => {
        for (const feeling of feelingOrder) {
            assert.isTrue(Boolean(feelingLabels[feeling] && feelingShortLabels[feeling]));
        }
    });
});

describe(removeClothingItem.name, () => {
    it('removes only the exact match and returns a new array', () => {
        const customClothing = [
            'Glovs',
            'glovs',
            'Vest',
        ];
        assert.deepEquals(
            removeClothingItem({
                customClothing,
                item: 'Glovs',
            }),
            [
                'glovs',
                'Vest',
            ],
        );
        assert.deepEquals(customClothing, [
            'Glovs',
            'glovs',
            'Vest',
        ]);
    });

    it('leaves the list alone when the item is missing', () => {
        assert.deepEquals(
            removeClothingItem({
                customClothing: ['Vest'],
                item: 'Hat',
            }),
            ['Vest'],
        );
    });
});

describe('walks', () => {
    const walk = testRun({
        temperatureF: 40,
        feeling: feelings.right,
        activity: 'walk',
        kidsFeeling: feelings.coldOk,
        kidsClothing: ['Hat'],
    });

    it('fills the kids from the last walk, and ignores runs', () => {
        const prefill = prefillForTemperature({
            runs: [
                walk,
                testRun({
                    temperatureF: 40,
                    feeling: feelings.right,
                    startedAt: '2026-11-20T13:00:00.000Z',
                }),
            ],
            temperatureF: 40,
            activity: activities.walk,
        });
        assert.deepEquals(prefill.kidsClothing, ['Hat']);
        assert.strictEquals(prefill.kidsFeeling, feelings.coldOk);
        assert.isTrue(prefill.note?.includes('last walk at 40°F'));
    });

    it('fills only kids clothing from a nearby walk', () => {
        const prefill = prefillForTemperature({
            runs: [walk],
            temperatureF: 38,
            activity: activities.walk,
        });
        assert.deepEquals(prefill.kidsClothing, ['Hat']);
        assert.isUndefined(prefill.kidsFeeling);
        assert.isTrue(prefill.note?.includes('closest walk (40°F)'));
    });

    it('uses the kids list for groups and added items', () => {
        assert.deepEquals(
            clothingGroups({
                customClothing: [],
                selected: [],
                defaults: defaultKidsClothing,
            }).map((group) => group.name),
            Object.keys(defaultKidsClothing),
        );
        assert.strictEquals(
            addClothingItem({
                customClothing: [],
                typed: 'mittens',
                defaults: defaultKidsClothing,
            })?.item,
            'Mittens',
        );
    });
});
