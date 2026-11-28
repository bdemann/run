import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {builtInExercises} from './exercises.js';
import {testGoal, testSet, testWorkout} from './test-workouts.js';
import {
    currentVariationId,
    describeGoal,
    describeNextTime,
    finishedWorkout,
    goalsReachedBetween,
    needsBaseline,
    planWorkout,
    summarizeWorkout,
    totalSets,
    type ExerciseSummary,
} from './workout-plan.js';
import {type Exercise} from './workout-shapes.js';

const pushup = builtInExercises[0] as Exercise;

function fullTest() {
    return testWorkout({
        id: 't',
        isTest: true,
        sets: builtInExercises.map((exercise) => {
            return testSet({
                exerciseId: exercise.id,
                variationId: exercise.variations[0]?.id ?? '',
                target: 0,
                value: 10,
            });
        }),
    });
}

describe(currentVariationId.name, () => {
    it('is the easiest with no history', () => {
        assert.strictEquals(
            currentVariationId({
                exercise: pushup,
                workouts: [],
            }),
            'wall',
        );
    });
    it('is the newest used variation, skipping unknown ones', () => {
        const workouts = [
            testWorkout({
                id: 'a',
                startedAt: '2026-01-01T00:00:00Z',
                sets: [
                    testSet({
                        value: 1,
                        variationId: 'incline',
                    }),
                ],
            }),
            testWorkout({
                id: 'b',
                startedAt: '2026-02-01T00:00:00Z',
                sets: [
                    testSet({
                        value: 1,
                        variationId: 'knee',
                    }),
                ],
            }),
            testWorkout({
                id: 'c',
                startedAt: '2026-03-01T00:00:00Z',
                sets: [
                    testSet({
                        value: 1,
                        variationId: 'gone',
                    }),
                ],
            }),
            testWorkout({
                id: 'd',
                startedAt: '2026-03-01T00:00:00Z',
                sets: [
                    testSet({
                        value: 1,
                        exerciseId: 'squat',
                    }),
                ],
            }),
        ];
        assert.strictEquals(
            currentVariationId({
                exercise: pushup,
                workouts,
            }),
            'knee',
        );
    });
    it('does not depend on the order of workouts', () => {
        const older = testWorkout({
            id: 'o',
            startedAt: '2026-01-01T00:00:00Z',
            sets: [
                testSet({
                    value: 1,
                    variationId: 'incline',
                }),
            ],
        });
        const newer = testWorkout({
            id: 'n',
            startedAt: '2026-02-01T00:00:00Z',
            sets: [
                testSet({
                    value: 1,
                    variationId: 'knee',
                }),
            ],
        });
        assert.strictEquals(
            currentVariationId({
                exercise: pushup,
                workouts: [
                    older,
                    newer,
                ],
            }),
            'knee',
        );
        assert.strictEquals(
            currentVariationId({
                exercise: pushup,
                workouts: [
                    newer,
                    older,
                ],
            }),
            'knee',
        );
    });
    it('is empty for an exercise without variations', () => {
        assert.strictEquals(
            currentVariationId({
                exercise: {
                    ...pushup,
                    variations: [],
                },
                workouts: [],
            }),
            '',
        );
    });
});

describe(needsBaseline.name, () => {
    it('is true only while no exercise has history', () => {
        assert.isTrue(
            needsBaseline({
                exercises: [],
                workouts: [],
            }),
        );
        assert.isFalse(
            needsBaseline({
                exercises: [],
                workouts: [fullTest()],
            }),
        );
        assert.isFalse(
            needsBaseline({
                exercises: [],
                workouts: [
                    testWorkout({
                        id: 'partial',
                        isTest: true,
                        sets: [
                            testSet({
                                exerciseId: pushup.id,
                                variationId: 'knee',
                                target: 0,
                                value: 12,
                            }),
                        ],
                    }),
                ],
            }),
        );
    });
});

describe(planWorkout.name, () => {
    it('plans one zero-target set per exercise for a test', () => {
        const plan = planWorkout({
            data: {
                exercises: [],
                workouts: [],
            },
            isTest: true,
            startedAt: 's',
        });
        assert.isTrue(plan.isTest);
        assert.strictEquals(plan.sets.length, builtInExercises.length);
        assert.isTrue(plan.sets.every((set) => set.target === 0 && set.value === 0));
    });
    it('plans suggested sets for training, in circuit order', () => {
        const plan = planWorkout({
            data: {
                exercises: [],
                workouts: [fullTest()],
            },
            isTest: false,
            startedAt: 's',
        });
        assert.strictEquals(plan.sets.length, builtInExercises.length * 2);
        assert.deepEquals(
            plan.sets.slice(0, 1).map((set) => {
                return [
                    set.exerciseId,
                    set.target,
                ];
            }),
            [
                [
                    'pushup',
                    6,
                ],
            ],
        );
        assert.isTrue(plan.sets.every((set) => set.value === 0));
    });
    it('skips exercises without history when training', () => {
        const partial = testWorkout({
            id: 'p',
            isTest: true,
            sets: [
                testSet({
                    value: 10,
                    target: 0,
                }),
            ],
        });
        const plan = planWorkout({
            data: {
                exercises: [],
                workouts: [partial],
            },
            isTest: false,
            startedAt: 's',
        });
        assert.isTrue(plan.sets.every((set) => set.exerciseId === 'pushup'));
    });
});

