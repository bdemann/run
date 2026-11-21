import {type Route} from './shapes.js';

/** Builds a valid route for tests. */
export function testRoute(overrides: Readonly<Partial<Route>> = {}): Route {
    return {
        id: 'r1',
        name: 'River loop',
        distanceMiles: 3.1,
        points: [
            {
                latitude: 40,
                longitude: -105,
            },
            {
                latitude: 40.01,
                longitude: -105,
            },
        ],
        createdAt: '2026-11-17T13:00:00.000Z',
        ...overrides,
    };
}
