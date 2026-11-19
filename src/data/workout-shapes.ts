import {defineShape, enumShape, nullableShape} from 'object-shape-tester';

export const measures = {
    reps: 'reps',
    seconds: 'seconds',
} as const;

export type Measure = (typeof measures)[keyof typeof measures];

export const measureShape = enumShape(measures);

/** One exercise. Built-ins live in code (`exercises.ts`); stored ones come from unlocking later. */
export const exerciseShape = defineShape({
    id: '',
    name: '',
    measure: measureShape,
    /** Easiest to hardest. Ids are stored in workouts; never rename them. */
    variations: [
        {
            id: '',
            name: '',
        },
    ],
    /** 2-3 short form cues. */
    cues: [''],
    /** UTC ISO; null for built-ins. */
    unlockedAt: nullableShape(''),
});

export type Exercise = typeof exerciseShape.runtimeType;

export const workoutSetShape = defineShape({
    exerciseId: '',
    variationId: '',
    target: 0,
    value: 0,
});

export type WorkoutSet = typeof workoutSetShape.runtimeType;

/** One finished workout. */
export const workoutShape = defineShape({
    id: '',
    /** UTC ISO string. */
    startedAt: '',
    sets: [workoutSetShape],
    /** A baseline or retest: one max-effort set per exercise. */
    isTest: false,
});

export type Workout = typeof workoutShape.runtimeType;

/** A workout in progress. */
export const activeWorkoutShape = defineShape({
    startedAt: '',
    isTest: false,
    sets: [workoutSetShape],
});

export type ActiveWorkout = typeof activeWorkoutShape.runtimeType;

export const goalShape = defineShape({
    id: '',
    exerciseId: '',
    variationId: '',
    target: 0,
    createdAt: '',
    deadline: nullableShape(''),
    achievedAt: nullableShape(''),
});

export type Goal = typeof goalShape.runtimeType;
