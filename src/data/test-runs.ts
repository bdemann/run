import {type Feeling} from './feelings.js';
import {type Run} from './shapes.js';

/** Builds a valid run for tests; only what a test cares about needs to be given. */
export function testRun(
    overrides: Readonly<Partial<Run> & {temperatureF: number; feeling: Feeling}>,
): Run {
    return {
        id: `run-${overrides.temperatureF}-${overrides.feeling}`,
        startedAt: '2026-11-17T13:00:00.000Z',
        durationMinutes: 30,
        feelsLikeF: null,
        windMph: null,
        clothing: [
            'Shirt',
            'Sweater',
            'Leggings',
            'Shorts',
        ],
        notes: '',
        routeId: null,
        distanceMiles: null,
        activity: 'run',
        kidsFeeling: null,
        kidsClothing: [],
        precipitation: null,
        ...overrides,
    };
}
