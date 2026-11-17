import {defineShape, enumShape, nullableShape} from 'object-shape-tester';
import {feelings} from './feelings.js';

/** Bump this and add a migration in `user-data.ts` for every breaking change to the stored data. */
export const currentUserDataVersion = 1;

export const feelingShape = enumShape(feelings);

/** Where the temperature is looked up. */
export const locationShape = defineShape({
    latitude: 0,
    longitude: 0,
    /** What to show the person, e.g. "Provo, Utah". */
    name: '',
});

export type RunLocation = typeof locationShape.runtimeType;

/** One finished run. */
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
});

export type Run = typeof runShape.runtimeType;

/** A run in progress: started, not finished. Weather is what it was at the start. */
export const activeRunShape = defineShape({
    startedAt: '',
    temperatureF: nullableShape(0),
    feelsLikeF: nullableShape(0),
    windMph: nullableShape(0),
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
});

export type UserData = typeof userDataShape.runtimeType;
