import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {feelings} from './feelings.js';
import {createMemoryBackend, RunStore} from './run-store.js';
import {testRun} from './test-runs.js';
import {emptyUserData} from './user-data.js';

const run51 = testRun({
    id: 'a',
    temperatureF: 51,
    feeling: feelings.coldOk,
});

const active = {
    startedAt: '2026-11-17T13:00:00.000Z',
    temperatureF: 51,
    feelsLikeF: 48,
    windMph: 3,
};

describe(RunStore.name, () => {
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
            },
        );
        assert.deepEquals(store.getData().runs, [run51]);
    });
});
