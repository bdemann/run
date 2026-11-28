import {type Activity, activities} from './activities.js';
import {feelings, feelingScores} from './feelings.js';
import {type Run} from './shapes.js';

/**
 * Roughly how many °F one "layer" of comfort is worth, used when comparing today with a run at a
 * nearby but different temperature.
 */
export const degreesPerLayer = 7;

/** How far away (°F) a past run can be and still count as "nearby". */
export const nearbyRangeF = 6;

/** A past run that tells us something about today's temperature. */
export type ReferenceRun = {
    run: Readonly<Run>;
    /** True when it was at the same (rounded) temperature as today. */
    exact: boolean;
};

/** What to do today, warmest outfit change last. */
export const suggestions = {
    stayInside: 'stay-inside',
    bundleUp: 'bundle-up',
    sameOrLightLayer: 'same-or-light-layer',
    same: 'same',
    fewerLayers: 'fewer-layers',
} as const;

export type Suggestion = (typeof suggestions)[keyof typeof suggestions];

export const suggestionHeadings: Readonly<Record<Suggestion, string>> = {
    [suggestions.stayInside]: 'Probably stay inside.',
    [suggestions.bundleUp]: 'Bundle up: add a layer.',
    [suggestions.sameOrLightLayer]:
        'The same outfit should be fine, or add a light layer to be comfortable.',
    [suggestions.same]: 'Do the same thing again.',
    [suggestions.fewerLayers]: 'Leave a layer at home.',
};

export type Advice =
    | {kind: 'no-temperature'}
    | {
          /** At or below a temperature you called miserable: don't go out. */
          kind: 'too-cold';
          temperatureF: number;
          miserableAtF: number;
      }
    | {kind: 'no-history'; temperatureF: number}
    | {
          kind: 'suggestion';
          temperatureF: number;
          reference: ReferenceRun;
          suggestion: Suggestion;
      };

