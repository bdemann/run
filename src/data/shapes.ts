import {defineShape, enumShape, nullableShape} from 'object-shape-tester';
import {activities} from './activities.js';
import {feelings} from './feelings.js';
import {intensities, precipitationKinds} from './precipitation.js';
import {activeWorkoutShape, exerciseShape, goalShape, workoutShape} from './workout-shapes.js';

export * from './workout-shapes.js';

/** Bump this and add a migration in `user-data.ts` for every breaking change to the stored data. */
export const currentUserDataVersion = 1;

export const feelingShape = enumShape(feelings);

export const activityShape = enumShape(activities);

export const precipitationShape = defineShape({
    kind: enumShape(precipitationKinds),
    intensity: enumShape(intensities),
});

/** Where the temperature is looked up. */
export const locationShape = defineShape({
    latitude: 0,
    longitude: 0,
    /** What to show the person, e.g. "Provo, Utah". */
    name: '',
});

export type RunLocation = typeof locationShape.runtimeType;

/** A saved route point, used only to draw the route. */
export const routePointShape = defineShape({
    latitude: 0,
    longitude: 0,
});

export type RoutePoint = typeof routePointShape.runtimeType;

/**
 * A route recorded once with GPS and saved with a name. PRIVACY: points are precise locations and
 * never leave the device (except in the export file the person saves).
 */
export const routeShape = defineShape({
    id: '',
    name: '',
    distanceMiles: 0,
    /** Simplified track (`simplifyPoints`). */
    points: [routePointShape],
    /** UTC ISO string. */
    createdAt: '',
});

export type Route = typeof routeShape.runtimeType;

/** One GPS fix kept while recording. */
export const recordedPointShape = defineShape({
    latitude: 0,
    longitude: 0,
    accuracyM: 0,
    /** `Date.now()` when the fix arrived. */
    atMs: 0,
});

export type RecordedPoint = typeof recordedPointShape.runtimeType;

/** One finished run or walk (see `activity`). */
export const runShape = defineShape({
    /** Stable id (a UUID). */
    id: '',
    /** UTC ISO string. */
    startedAt: '',
    durationMinutes: nullableShape(0),
    /** Air temperature in °F. Advice matches runs on this, rounded. */
    temperatureF: 0,
    feelsLikeF: nullableShape(0),
    windMph: nullableShape(0),
    /** Clothing item names, e.g. "Shorts", "Sweater". */
    clothing: [''],
    feeling: feelingShape,
    notes: '',
    /** Added later: old runs lack these keys (parsing fills `null`). */
    routeId: nullableShape(''),
    distanceMiles: nullableShape(0),
    /** Added later: old runs lack these keys (parsing fills `run`, `null` and `[]`). */
    activity: activityShape,
    /** How the kids felt on a walk. Runs always have `null`. */
    kidsFeeling: nullableShape(feelingShape),
    /** What the kids wore on a walk. Runs always have `[]`. */
    kidsClothing: [''],
    /** Added later: old runs lack this key (parsing fills `null`). `null` means not known. */
    precipitation: nullableShape(precipitationShape),
});

export type Run = typeof runShape.runtimeType;

/** A run in progress: started, not finished. Weather is what it was at the start. */
export const activeRunShape = defineShape({
    /** Added later: old documents lack this key (parsing fills `run`). */
    activity: activityShape,
    startedAt: '',
    temperatureF: nullableShape(0),
    feelsLikeF: nullableShape(0),
    windMph: nullableShape(0),
    /** Added later: old documents lack this key (parsing fills `null`). */
    precipitation: nullableShape(precipitationShape),
    /** Added later: old documents lack these keys (parsing fills `null`). */
    routeId: nullableShape(''),
    /** Set while a route is being recorded; survives the app being swiped away. */
    recording: nullableShape({
        points: [recordedPointShape],
    }),
});

export type ActiveRun = typeof activeRunShape.runtimeType;

export const settingsShape = defineShape({
    location: nullableShape(locationShape),
    /** Clothing items the person added beyond the built-in list. */
    customClothing: [''],
});

export type Settings = typeof settingsShape.runtimeType;

/** Everything the app stores. Also the export/import file format. */
export const userDataShape = defineShape({
    version: 0,
    runs: [runShape],
    activeRun: nullableShape(activeRunShape),
    settings: settingsShape,
    /** Exercises beyond the built-ins (`exercises.ts`). */
    exercises: [exerciseShape],
    workouts: [workoutShape],
    goals: [goalShape],
    activeWorkout: nullableShape(activeWorkoutShape),
    routes: [routeShape],
});

export type UserData = typeof userDataShape.runtimeType;
