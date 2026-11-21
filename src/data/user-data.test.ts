import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {feelings} from './feelings.js';
import {testRoute} from './test-routes.js';
import {testRun} from './test-runs.js';
import {testGoal, testSet, testWorkout} from './test-workouts.js';
import {emptyUserData, exportFilename, mergeUserData, parseUserData} from './user-data.js';
import {measures} from './workout-shapes.js';

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
            droppedWorkouts: 0,
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

describe('route data', () => {
    const oldRun: Record<string, unknown> = {
        ...run51,
    };
    delete oldRun['routeId'];
    delete oldRun['distanceMiles'];

    it('keeps old runs and runs in progress that lack the route keys', () => {
        const parsed = parseUserData({
            version: 1,
            runs: [oldRun],
            activeRun: {
                startedAt: '2026-11-17T13:00:00.000Z',
                temperatureF: 51,
                feelsLikeF: null,
                windMph: null,
            },
            settings: {},
        });
        assert.strictEquals(parsed.droppedRuns, 0);
        assert.deepEquals(parsed.data.runs, [run51]);
        assert.deepEquals(parsed.data.activeRun, {
            startedAt: '2026-11-17T13:00:00.000Z',
            temperatureF: 51,
            feelsLikeF: null,
            windMph: null,
            routeId: null,
            recording: null,
        });
        assert.deepEquals(parsed.data.routes, []);
    });

    it('still drops a run that is bad in another way, and non-object runs', () => {
        const parsed = parseUserData({
            runs: [
                {
                    ...oldRun,
                    feeling: 'sweaty',
                },
                'run',
                [],
            ],
        });
        assert.strictEquals(parsed.droppedRuns, 3);
    });

    it('keeps good routes and drops bad ones one at a time', () => {
        const parsed = parseUserData({
            routes: [
                testRoute(),
                {
                    id: 'bad',
                },
            ],
        });
        assert.deepEquals(parsed.data.routes, [testRoute()]);
    });

    it('keeps a recording in progress', () => {
        const activeRun = {
            startedAt: '2026-11-17T13:00:00.000Z',
            temperatureF: null,
            feelsLikeF: null,
            windMph: null,
            routeId: null,
            recording: {
                points: [
                    {
                        latitude: 1,
                        longitude: 2,
                        accuracyM: 5,
                        atMs: 3,
                    },
                ],
            },
        };
        assert.deepEquals(
            parseUserData({
                activeRun,
            }).data.activeRun,
            activeRun,
        );
    });

    it('merges routes by id with the import winning', () => {
        const merged = mergeUserData({
            current: {
                ...emptyUserData(),
                routes: [testRoute()],
            },
            imported: {
                ...emptyUserData(),
                routes: [
                    testRoute({
                        name: 'Renamed',
                    }),
                    testRoute({
                        id: 'r2',
                    }),
                ],
            },
        });
        assert.deepEquals(
            merged.routes.map((route) => route.name),
            [
                'Renamed',
                'River loop',
            ],
        );
    });
});

describe('workout data', () => {
    const exercise = {
        id: 'plank',
        name: 'Plank',
        measure: measures.seconds,
        variations: [
            {
                id: 'full',
                name: 'Plank',
            },
        ],
        cues: ['Straight'],
        unlockedAt: null,
    };
    const workout = testWorkout({
        id: 'w1',
        sets: [
            testSet({
                value: 5,
            }),
        ],
    });

    it('loads old documents without workout fields', () => {
        const parsed = parseUserData({
            version: 1,
            runs: [],
            activeRun: null,
            settings: {},
        });
        assert.deepEquals(parsed.data, emptyUserData());
    });

    it('keeps good workout records and drops bad ones one at a time', () => {
        const active = {
            startedAt: '2026-11-17T13:00:00.000Z',
            isTest: false,
            sets: [
                testSet({
                    value: 1,
                }),
            ],
        };
        const parsed = parseUserData({
            exercises: [
                exercise,
                {
                    id: 'bad',
                },
            ],
            workouts: [
                workout,
                {
                    ...workout,
                    isTest: 'yes',
                },
            ],
            goals: [
                testGoal(),
                {
                    id: 'bad',
                },
            ],
            activeWorkout: active,
        });
        assert.deepEquals(parsed.data.exercises, [exercise]);
        assert.deepEquals(parsed.data.workouts, [workout]);
        assert.deepEquals(parsed.data.goals, [testGoal()]);
        assert.deepEquals(parsed.data.activeWorkout, active);
        assert.strictEquals(parsed.droppedWorkouts, 1);
        assert.isTrue(
            parseUserData({
                activeWorkout: {
                    nope: 1,
                },
            }).data.activeWorkout == null,
        );
    });

    it('merges by id with the imported copy winning and keeps the current active workout', () => {
        const active = {
            startedAt: '2026-11-17T13:00:00.000Z',
            isTest: false,
            sets: [],
        };
        const merged = mergeUserData({
            current: {
                ...emptyUserData(),
                exercises: [exercise],
                workouts: [workout],
                goals: [testGoal()],
                activeWorkout: active,
            },
            imported: {
                ...emptyUserData(),
                exercises: [
                    {
                        ...exercise,
                        name: 'Plank!',
                    },
                ],
                workouts: [
                    {
                        ...workout,
                        isTest: true,
                    },
                    testWorkout({
                        id: 'w2',
                    }),
                ],
                goals: [
                    testGoal({
                        id: 'g2',
                    }),
                ],
            },
        });
        assert.strictEquals(merged.exercises[0]?.name, 'Plank!');
        assert.strictEquals(merged.workouts.length, 2);
        assert.isTrue(merged.workouts[0]?.isTest);
        assert.strictEquals(merged.goals.length, 2);
        assert.deepEquals(merged.activeWorkout, active);
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
