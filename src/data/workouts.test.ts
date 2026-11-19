import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {builtInExercises} from './exercises.js';
import {testGoal, testSet, testWorkout} from './test-workouts.js';
import {measures, type Exercise} from './workout-shapes.js';
import {
    goalProgress,
    newlyAchievedGoals,
    retestDue,
    sessionsInRange,
    suggestNext,
} from './workouts.js';

const pushup = builtInExercises[0] as Exercise;
const plank: Exercise = {
    id: 'plank',
    name: 'Plank',
    measure: measures.seconds,
    variations: [
        {
            id: 'knee',
            name: 'Knee plank',
        },
        {
            id: 'full',
            name: 'Plank',
        },
    ],
    cues: [],
    unlockedAt: null,
};

const t1 = '2026-11-01T10:00:00.000Z';
const t2 = '2026-11-08T10:00:00.000Z';
const t3 = '2026-11-15T10:00:00.000Z';

describe(suggestNext.name, () => {
    it('asks for a test with no history', () => {
        assert.deepEquals(
            suggestNext({
                exercise: pushup,
                workouts: [],
            }),
            {
                kind: 'test',
            },
        );
        assert.deepEquals(
            suggestNext({
                exercise: pushup,
                workouts: [
                    testWorkout({
                        id: 'a',
                        sets: [
                            testSet({
                                exerciseId: 'squat',
                                value: 5,
                            }),
                        ],
                    }),
                ],
            }),
            {
                kind: 'test',
            },
        );
    });

    it('starts from a test at 60% of the best set, in 2 rounds', () => {
        const result = suggestNext({
            exercise: pushup,
            workouts: [
                testWorkout({
                    id: 'a',
                    isTest: true,
                    sets: [
                        testSet({
                            value: 10,
                            variationId: 'wall',
                        }),
                        testSet({
                            value: 20,
                            variationId: 'knee',
                        }),
                    ],
                }),
            ],
        });
        assert.deepEquals(result, {
            kind: 'train',
            sets: [
                {
                    variationId: 'knee',
                    target: 12,
                },
                {
                    variationId: 'knee',
                    target: 12,
                },
            ],
        });
    });

    it('never starts below 1, and rounds seconds to 5', () => {
        assert.deepEquals(
            suggestNext({
                exercise: pushup,
                workouts: [
                    testWorkout({
                        id: 'b',
                        isTest: true,
                        sets: [
                            testSet({
                                value: 0,
                            }),
                        ],
                    }),
                ],
            }),
            {
                kind: 'train',
                sets: [
                    {
                        variationId: 'knee',
                        target: 1,
                    },
                    {
                        variationId: 'knee',
                        target: 1,
                    },
                ],
            },
        );
        assert.deepEquals(
            suggestNext({
                exercise: plank,
                workouts: [
                    testWorkout({
                        id: 'a',
                        isTest: true,
                        sets: [
                            testSet({
                                exerciseId: 'plank',
                                value: 33,
                            }),
                        ],
                    }),
                ],
            }),
            {
                kind: 'train',
                sets: [
                    {
                        variationId: 'knee',
                        target: 20,
                    },
                    {
                        variationId: 'knee',
                        target: 20,
                    },
                ],
            },
        );
    });

    it('raises targets after every set hit, using the newest non-test workout', () => {
        const result = suggestNext({
            exercise: pushup,
            workouts: [
                testWorkout({
                    id: 'newer',
                    startedAt: t3,
                    sets: [
                        testSet({
                            value: 11,
                            target: 10,
                        }),
                        testSet({
                            value: 10,
                            target: 10,
                        }),
                        testSet({
                            exerciseId: 'squat',
                            value: 1,
                        }),
                    ],
                }),
                testWorkout({
                    id: 'older',
                    startedAt: t1,
                    sets: [
                        testSet({
                            value: 1,
                            target: 1,
                        }),
                    ],
                }),
                testWorkout({
                    id: 'same',
                    startedAt: t1,
                    sets: [
                        testSet({
                            value: 1,
                            target: 1,
                        }),
                    ],
                }),
                testWorkout({
                    id: 'test',
                    startedAt: '2026-11-20T10:00:00.000Z',
                    isTest: true,
                    sets: [
                        testSet({
                            value: 50,
                        }),
                    ],
                }),
            ],
        });
        assert.deepEquals(result, {
            kind: 'train',
            sets: [
                {
                    variationId: 'knee',
                    target: 11,
                },
                {
                    variationId: 'knee',
                    target: 11,
                },
            ],
        });
    });

    it('repeats unchanged when a target was missed', () => {
        const result = suggestNext({
            exercise: pushup,
            workouts: [
                testWorkout({
                    id: 'a',
                    sets: [
                        testSet({
                            value: 10,
                        }),
                        testSet({
                            value: 9,
                        }),
                    ],
                }),
            ],
        });
        assert.deepEquals(result, {
            kind: 'train',
            sets: [
                {
                    variationId: 'knee',
                    target: 10,
                },
                {
                    variationId: 'knee',
                    target: 10,
                },
            ],
        });
    });

    it('graduates to the next variation, but not past the last', () => {
        function last(variationId: string, target: number, exercise: Exercise) {
            return suggestNext({
                exercise,
                workouts: [
                    testWorkout({
                        id: 'a',
                        sets: [
                            testSet({
                                exerciseId: exercise.id,
                                variationId,
                                target,
                                value: target,
                            }),
                        ],
                    }),
                ],
            });
        }
        assert.deepEquals(last('knee', 14, pushup), {
            kind: 'train',
            sets: [
                {
                    variationId: 'full',
                    target: 8,
                },
            ],
        });
        assert.deepEquals(last('decline', 14, pushup), {
            kind: 'train',
            sets: [
                {
                    variationId: 'decline',
                    target: 15,
                },
            ],
        });
        assert.deepEquals(last('mystery', 14, pushup), {
            kind: 'train',
            sets: [
                {
                    variationId: 'mystery',
                    target: 15,
                },
            ],
        });
        assert.deepEquals(last('knee', 55, plank), {
            kind: 'train',
            sets: [
                {
                    variationId: 'full',
                    target: 30,
                },
            ],
        });
        assert.deepEquals(last('knee', 50, plank), {
            kind: 'train',
            sets: [
                {
                    variationId: 'knee',
                    target: 55,
                },
            ],
        });
    });
});

