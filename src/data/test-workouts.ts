import {type Goal, type Workout, type WorkoutSet} from './workout-shapes.js';

/** Builds a set for tests. */
export function testSet(overrides: Readonly<Partial<WorkoutSet> & {value: number}>): WorkoutSet {
    return {
        exerciseId: 'pushup',
        variationId: 'knee',
        target: 10,
        ...overrides,
    };
}

/** Builds a valid workout for tests; only what a test cares about needs to be given. */
export function testWorkout(overrides: Readonly<Partial<Workout> & {id: string}>): Workout {
    return {
        startedAt: '2026-11-17T13:00:00.000Z',
        isTest: false,
        sets: [],
        ...overrides,
    };
}

/** Builds a valid goal for tests. */
export function testGoal(overrides: Readonly<Partial<Goal>> = {}): Goal {
    return {
        id: 'g',
        exerciseId: 'pushup',
        variationId: 'full',
        target: 20,
        createdAt: '2026-11-01T13:00:00.000Z',
        deadline: null,
        achievedAt: null,
        ...overrides,
    };
}
