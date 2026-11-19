import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {allExercises, builtInExercises} from './exercises.js';
import {measures, type Exercise} from './workout-shapes.js';

describe(allExercises.name, () => {
    it('lists the built-ins in circuit order', () => {
        assert.deepEquals(
            allExercises({
                exercises: [],
            }).map((exercise) => exercise.id),
            [
                'pushup',
                'situp',
                'squat',
                'lunge',
                'row',
            ],
        );
        assert.isTrue(builtInExercises.every((exercise) => exercise.measure === measures.reps));
    });

    it('adds stored exercises and de-duplicates by id', () => {
        const plank = {
            id: 'plank',
            name: 'Plank',
            measure: measures.seconds,
            variations: [
                {
                    id: 'full',
                    name: 'Plank',
                },
            ],
            cues: ['Straight line'],
            unlockedAt: '2026-11-17T13:00:00.000Z',
        };
        const all = allExercises({
            exercises: [
                plank,
                {
                    ...plank,
                    name: 'Again',
                },
                {
                    ...(builtInExercises[0] as Exercise),
                },
            ],
        });
        assert.strictEquals(all.length, 6);
        assert.strictEquals(all[5]?.name, 'Plank');
    });
});
