import {allExercises} from './exercises.js';
import {type UserData} from './shapes.js';
import {
    measures,
    type ActiveWorkout,
    type Exercise,
    type Goal,
    type Measure,
    type Workout,
} from './workout-shapes.js';
import {suggestNext} from './workouts.js';

type PlanData = Readonly<Pick<UserData, 'exercises' | 'workouts'>>;

/** The variation last used for an exercise (newest workout wins), else the easiest. */
export function currentVariationId({
    exercise,
    workouts,
}: Readonly<{exercise: Readonly<Exercise>; workouts: ReadonlyArray<Workout>}>): string {
    const newestFirst = workouts.toSorted((first, second) => {
        return first.startedAt < second.startedAt ? 1 : -1;
    });
    for (const workout of newestFirst) {
        const set = workout.sets.find((candidate) => candidate.exerciseId === exercise.id);
        if (set && exercise.variations.some((variation) => variation.id === set.variationId)) {
            return set.variationId;
        }
    }
    return exercise.variations[0]?.id ?? '';
}

/**
 * True when no exercise has been trained or tested yet, so the first workout is a baseline. An
 * exercise skipped in the baseline is picked up at the next retest, not by forcing another
 * baseline.
 */
export function needsBaseline(data: PlanData): boolean {
    return allExercises(data).every((exercise) => {
        return (
            suggestNext({
                exercise,
                workouts: data.workouts,
            }).kind === 'test'
        );
    });
}

/** A new workout with every set pre-filled at `value: 0`. */
export function planWorkout({
    data,
    isTest,
    startedAt,
}: Readonly<{data: PlanData; isTest: boolean; startedAt: string}>): ActiveWorkout {
    return {
        startedAt,
        isTest,
        sets: allExercises(data).flatMap((exercise) => {
            if (isTest) {
                return [
                    {
                        exerciseId: exercise.id,
                        variationId: currentVariationId({
                            exercise,
                            workouts: data.workouts,
                        }),
                        target: 0,
                        value: 0,
                    },
                ];
            }
            const suggestion = suggestNext({
                exercise,
                workouts: data.workouts,
            });
            if (suggestion.kind === 'test') {
                return [];
            }
            return suggestion.sets.map((set) => {
                return {
                    exerciseId: exercise.id,
                    variationId: set.variationId,
                    target: set.target,
                    value: 0,
                };
            });
        }),
    };
}

/** Only the sets done (`value > 0`). */
export function finishedWorkout({
    active,
    id,
}: Readonly<{active: Readonly<ActiveWorkout>; id: string}>): Workout {
    return {
        id,
        startedAt: active.startedAt,
        isTest: active.isTest,
        sets: active.sets.filter((set) => set.value > 0),
    };
}

/** "Pushup 11 · Squat 13": next time's first-set target for each exercise. */
export function describeNextTime(data: PlanData): string {
    return allExercises(data)
        .flatMap((exercise) => {
            const suggestion = suggestNext({
                exercise,
                workouts: data.workouts,
            });
            const first = suggestion.kind === 'train' ? suggestion.sets[0] : undefined;
            return first ? [`${exercise.name} ${first.target}`] : [];
        })
        .join(' · ');
}

/** "Knee pushup, 20" for a goal. */
export function describeGoal({
    goal,
    data,
}: Readonly<{goal: Readonly<Goal>; data: PlanData}>): string {
    const exercise = allExercises(data).find((candidate) => candidate.id === goal.exerciseId);
    const variation = exercise?.variations.find((candidate) => candidate.id === goal.variationId);
    return `${variation?.name ?? exercise?.name ?? goal.exerciseId}, ${goal.target}`;
}

/** Goals that were open in `before` and are achieved in `after`. */
export function goalsReachedBetween({
    before,
    after,
}: Readonly<{before: ReadonlyArray<Goal>; after: ReadonlyArray<Goal>}>): Goal[] {
    return after.filter((goal) => {
        return (
            goal.achievedAt != undefined &&
            before.some((old) => old.id === goal.id && old.achievedAt == undefined)
        );
    });
}

/** Total sets in a workout. */
export function totalSets(workout: Readonly<Pick<Workout, 'sets'>>): number {
    return workout.sets.length;
}

/** One exercise's part of a saved workout. */
export type ExerciseSummary = {
    exerciseId: string;
    /** The exercise name, or the id when the exercise is unknown. */
    name: string;
    /** The first set's variation name, or '' when unknown. */
    variationName: string;
    /** 'reps' when the exercise is unknown. */
    measure: Measure;
    /** Each set's value, in order. */
    values: number[];
    total: number;
};

/** Groups a workout's sets by exercise, in order of first appearance. */
export function summarizeWorkout({
    workout,
    data,
}: Readonly<{workout: Readonly<Pick<Workout, 'sets'>>; data: PlanData}>): ExerciseSummary[] {
    const exercises = allExercises(data);
    const summaries: ExerciseSummary[] = [];
    for (const set of workout.sets) {
        let summary = summaries.find((candidate) => candidate.exerciseId === set.exerciseId);
        if (!summary) {
            const exercise = exercises.find((candidate) => candidate.id === set.exerciseId);
            summary = {
                exerciseId: set.exerciseId,
                name: exercise?.name ?? set.exerciseId,
                variationName:
                    exercise?.variations.find((variation) => variation.id === set.variationId)
                        ?.name ?? '',
                measure: exercise?.measure ?? measures.reps,
                values: [],
                total: 0,
            };
            summaries.push(summary);
        }
        summary.values.push(set.value);
        summary.total += set.value;
    }
    return summaries;
}
