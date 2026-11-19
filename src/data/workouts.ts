import {type Run} from './shapes.js';
import {
    type Exercise,
    type Goal,
    type Workout,
    type WorkoutSet,
    measures,
} from './workout-shapes.js';

export const repIncrement = 1;
export const secondsIncrement = 5;
export const graduateAtReps = 15;
export const graduateAtSeconds = 60;
export const nextVariationStartReps = 8;
export const nextVariationStartSeconds = 30;
export const newExerciseFraction = 0.6;
export const defaultRounds = 2;
export const weeklyTarget = 3;
export const retestAfterDays = 28;

const msPerDay = 24 * 60 * 60 * 1000;

export type SuggestedSet = {variationId: string; target: number};

export type Suggestion = {kind: 'test'} | {kind: 'train'; sets: SuggestedSet[]};

/** Oldest first. */
function sortedByStart(workouts: ReadonlyArray<Workout>): Workout[] {
    return workouts.toSorted((first, second) => {
        if (first.startedAt === second.startedAt) {
            return 0;
        }
        return first.startedAt < second.startedAt ? -1 : 1;
    });
}

function variationIndex(exercise: Readonly<Exercise>, variationId: string): number {
    return exercise.variations.findIndex((variation) => variation.id === variationId);
}

/** What to do next for one exercise. */
export function suggestNext({
    exercise,
    workouts,
}: Readonly<{exercise: Readonly<Exercise>; workouts: ReadonlyArray<Workout>}>): Suggestion {
    const newestFirst = sortedByStart(workouts).reverse();
    const isSeconds = exercise.measure === measures.seconds;
    function setsOf(workout: Workout) {
        return workout.sets.filter((set) => set.exerciseId === exercise.id);
    }

    const last = newestFirst.find((workout) => !workout.isTest && setsOf(workout).length > 0);
    if (last) {
        const lastSets = setsOf(last);
        const hitAll = lastSets.every((set) => set.value >= set.target);
        const increment = isSeconds ? secondsIncrement : repIncrement;
        const graduateAt = isSeconds ? graduateAtSeconds : graduateAtReps;
        const nextStart = isSeconds ? nextVariationStartSeconds : nextVariationStartReps;
        return {
            kind: 'train',
            sets: lastSets.map((set) => {
                if (!hitAll) {
                    return {
                        variationId: set.variationId,
                        target: set.target,
                    };
                }
                const raised = set.target + increment;
                const index = variationIndex(exercise, set.variationId);
                const harder = index >= 0 ? exercise.variations[index + 1] : undefined;
                if (raised >= graduateAt && harder) {
                    return {
                        variationId: harder.id,
                        target: nextStart,
                    };
                }
                return {
                    variationId: set.variationId,
                    target: raised,
                };
            }),
        };
    }

    const test = newestFirst.find((workout) => workout.isTest && setsOf(workout).length > 0);
    if (test) {
        const testSets = setsOf(test);
        let best = testSets[0] as WorkoutSet;
        for (const set of testSets) {
            if (set.value > best.value) {
                best = set;
            }
        }
        const scaled = newExerciseFraction * best.value;
        const rounded = isSeconds ? Math.round(scaled / 5) * 5 : Math.round(scaled);
        const target = Math.max(1, rounded);
        return {
            kind: 'train',
            sets: Array.from(
                {
                    length: defaultRounds,
                },
                () => {
                    return {
                        variationId: best.variationId,
                        target,
                    };
                },
            ),
        };
    }

    return {
        kind: 'test',
    };
}

export type GoalProgress = {
    best: number;
    target: number;
    /** 0 to 1, capped. */
    fraction: number;
    achieved: boolean;
};

/** Best single set at the goal's variation or any harder one, against the target. */
export function goalProgress({
    goal,
    exercise,
    workouts,
}: Readonly<{
    goal: Readonly<Goal>;
    exercise: Readonly<Exercise>;
    workouts: ReadonlyArray<Workout>;
}>): GoalProgress {
    const goalIndex = variationIndex(exercise, goal.variationId);
    let best = 0;
    for (const workout of workouts) {
        for (const set of workout.sets) {
            if (
                set.exerciseId === goal.exerciseId &&
                goalIndex >= 0 &&
                variationIndex(exercise, set.variationId) >= goalIndex &&
                set.value > best
            ) {
                best = set.value;
            }
        }
    }
    return {
        best,
        target: goal.target,
        fraction: goal.target > 0 ? Math.min(1, best / goal.target) : 1,
        achieved: best >= goal.target,
    };
}

/** Goals not yet achieved whose progress now is, stamped with `nowIso`. */
export function newlyAchievedGoals({
    goals,
    exercises,
    workouts,
    nowIso,
}: Readonly<{
    goals: ReadonlyArray<Goal>;
    exercises: ReadonlyArray<Exercise>;
    workouts: ReadonlyArray<Workout>;
    nowIso: string;
}>): Goal[] {
    return goals.flatMap((goal) => {
        const exercise = exercises.find((candidate) => candidate.id === goal.exerciseId);
        if (goal.achievedAt != undefined || !exercise) {
            return [];
        }
        return goalProgress({
            goal,
            exercise,
            workouts,
        }).achieved
            ? [
                  {
                      ...goal,
                      achievedAt: nowIso,
                  },
              ]
            : [];
    });
}

/** Runs plus workouts started in `[startMs, endMs)`. */
export function sessionsInRange({
    runs,
    workouts,
    startMs,
    endMs,
}: Readonly<{
    runs: ReadonlyArray<Pick<Run, 'startedAt'>>;
    workouts: ReadonlyArray<Pick<Workout, 'startedAt'>>;
    startMs: number;
    endMs: number;
}>): number {
    return [
        ...runs,
        ...workouts,
    ].filter((session) => {
        const ms = Date.parse(session.startedAt);
        return ms >= startMs && ms < endMs;
    }).length;
}

/** True when there are workouts and the newest test is over `retestAfterDays` old (or none). */
export function retestDue({
    workouts,
    nowMs,
}: Readonly<{workouts: ReadonlyArray<Workout>; nowMs: number}>): boolean {
    if (workouts.length === 0) {
        return false;
    }
    const newest = sortedByStart(workouts.filter((workout) => workout.isTest)).pop();
    return !newest || nowMs - Date.parse(newest.startedAt) > retestAfterDays * msPerDay;
}
