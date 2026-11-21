import {type RecordedPoint, type RoutePoint} from './shapes.js';

const earthRadiusMiles = 3958.8;
/** Fixes less accurate than this are ignored. */
export const maxAccuracyM = 25;
/** Moves shorter than this are jitter while standing still. */
export const minMoveMiles = 5 / 1609.344;
/** Implied speeds above this are a GPS jump. */
export const maxSpeedMph = 15;

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two points in miles. */
export function haversineMiles({
    a,
    b,
}: Readonly<{a: Readonly<RoutePoint>; b: Readonly<RoutePoint>}>): number {
    const dLat = toRadians(b.latitude - a.latitude);
    const dLon = toRadians(b.longitude - a.longitude);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Whether a new GPS fix belongs in the track: accurate enough, moved at least a few meters from the
 * last accepted point, and not impossibly fast (a GPS jump).
 */
export function acceptPoint({
    previous,
    point,
}: Readonly<{
    previous: Readonly<RecordedPoint> | undefined;
    point: Readonly<RecordedPoint>;
}>): boolean {
    if (point.accuracyM > maxAccuracyM) {
        return false;
    } else if (!previous) {
        return true;
    }
    const miles = haversineMiles({
        a: previous,
        b: point,
    });
    if (miles < minMoveMiles) {
        return false;
    }
    const hours = (point.atMs - previous.atMs) / 3_600_000;
    return hours > 0 && miles / hours <= maxSpeedMph;
}

/** Total length of a track in miles. */
export function trackDistanceMiles(points: ReadonlyArray<Readonly<RoutePoint>>): number {
    let total = 0;
    for (let index = 1; index < points.length; index++) {
        total += haversineMiles({
            a: points[index - 1] as RoutePoint,
            b: points[index] as RoutePoint,
        });
    }
    return total;
}

/** Distance in miles from `point` to the segment `start`-`end`, on a local flat projection. */
function distanceToSegment({
    point,
    start,
    end,
}: Readonly<{point: RoutePoint; start: RoutePoint; end: RoutePoint}>): number {
    const scale = Math.cos(toRadians(start.latitude));
    const px = (point.longitude - start.longitude) * scale;
    const py = point.latitude - start.latitude;
    const ex = (end.longitude - start.longitude) * scale;
    const ey = end.latitude - start.latitude;
    const lengthSquared = ex * ex + ey * ey;
    const t = lengthSquared ? Math.max(0, Math.min(1, (px * ex + py * ey) / lengthSquared)) : 0;
    const dx = px - t * ex;
    const dy = py - t * ey;
    /** One degree of latitude is about 69.05 miles. */
    return Math.hypot(dx, dy) * 69.05;
}

function keepFarPoints({
    points,
    toleranceMiles,
}: Readonly<{points: ReadonlyArray<RoutePoint>; toleranceMiles: number}>): boolean[] {
    const keep = points.map(() => false);
    keep[0] = true;
    keep[points.length - 1] = true;
    const stack: Array<
        [
            number,
            number,
        ]
    > = [
        [
            0,
            points.length - 1,
        ],
    ];
    while (stack.length) {
        const [
            from,
            to,
        ] = stack.pop() as [
            number,
            number,
        ];
        let farthest = -1;
        let farthestDistance = toleranceMiles;
        for (let index = from + 1; index < to; index++) {
            const distance = distanceToSegment({
                point: points[index] as RoutePoint,
                start: points[from] as RoutePoint,
                end: points[to] as RoutePoint,
            });
            if (distance > farthestDistance) {
                farthest = index;
                farthestDistance = distance;
            }
        }
        if (farthest >= 0) {
            keep[farthest] = true;
            stack.push(
                [
                    from,
                    farthest,
                ],
                [
                    farthest,
                    to,
                ],
            );
        }
    }
    return keep;
}

/**
 * Reduces a track to at most `maxPoints` (first and last always kept) with Douglas-Peucker,
 * doubling the tolerance until it fits. Only latitude and longitude are kept.
 */
export function simplifyPoints(
    points: ReadonlyArray<Readonly<RoutePoint>>,
    maxPoints = 400,
): RoutePoint[] {
    const plain = points.map((point) => {
        return {
            latitude: point.latitude,
            longitude: point.longitude,
        };
    });
    if (plain.length <= 2 || plain.length <= maxPoints) {
        return plain;
    }
    let toleranceMiles = 0.0005;
    for (;;) {
        const keep = keepFarPoints({
            points: plain,
            toleranceMiles,
        });
        const result = plain.filter((_point, index) => keep[index]);
        if (result.length <= maxPoints) {
            return result;
        }
        toleranceMiles *= 2;
    }
}

/** "9:32 /mi", or `''` when distance or duration is unknown or zero. */
export function paceText({
    distanceMiles,
    durationMinutes,
}: Readonly<{
    distanceMiles: number | null | undefined;
    durationMinutes: number | null | undefined;
}>): string {
    if (!distanceMiles || !durationMinutes || distanceMiles <= 0 || durationMinutes <= 0) {
        return '';
    }
    const totalSeconds = Math.round((durationMinutes / distanceMiles) * 60);
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')} /mi`;
}

/** "3.10 mi" (two decimals under 10 miles, else one). */
export function formatMiles(miles: number): string {
    return `${miles.toFixed(miles < 10 ? 2 : 1)} mi`;
}

/**
 * An SVG polyline `points` string (equirectangular, longitude scaled by cos(latitude)) fitted and
 * centered in a `size` x `size` viewBox with a small margin. Empty for fewer than 2 points.
 */
export function routeSvgPath(points: ReadonlyArray<Readonly<RoutePoint>>, size: number): string {
    if (points.length < 2) {
        return '';
    }
    const margin = size * 0.08;
    const scale = Math.cos(
        toRadians(points.reduce((sum, point) => sum + point.latitude, 0) / points.length),
    );
    const projected = points.map((point) => {
        return {
            x: point.longitude * scale,
            y: -point.latitude,
        };
    });
    const xs = projected.map((point) => point.x);
    const ys = projected.map((point) => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX;
    const spanY = Math.max(...ys) - minY;
    const fit = (size - margin * 2) / (Math.max(spanX, spanY) || 1);
    const offsetX = (size - spanX * fit) / 2;
    const offsetY = (size - spanY * fit) / 2;
    return projected
        .map((point) => {
            const x = (offsetX + (point.x - minX) * fit).toFixed(1);
            const y = (offsetY + (point.y - minY) * fit).toFixed(1);
            return `${x},${y}`;
        })
        .join(' ');
}