describe(goalProgress.name, () => {
    const workouts = [
        testWorkout({
            id: 'a',
            sets: [
                testSet({
                    variationId: 'knee',
                    value: 30,
                }),
                testSet({
                    variationId: 'full',
                    value: 12,
                }),
                testSet({
                    variationId: 'decline',
                    value: 15,
                }),
                testSet({
                    exerciseId: 'squat',
                    variationId: 'full',
                    value: 99,
                }),
            ],
        }),
    ];

    it('uses the best set at the goal variation or harder', () => {
        assert.deepEquals(
            goalProgress({
                goal: testGoal(),
                exercise: pushup,
                workouts,
            }),
            {
                best: 15,
                target: 20,
                fraction: 0.75,
                achieved: false,
            },
        );
    });

    it('caps the fraction and reports achieved', () => {
        const result = goalProgress({
            goal: testGoal({
                target: 10,
            }),
            exercise: pushup,
            workouts,
        });
        assert.strictEquals(result.fraction, 1);
        assert.isTrue(result.achieved);
    });

    it('handles no workouts, an unknown variation and a zero target', () => {
        assert.strictEquals(
            goalProgress({
                goal: testGoal(),
                exercise: pushup,
                workouts: [],
            }).best,
            0,
        );
        assert.strictEquals(
            goalProgress({
                goal: testGoal({
                    variationId: 'nope',
                }),
                exercise: pushup,
                workouts,
            }).best,
            0,
        );
        const zero = goalProgress({
            goal: testGoal({
                target: 0,
            }),
            exercise: pushup,
            workouts: [],
        });
        assert.strictEquals(zero.fraction, 1);
        assert.isTrue(zero.achieved);
    });
});

describe(newlyAchievedGoals.name, () => {
    it('stamps newly achieved goals only', () => {
        const workouts = [
            testWorkout({
                id: 'a',
                sets: [
                    testSet({
                        variationId: 'full',
                        value: 20,
                    }),
                ],
            }),
        ];
        const result = newlyAchievedGoals({
            goals: [
                testGoal({
                    id: 'new',
                }),
                testGoal({
                    id: 'done',
                    achievedAt: t1,
                }),
                testGoal({
                    id: 'far',
                    target: 99,
                }),
                testGoal({
                    id: 'orphan',
                    exerciseId: 'gone',
                }),
            ],
            exercises: [pushup],
            workouts,
            nowIso: t3,
        });
        assert.deepEquals(result, [
            testGoal({
                id: 'new',
                achievedAt: t3,
            }),
        ]);
    });
});

describe(sessionsInRange.name, () => {
    it('counts runs and workouts in a half-open range', () => {
        const count = sessionsInRange({
            runs: [
                {
                    startedAt: t1,
                },
                {
                    startedAt: t2,
                },
            ],
            workouts: [
                {
                    startedAt: t3,
                },
                {
                    startedAt: '2026-10-31T10:00:00.000Z',
                },
            ],
            startMs: Date.parse(t1),
            endMs: Date.parse(t3),
        });
        assert.strictEquals(count, 2);
    });
});

describe(retestDue.name, () => {
    const now = Date.parse(t3);
    it('is false with no workouts', () => {
        assert.isFalse(
            retestDue({
                workouts: [],
                nowMs: now,
            }),
        );
    });
    it('is true with workouts but no test', () => {
        assert.isTrue(
            retestDue({
                workouts: [
                    testWorkout({
                        id: 'a',
                    }),
                ],
                nowMs: now,
            }),
        );
    });
    it('compares the newest test to 28 days', () => {
        const tests = [
            testWorkout({
                id: 'old',
                isTest: true,
                startedAt: '2026-01-01T00:00:00.000Z',
            }),
            testWorkout({
                id: 'recent',
                isTest: true,
                startedAt: '2026-10-18T10:00:00.000Z',
            }),
        ];
        assert.isFalse(
            retestDue({
                workouts: tests,
                nowMs: now,
            }),
        );
        assert.isTrue(
            retestDue({
                workouts: tests,
                nowMs: now + 1,
            }),
        );
    });
});