describe(finishedWorkout.name, () => {
    it('keeps only sets that were done', () => {
        const workout = finishedWorkout({
            id: 'x',
            active: {
                startedAt: 's',
                isTest: false,
                sets: [
                    testSet({
                        value: 0,
                    }),
                    testSet({
                        value: 4,
                    }),
                ],
            },
        });
        assert.strictEquals(workout.id, 'x');
        assert.strictEquals(workout.sets.length, 1);
        assert.strictEquals(totalSets(workout), 1);
    });
});

describe(describeNextTime.name, () => {
    it('lists the next target per exercise', () => {
        assert.strictEquals(
            describeNextTime({
                exercises: [],
                workouts: [],
            }),
            '',
        );
        assert.strictEquals(
            describeNextTime({
                exercises: [],
                workouts: [fullTest()],
            }),
            'Pushup 6 · Sit-up 6 · Squat 6 · Lunge (per leg) 6 · Row 6',
        );
    });
});

describe(describeGoal.name, () => {
    it('names the variation, the exercise, or the raw id', () => {
        const data = {
            exercises: [],
            workouts: [],
        };
        assert.strictEquals(
            describeGoal({
                goal: testGoal({
                    variationId: 'knee',
                }),
                data,
            }),
            'Knee pushup, 20',
        );
        assert.strictEquals(
            describeGoal({
                goal: testGoal({
                    variationId: 'zzz',
                }),
                data,
            }),
            'Pushup, 20',
        );
        assert.strictEquals(
            describeGoal({
                goal: testGoal({
                    exerciseId: 'zzz',
                }),
                data,
            }),
            'zzz, 20',
        );
    });
});

describe(goalsReachedBetween.name, () => {
    it('finds goals that became achieved', () => {
        const open = testGoal({
            id: 'a',
        });
        const done = testGoal({
            id: 'a',
            achievedAt: 'now',
        });
        const already = testGoal({
            id: 'b',
            achievedAt: 'then',
        });
        assert.deepEquals(
            goalsReachedBetween({
                before: [
                    open,
                    already,
                ],
                after: [
                    done,
                    already,
                ],
            }),
            [done],
        );
        assert.deepEquals(
            goalsReachedBetween({
                before: [open],
                after: [open],
            }),
            [],
        );
    });
});

describe(summarizeWorkout.name, () => {
    const plank: Exercise = {
        id: 'plank',
        name: 'Plank',
        measure: 'seconds',
        variations: [
            {
                id: 'forearm',
                name: 'Forearm plank',
            },
        ],
        cues: [],
    };

    it('groups sets by exercise in order of first appearance', () => {
        const summary = summarizeWorkout({
            workout: testWorkout({
                id: 'w',
                sets: [
                    testSet({
                        exerciseId: 'situp',
                        variationId: 'nope',
                        value: 8,
                    }),
                    testSet({
                        value: 10,
                    }),
                    testSet({
                        exerciseId: 'situp',
                        variationId: 'nope',
                        value: 7,
                    }),
                    testSet({
                        value: 9,
                    }),
                ],
            }),
            data: {
                exercises: [],
                workouts: [],
            },
        });
        assert.deepEquals(
            summary.map((item) => item.exerciseId),
            [
                'situp',
                'pushup',
            ],
        );
        assert.deepEquals(
            (summary[0] as ExerciseSummary).values,
            [
                8,
                7,
            ],
        );
        assert.strictEquals((summary[0] as ExerciseSummary).total, 15);
        assert.strictEquals((summary[1] as ExerciseSummary).total, 19);
        assert.strictEquals((summary[1] as ExerciseSummary).name, 'Pushup');
        assert.strictEquals((summary[1] as ExerciseSummary).variationName, 'Knee pushup');
        assert.strictEquals((summary[0] as ExerciseSummary).variationName, '');
    });

    it('uses the id and reps for an unknown exercise, the real measure for a known one', () => {
        const summary = summarizeWorkout({
            workout: testWorkout({
                id: 'w',
                sets: [
                    testSet({
                        exerciseId: 'ghost',
                        variationId: 'x',
                        value: 3,
                    }),
                    testSet({
                        exerciseId: 'plank',
                        variationId: 'forearm',
                        value: 45,
                    }),
                ],
            }),
            data: {
                exercises: [plank],
                workouts: [],
            },
        });
        assert.strictEquals((summary[0] as ExerciseSummary).name, 'ghost');
        assert.strictEquals((summary[0] as ExerciseSummary).measure, 'reps');
        assert.strictEquals((summary[1] as ExerciseSummary).measure, 'seconds');
        assert.strictEquals((summary[1] as ExerciseSummary).variationName, 'Forearm plank');
    });

    it('is empty for a workout with no sets', () => {
        assert.deepEquals(
            summarizeWorkout({
                workout: testWorkout({
                    id: 'w',
                }),
                data: {
                    exercises: [],
                    workouts: [],
                },
            }),
            [],
        );
    });
});
