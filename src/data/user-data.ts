import {removeDuplicates} from '@augment-vir/common';
import {checkShape} from './shape-check.js';
import {
    activeRunShape,
    activeWorkoutShape,
    currentUserDataVersion,
    exerciseShape,
    goalShape,
    locationShape,
    routeShape,
    runShape,
    workoutShape,
    type Exercise,
    type Goal,
    type Route,
    type Run,
    type UserData,
    type Workout,
} from './shapes.js';

export function emptyUserData(): UserData {
    return {
        version: currentUserDataVersion,
        runs: [],
        activeRun: null,
        settings: {
            location: null,
            customClothing: [],
        },
        exercises: [],
        workouts: [],
        goals: [],
        activeWorkout: null,
        routes: [],
    };
}

function field(raw: unknown, key: string): unknown {
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined;
}

function arrayField(raw: unknown, key: string): unknown[] {
    const value = field(raw, key);
    return Array.isArray(value) ? value : [];
}

/** Adds the keys older documents lack (as `null`) so their records still match the shape. */
function withDefaults(raw: unknown, defaults: Readonly<Record<string, unknown>>): unknown {
    return raw && typeof raw === 'object' && !Array.isArray(raw)
        ? {
              ...defaults,
              ...raw,
          }
        : raw;
}

/** Functions so every record gets its own fresh arrays. */
function oldRunDefaults(): Record<string, unknown> {
    return {
        routeId: null,
        distanceMiles: null,
        activity: 'run',
        kidsFeeling: null,
        kidsClothing: [],
        precipitation: null,
    };
}

function oldActiveRunDefaults(): Record<string, unknown> {
    return {
        routeId: null,
        recording: null,
        activity: 'run',
        precipitation: null,
    };
}

/** Result of reading stored or imported data. */
export type ParsedUserData = {
    data: UserData;
    /** How many runs were unreadable and left out. */
    droppedRuns: number;
    /** How many workouts were unreadable and left out. */
    droppedWorkouts: number;
};

/**
 * Reads anything (localStorage, an import file) into valid user data. Never throws: bad runs are
 * dropped one by one and bad settings fall back to defaults, so one broken record never loses the
 * rest.
 */
export function parseUserData(raw: unknown): ParsedUserData {
    const rawRuns = arrayField(raw, 'runs');
    const runs = rawRuns
        .map((run) => withDefaults(run, oldRunDefaults()))
        .filter((run): run is Run => checkShape(run, runShape));
    const rawWorkouts = arrayField(raw, 'workouts');
    const workouts = rawWorkouts.filter((workout): workout is Workout => {
        return checkShape(workout, workoutShape);
    });
    const activeWorkout = field(raw, 'activeWorkout');
    const activeRun = withDefaults(field(raw, 'activeRun'), oldActiveRunDefaults());
    const settings = field(raw, 'settings');
    const location = field(settings, 'location');
    return {
        data: {
            version: currentUserDataVersion,
            runs,
            activeRun: checkShape(activeRun, activeRunShape) ? activeRun : null,
            settings: {
                location: checkShape(location, locationShape) ? location : null,
                customClothing: arrayField(settings, 'customClothing').filter(
                    (item): item is string => typeof item === 'string' && item.trim() !== '',
                ),
            },
            exercises: arrayField(raw, 'exercises').filter((exercise): exercise is Exercise => {
                return checkShape(exercise, exerciseShape);
            }),
            workouts,
            goals: arrayField(raw, 'goals').filter((goal): goal is Goal => {
                return checkShape(goal, goalShape);
            }),
            activeWorkout: checkShape(activeWorkout, activeWorkoutShape) ? activeWorkout : null,
            routes: arrayField(raw, 'routes').filter((route): route is Route => {
                return checkShape(route, routeShape);
            }),
        },
        droppedRuns: rawRuns.length - runs.length,
        droppedWorkouts: rawWorkouts.length - workouts.length,
    };
}

function mergeById<Item extends {id: string}>({
    current,
    imported,
}: Readonly<{current: ReadonlyArray<Item>; imported: ReadonlyArray<Item>}>): Item[] {
    const byId = new Map(
        current.map((item) => {
            return [
                item.id,
                item,
            ];
        }),
    );
    for (const item of imported) {
        byId.set(item.id, item);
    }
    return [...byId.values()];
}

/**
 * Adds imported runs to the current ones. A run with the same id is replaced by the imported copy.
 * Custom clothing is combined; the current location and run in progress are kept (falling back to
 * the imported location when none is set).
 */
export function mergeUserData({
    current,
    imported,
}: Readonly<{current: Readonly<UserData>; imported: Readonly<UserData>}>): UserData {
    const runsById = new Map(
        current.runs.map((run) => {
            return [
                run.id,
                run,
            ];
        }),
    );
    for (const run of imported.runs) {
        runsById.set(run.id, run);
    }
    return {
        version: currentUserDataVersion,
        runs: [...runsById.values()],
        exercises: mergeById({
            current: current.exercises,
            imported: imported.exercises,
        }),
        workouts: mergeById({
            current: current.workouts,
            imported: imported.workouts,
        }),
        goals: mergeById({
            current: current.goals,
            imported: imported.goals,
        }),
        activeWorkout: current.activeWorkout,
        activeRun: current.activeRun,
        routes: mergeById({
            current: current.routes,
            imported: imported.routes,
        }),
        settings: {
            location: current.settings.location ?? imported.settings.location,
            customClothing: removeDuplicates([
                ...current.settings.customClothing,
                ...imported.settings.customClothing,
            ]),
        },
    };
}

/** `run-log-2026-11-17.json`, from a UTC ISO time. */
export function exportFilename(nowIso: string): string {
    return `run-log-${nowIso.slice(0, 10)}.json`;
}
