import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {feelings} from './feelings.js';
import {createMemoryBackend, RunStore} from './run-store.js';
import {testRoute} from './test-routes.js';
import {testRun} from './test-runs.js';
import {testGoal, testSet, testWorkout} from './test-workouts.js';
import {emptyUserData} from './user-data.js';

const run51 = testRun({
    id: 'a',
    temperatureF: 51,
    feeling: feelings.coldOk,
});

const active = {
    activity: 'run' as const,
    startedAt: '2026-11-17T13:00:00.000Z',
    temperatureF: 51,
    feelsLikeF: 48,
    windMph: 3,
    routeId: null,
    recording: null,
};

describe(RunStore.name, () => {
    it('keeps the kids fields of a saved walk', () => {
        const store = new RunStore(createMemoryBackend());
        const walk = testRun({
            id: 'w',
            temperatureF: 40,
            feeling: feelings.right,
            activity: 'walk',
            kidsFeeling: feelings.coldOk,
            kidsClothing: ['Hat'],
        });
        store.saveRun({
            run: walk,
        });
        assert.deepEquals(new RunStore(createMemoryBackend(store.getData())).getRun('w'), walk);
    });

    it('starts empty and survives a backend that throws', () => {
        const store = new RunStore({
            load() {
                throw new Error('blocked');
            },
            save() {},
        });
        assert.deepEquals(store.getData(), emptyUserData());
    });

    it('loads what the backend has', () => {
        const store = new RunStore(
            createMemoryBackend({
                runs: [run51],
            }),
        );
        assert.deepEquals(store.getRun('a'), run51);
        assert.isUndefined(store.getRun('missing'));
    });

    it('runs the whole start, finish, edit, delete flow and saves each step', () => {
        const backend = createMemoryBackend();
        const store = new RunStore(backend);
        let changes = 0;
        const unsubscribe = store.subscribe(() => {
            changes++;
        });

        store.startRun(active);
        assert.deepEquals(store.getData().activeRun, active);

        store.saveRun({
            run: run51,
            finishesActiveRun: true,
        });
        assert.isNull(store.getData().activeRun);

        store.saveRun({
            run: {
                ...run51,
                notes: 'cold hands',
            },
        });
        assert.strictEquals(store.getData().runs.length, 1);
        assert.strictEquals(store.getRun('a')?.notes, 'cold hands');

        store.deleteRun('a');
        assert.deepEquals(store.getData().runs, []);

        unsubscribe();
        store.startRun(active);
        store.cancelRun();
        assert.isNull(store.getData().activeRun);
        assert.strictEquals(changes, 4);

        assert.deepEquals(new RunStore(backend).getData(), store.getData());
    });

    it('keeps the run in progress when saving another run', () => {
        const store = new RunStore(createMemoryBackend());
        store.startRun(active);
        store.saveRun({
            run: run51,
        });
        assert.deepEquals(store.getData().activeRun, active);
    });

    it('updates the run in progress, and ignores updates without one', () => {
        const store = new RunStore(createMemoryBackend());
        store.updateActiveRun({
            routeId: 'x',
        });
        assert.isNull(store.getData().activeRun);
        store.startRun(active);
        store.updateActiveRun({
            routeId: 'r1',
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
        });
        assert.strictEquals(store.getData().activeRun?.routeId, 'r1');
        assert.strictEquals(store.getData().activeRun?.recording?.points.length, 1);
        assert.strictEquals(store.getData().activeRun?.startedAt, active.startedAt);
    });

    it('saves, renames and deletes routes without touching runs', () => {
        const store = new RunStore(createMemoryBackend());
        const run = {
            ...run51,
            routeId: 'r1',
            distanceMiles: 3.1,
        };
        store.saveRun({
            run,
        });
        store.saveRoute(testRoute());
        store.saveRoute(
            testRoute({
                id: 'r2',
            }),
        );
        store.saveRoute(
            testRoute({
                name: 'Replaced',
            }),
        );
        assert.strictEquals(store.getData().routes.length, 2);
        store.renameRoute({
            id: 'r2',
            name: 'Hill',
        });
        assert.deepEquals(
            store.getData().routes.map((route) => route.name),
            [
                'Hill',
                'Replaced',
            ],
        );
        store.deleteRoute('r1');
        assert.deepEquals(
            store.getData().routes.map((route) => route.id),
            ['r2'],
        );
        assert.deepEquals(store.getRun('a'), run);
    });

    it('saves settings', () => {
        const store = new RunStore(createMemoryBackend());
        store.setLocation({
            latitude: 1,
            longitude: 2,
            name: 'Home',
        });
        store.setCustomClothing(['Vest']);
        assert.deepEquals(store.getData().settings, {
            location: {
                latitude: 1,
                longitude: 2,
                name: 'Home',
            },
            customClothing: ['Vest'],
        });
    });

    it('imports and reports counts', () => {
        const store = new RunStore(createMemoryBackend());
        assert.deepEquals(
            store.importData({
                runs: [
                    run51,
                    {
                        id: 'bad',
                    },
                ],
            }),
            {
                imported: 1,
                dropped: 1,
                importedWorkouts: 0,
                droppedWorkouts: 0,
            },
        );
        assert.deepEquals(store.getData().runs, [run51]);
    });

    it('runs the workout flow and marks achieved goals', () => {
        const store = new RunStore(createMemoryBackend());
        let notified = 0;
        store.subscribe(() => notified++);
        const active = {
            startedAt: '2026-11-17T13:00:00.000Z',
            isTest: false,
            sets: [
                testSet({
                    variationId: 'full',
                    value: 0,
                }),
            ],
        };
        store.startWorkout(active);
        assert.deepEquals(store.getData().activeWorkout, active);
        store.updateActiveWorkout({
            ...active,
            isTest: true,
        });
        assert.isTrue(store.getData().activeWorkout?.isTest);
        store.cancelWorkout();
        assert.isTrue(store.getData().activeWorkout == null);

        store.saveGoal(
            testGoal({
                id: 'hit',
            }),
        );
        store.saveGoal(
            testGoal({
                id: 'miss',
                target: 99,
            }),
        );
        store.saveGoal(
            testGoal({
                id: 'miss',
                target: 98,
            }),
        );
        assert.strictEquals(store.getData().goals.length, 2);
        store.startWorkout(active);
        const workout = testWorkout({
            id: 'w1',
            sets: [
                testSet({
                    variationId: 'full',
                    value: 20,
                }),
            ],
        });
        store.finishWorkout(workout);
        store.finishWorkout(workout);
        const data = store.getData();
        assert.deepEquals(data.workouts, [workout]);
        assert.isTrue(data.activeWorkout == null);
        assert.strictEquals(
            data.goals.find((goal) => goal.id === 'hit')?.achievedAt,
            workout.startedAt,
        );
        assert.strictEquals(data.goals.find((goal) => goal.id === 'miss')?.achievedAt, null);

        store.deleteWorkout('w1');
        store.deleteGoal('hit');
        assert.deepEquals(store.getData().workouts, []);
        assert.deepEquals(
            store.getData().goals.map((goal) => goal.id),
            ['miss'],
        );
        assert.isTrue(notified > 5);
    });

    it('imports workouts and reports counts', () => {
        const store = new RunStore(createMemoryBackend());
        const workout = testWorkout({
            id: 'w1',
        });
        const result = store.importData({
            workouts: [
                workout,
                {
                    id: 'bad',
                },
            ],
        });
        assert.strictEquals(result.importedWorkouts, 1);
        assert.strictEquals(result.droppedWorkouts, 1);
        assert.deepEquals(store.getData().workouts, [workout]);
    });
});
