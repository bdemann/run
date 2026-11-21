import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {
    acceptPoint,
    formatMiles,
    haversineMiles,
    paceText,
    routeSvgPath,
    simplifyPoints,
    trackDistanceMiles,
} from './gps.js';
import {type RecordedPoint} from './shapes.js';

function fix(overrides: Partial<RecordedPoint> = {}): RecordedPoint {
    return {
        latitude: 40,
        longitude: -105,
        accuracyM: 5,
        atMs: 0,
        ...overrides,
    };
}

/** One degree of latitude is about 69.09 miles. */
const degreesPerMile = 1 / 69.09;

describe(haversineMiles.name, () => {
    it('measures a degree of latitude', () => {
        const miles = haversineMiles({
            a: {
                latitude: 40,
                longitude: -105,
            },
            b: {
                latitude: 41,
                longitude: -105,
            },
        });
        assert.isTrue(Math.abs(miles - 69.09) < 0.1);
    });

    it('is zero for the same point', () => {
        assert.strictEquals(
            haversineMiles({
                a: fix(),
                b: fix(),
            }),
            0,
        );
    });
});

describe(acceptPoint.name, () => {
    const first = fix();
    it('accepts the first accurate point and rejects a poor one', () => {
        assert.isTrue(
            acceptPoint({
                previous: undefined,
                point: first,
            }),
        );
        assert.isFalse(
            acceptPoint({
                previous: undefined,
                point: fix({
                    accuracyM: 26,
                }),
            }),
        );
    });

    it('rejects jitter, accepts real moves and rejects jumps', () => {
        assert.isFalse(
            acceptPoint({
                previous: first,
                point: fix({
                    latitude: 40.00002,
                    atMs: 5000,
                }),
            }),
        );
        /** 0.01 mile in 5 s is 7 mph. */
        assert.isTrue(
            acceptPoint({
                previous: first,
                point: fix({
                    latitude: 40 + 0.01 * degreesPerMile,
                    atMs: 5000,
                }),
            }),
        );
        /** 0.1 mile in 5 s is 72 mph. */
        assert.isFalse(
            acceptPoint({
                previous: first,
                point: fix({
                    latitude: 40 + 0.1 * degreesPerMile,
                    atMs: 5000,
                }),
            }),
        );
    });

    it('rejects a move with no elapsed time', () => {
        assert.isFalse(
            acceptPoint({
                previous: first,
                point: fix({
                    latitude: 40.001,
                }),
            }),
        );
    });
});

describe(trackDistanceMiles.name, () => {
    it('adds up segments', () => {
        assert.strictEquals(trackDistanceMiles([fix()]), 0);
        const miles = trackDistanceMiles([
            fix(),
            fix({
                latitude: 40 + degreesPerMile,
            }),
            fix({
                latitude: 40 + 2 * degreesPerMile,
            }),
        ]);
        assert.isTrue(Math.abs(miles - 2) < 0.01);
    });
});

describe(simplifyPoints.name, () => {
    const wiggle = Array.from(
        {
            length: 1000,
        },
        (_item, index) => {
            return {
                latitude: 40 + index * 0.0001,
                longitude: -105 + (index % 2) * 0.00001,
            };
        },
    );
    const circle = Array.from(
        {
            length: 1000,
        },
        (_item, index) => {
            return {
                latitude: 40 + 0.01 * Math.sin((index / 1000) * 2 * Math.PI),
                longitude: -105 + 0.01 * Math.cos((index / 1000) * 2 * Math.PI),
            };
        },
    );

    it('returns short tracks as they are, without extra keys', () => {
        assert.deepEquals(simplifyPoints([fix()]), [
            {
                latitude: 40,
                longitude: -105,
            },
        ]);
    });

    it('reduces a nearly straight track to its ends', () => {
        const result = simplifyPoints(wiggle);
        assert.strictEquals(result.length, 2);
        assert.deepEquals(result[0], wiggle[0]);
        assert.deepEquals(result[1], wiggle[999]);
    });

    it('keeps the shape of a loop within the limit', () => {
        const result = simplifyPoints(circle, 50);
        assert.isTrue(result.length > 8 && result.length <= 50);
        assert.deepEquals(result[0], circle[0]);
        assert.deepEquals(result.at(-1), circle[999]);
        assert.isTrue(simplifyPoints(circle, 400).length <= 400);
    });

    it('handles a track that returns to its start', () => {
        const loop = Array.from(
            {
                length: 5,
            },
            (_item, index) => {
                return fix({
                    latitude: index === 2 ? 40.01 : 40,
                });
            },
        );
        assert.strictEquals(simplifyPoints(loop, 3).length, 3);
    });
});

describe(paceText.name, () => {
    it('formats minutes per mile', () => {
        assert.strictEquals(
            paceText({
                distanceMiles: 3.1,
                durationMinutes: 29.5,
            }),
            '9:31 /mi',
        );
        assert.strictEquals(
            paceText({
                distanceMiles: 1,
                durationMinutes: 8,
            }),
            '8:00 /mi',
        );
    });

    it('is empty when unknown', () => {
        for (const [
            distanceMiles,
            durationMinutes,
        ] of [
            [
                null,
                30,
            ],
            [
                3,
                null,
            ],
            [
                0,
                30,
            ],
            [
                3,
                0,
            ],
            [
                undefined,
                undefined,
            ],
            [
                -1,
                30,
            ],
        ] as const) {
            assert.strictEquals(
                paceText({
                    distanceMiles,
                    durationMinutes,
                }),
                '',
            );
        }
    });
});

describe(formatMiles.name, () => {
    it('uses two decimals under 10 miles', () => {
        assert.strictEquals(formatMiles(3.1), '3.10 mi');
        assert.strictEquals(formatMiles(12.34), '12.3 mi');
    });
});

describe(routeSvgPath.name, () => {
    it('is empty for fewer than two points', () => {
        assert.strictEquals(routeSvgPath([fix()], 100), '');
    });

    it('fits the track in the box, north up, and centers it', () => {
        const path = routeSvgPath(
            [
                fix(),
                fix({
                    latitude: 40.01,
                }),
            ],
            100,
        );
        /** A vertical line: south end at the bottom, north at the top, centered in x. */
        assert.strictEquals(path, '50.0,92.0 50.0,8.0');
    });

    it('scales longitude by cos(latitude)', () => {
        const path = routeSvgPath(
            [
                fix({
                    latitude: 60,
                }),
                fix({
                    latitude: 60,
                    longitude: -104,
                }),
            ],
            100,
        );
        assert.strictEquals(path, '8.0,50.0 92.0,50.0');
    });

    it('does not divide by zero for identical points', () => {
        assert.strictEquals(
            routeSvgPath(
                [
                    fix(),
                    fix(),
                ],
                100,
            ),
            '50.0,50.0 50.0,50.0',
        );
    });
});