/** Newer first. Stored times are UTC ISO strings, so they sort as text. */
export function sortNewestFirst(runs: ReadonlyArray<Readonly<Run>>): Readonly<Run>[] {
    return runs.toSorted((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/**
 * A "miserable" run stops counting once you later ran at that temperature or colder and were OK
 * (you found better gear, or it was a bad day).
 */
export function isOverruled({
    run,
    runs,
}: Readonly<{run: Readonly<Run>; runs: ReadonlyArray<Readonly<Run>>}>): boolean {
    return (
        run.feeling === feelings.miserable &&
        runs.some((other) => {
            return (
                other.feeling !== feelings.miserable &&
                Math.round(other.temperatureF) <= Math.round(run.temperatureF) &&
                other.startedAt > run.startedAt
            );
        })
    );
}

/** The warmest temperature you called miserable that still stands, if any. */
export function miserableCeiling(runs: ReadonlyArray<Readonly<Run>>): number | undefined {
    const standing = runs
        .filter((run) => {
            return (
                run.feeling === feelings.miserable &&
                !isOverruled({
                    run,
                    runs,
                })
            );
        })
        .map((run) => Math.round(run.temperatureF));
    return standing.length ? Math.max(...standing) : undefined;
}

/**
 * The most useful past run for a temperature: the newest one at the same rounded temperature, or
 * else the closest one within {@link nearbyRangeF} (newest wins a tie). Overruled miserable runs are
 * skipped.
 */
export function findReferenceRun({
    runs,
    temperatureF,
}: Readonly<{
    runs: ReadonlyArray<Readonly<Run>>;
    temperatureF: number;
}>): ReferenceRun | undefined {
    const target = Math.round(temperatureF);
    const candidates = sortNewestFirst(
        runs.filter((run) => {
            return !isOverruled({
                run,
                runs,
            });
        }),
    );
    const exact = candidates.find((run) => Math.round(run.temperatureF) === target);
    if (exact) {
        return {
            run: exact,
            exact: true,
        };
    }
    let best: Readonly<Run> | undefined;
    let bestDistance = Infinity;
    for (const run of candidates) {
        const distance = Math.abs(Math.round(run.temperatureF) - target);
        if (distance <= nearbyRangeF && distance < bestDistance) {
            best = run;
            bestDistance = distance;
        }
    }
    return best
        ? {
              run: best,
              exact: false,
          }
        : undefined;
}

/**
 * Shifts how a past run felt by how much warmer or colder it is now, then buckets the result. A run
 * that was "a bit cold" 7°F warmer than today becomes "too cold", so: bundle up.
 */
export function suggestFrom({
    reference,
    temperatureF,
}: Readonly<{reference: Readonly<Run>; temperatureF: number}>): Suggestion {
    const difference = Math.round(temperatureF) - Math.round(reference.temperatureF);
    const adjusted = feelingScores[reference.feeling] + difference / degreesPerLayer;
    if (adjusted <= -2.5) {
        return suggestions.stayInside;
    } else if (adjusted <= -1.5) {
        return suggestions.bundleUp;
    } else if (adjusted <= -0.5) {
        return suggestions.sameOrLightLayer;
    } else if (adjusted <= 0.5) {
        return suggestions.same;
    } else {
        return suggestions.fewerLayers;
    }
}

/**
 * What to tell the person before an outing at this temperature. Only past outings of the same
 * activity count, so walks never change run advice or the miserable ceiling, and vice versa.
 */
export function advise({
    runs: allRuns,
    temperatureF,
    activity,
}: Readonly<{
    runs: ReadonlyArray<Readonly<Run>>;
    temperatureF: number | undefined;
    activity: Activity;
}>): Advice {
    const runs = allRuns.filter((run) => run.activity === activity);
    if (temperatureF == undefined) {
        return {
            kind: 'no-temperature',
        };
    }
    const rounded = Math.round(temperatureF);
    const ceiling = miserableCeiling(runs);
    if (ceiling != undefined && rounded <= ceiling) {
        return {
            kind: 'too-cold',
            temperatureF: rounded,
            miserableAtF: ceiling,
        };
    }
    const reference = findReferenceRun({
        runs,
        temperatureF: rounded,
    });
    if (!reference) {
        return {
            kind: 'no-history',
            temperatureF: rounded,
        };
    }
    return {
        kind: 'suggestion',
        temperatureF: rounded,
        reference,
        suggestion: suggestFrom({
            reference: reference.run,
            temperatureF: rounded,
        }),
    };
}

/**
 * Advice for the kids on a walk: the same rules as {@link advise}, over the walks that recorded how
 * the kids felt, using the kids' feeling and clothing.
 */
export function adviseKids({
    runs,
    temperatureF,
}: Readonly<{
    runs: ReadonlyArray<Readonly<Run>>;
    temperatureF: number | undefined;
}>): Advice {
    const kidsRuns = runs.flatMap((run) => {
        return run.activity === activities.walk && run.kidsFeeling != undefined
            ? [
                  {
                      ...run,
                      feeling: run.kidsFeeling,
                      clothing: run.kidsClothing,
                  },
              ]
            : [];
    });
    return advise({
        runs: kidsRuns,
        temperatureF,
        activity: activities.walk,
    });
}

/** How much windier or calmer (mph) today must be before we mention it. */
export const windDifferenceMph = 8;

/** How much colder or warmer (°F, feels-like) today must be before we mention it. */
export const feelsLikeDifferenceF = 5;

/**
 * A short note when today's wind or feels-like temperature is noticeably different from the run the
 * advice is based on. Wind wins over feels-like. Returns `undefined` when either side is missing a
 * value or the difference is small.
 */
export function describeConditionsDifference({
    reference,
    today,
}: Readonly<{
    reference: Readonly<Run>;
    today: Readonly<{feelsLikeF: number | undefined | null; windMph: number | undefined | null}>;
}>): string | undefined {
    if (reference.windMph != undefined && today.windMph != undefined) {
        const then = Math.round(reference.windMph);
        const now = Math.round(today.windMph);
        const windDifference = today.windMph - reference.windMph;
        if (windDifference >= windDifferenceMph) {
            return `It's windier today (${now} mph vs ${then} mph).`;
        } else if (windDifference <= -windDifferenceMph) {
            return `It's calmer today (${now} mph vs ${then} mph).`;
        }
    }
    if (reference.feelsLikeF != undefined && today.feelsLikeF != undefined) {
        const then = Math.round(reference.feelsLikeF);
        const now = Math.round(today.feelsLikeF);
        const feelsDifference = today.feelsLikeF - reference.feelsLikeF;
        if (feelsDifference <= -feelsLikeDifferenceF) {
            return `It feels colder today (${now}°F vs ${then}°F).`;
        } else if (feelsDifference >= feelsLikeDifferenceF) {
            return `It feels warmer today (${now}°F vs ${then}°F).`;
        }
    }
    return undefined;
}
