import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {feelings} from './feelings.js';
import {testRun} from './test-runs.js';
import {emptyUserData, exportFilename, mergeUserData, parseUserData} from './user-data.js';

const run51 = testRun({
    id: 'a',
    temperatureF: 51,
    feeling: feelings.coldOk,
});

describe(parseUserData.name, () => {
    it('gives empty data for garbage', () => {
        assert.deepEquals(parseUserData('nope'), {
            data: emptyUserData(),
            droppedRuns: 0,
        });
    });

    it('keeps good records and drops bad ones', () => {
        const parsed = parseUserData({
            version: 1,
            runs: [
                run51,
                {
                    ...run51,
                    feeling: 'sweaty',
                },
            ],
            activeRun: {
                startedAt: '2026-11-17T13:00:00.000Z',
                temperatureF: 51,
                feelsLikeF: null,
                windMph: null,
            },
            settings: {
                location: {
                    latitude: 1,
                    longitude: 2,
                    name: 'Home',
                },
                customClothing: [
                    'Vest',
                    '',
                    3,
                ],
            },
        });
        assert.deepEquals(parsed.data.runs, [run51]);
        assert.strictEquals(parsed.droppedRuns, 1);
        assert.isTrue(parsed.data.activeRun != null);
        assert.strictEquals(parsed.data.settings.location?.name, 'Home');
        assert.deepEquals(parsed.data.settings.customClothing, ['Vest']);
    });

    it('drops a bad run in progress and location', () => {
        const parsed = parseUserData({
            runs: [],
            activeRun: {
                startedAt: 5,
            },
            settings: {
                location: 'home',
            },
        });
        assert.isNull(parsed.data.activeRun);
        assert.isNull(parsed.data.settings.location);
    });
});

describe(mergeUserData.name, () => {
    it('replaces runs by id and combines clothing', () => {
        const current = {
            ...emptyUserData(),
            runs: [run51],
            settings: {
                location: null,
                customClothing: ['Vest'],
            },
        };
        const edited = {
            ...run51,
            notes: 'edited',
        };
        const other = testRun({
            id: 'b',
            temperatureF: 40,
            feeling: feelings.right,
        });
        const merged = mergeUserData({
            current,
            imported: {
                ...emptyUserData(),
                runs: [
                    edited,
                    other,
                ],
                settings: {
                    location: {
                        latitude: 1,
                        longitude: 2,
                        name: 'Imported',
                    },
                    customClothing: [
                        'Vest',
                        'Buff',
                    ],
                },
            },
        });
        assert.deepEquals(merged.runs, [
            edited,
            other,
        ]);
        assert.deepEquals(merged.settings.customClothing, [
            'Vest',
            'Buff',
        ]);
        assert.strictEquals(merged.settings.location?.name, 'Imported');
    });

    it('keeps the current location', () => {
        const home = {
            latitude: 3,
            longitude: 4,
            name: 'Home',
        };
        const merged = mergeUserData({
            current: {
                ...emptyUserData(),
                settings: {
                    location: home,
                    customClothing: [],
                },
            },
            imported: emptyUserData(),
        });
        assert.deepEquals(merged.settings.location, home);
    });
});

describe(exportFilename.name, () => {
    it('uses the date', () => {
        assert.strictEquals(exportFilename('2026-11-17T13:00:00.000Z'), 'run-log-2026-11-17.json');
    });
});
