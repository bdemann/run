import {findReferenceRun} from './advice.js';
import {type Feeling} from './feelings.js';
import {type Run} from './shapes.js';

/** Built-in clothing choices, grouped for the form. */
export const defaultClothing: Readonly<Record<string, ReadonlyArray<string>>> = {
    Top: [
        'Shirt',
        'Long sleeve',
        'Sweater',
        'Jacket',
        'Windbreaker',
    ],
    Bottom: [
        'Shorts',
        'Leggings',
        'Pants',
    ],
    Extras: [
        'Gloves',
        'Hat',
        'Ear warmers',
        'Neck gaiter',
        'Wool socks',
    ],
};

export type ClothingGroup = {name: string; items: ReadonlyArray<string>};

/**
 * The groups to show: the built-ins, then "Other" with the person's own items plus anything
 * selected that no list knows (from an import, say). Empty groups are left out.
 */
export function clothingGroups({
    customClothing,
    selected,
}: Readonly<{
    customClothing: ReadonlyArray<string>;
    selected: ReadonlyArray<string>;
}>): ClothingGroup[] {
    const known = new Set([
        ...Object.values(defaultClothing).flat(),
        ...customClothing,
    ]);
    const other = [
        ...customClothing,
        ...selected.filter((item) => !known.has(item)),
    ];
    return [
        ...Object.entries(defaultClothing).map(
            ([
                name,
                items,
            ]) => {
                return {
                    name,
                    items,
                };
            },
        ),
        {
            name: 'Other',
            items: other,
        },
    ].filter((group) => group.items.length);
}

/**
 * Adds a typed item. Matches an existing item regardless of case so "shorts" selects "Shorts".
 * Returns the item to select and the new custom list (unchanged when the item already exists), or
 * `undefined` for blank input.
 */
export function addClothingItem({
    customClothing,
    typed,
}: Readonly<{customClothing: ReadonlyArray<string>; typed: string}>):
    | {item: string; customClothing: string[]}
    | undefined {
    const name = typed.trim().replaceAll(/\s+/g, ' ');
    if (!name) {
        return undefined;
    }
    const existing = [
        ...Object.values(defaultClothing).flat(),
        ...customClothing,
    ].find((item) => item.toLowerCase() === name.toLowerCase());
    return existing
        ? {
              item: existing,
              customClothing: [...customClothing],
          }
        : {
              item: name,
              customClothing: [
                  ...customClothing,
                  name,
              ],
          };
}

/** "shirt, sweater and shorts", for sentences. */
export function describeClothing(items: ReadonlyArray<string>): string {
    const lower = items.map((item) => item.toLowerCase());
    const last = lower.at(-1);
    if (last == undefined) {
        return 'nothing logged';
    } else if (lower.length === 1) {
        return last;
    } else {
        return `${lower.slice(0, -1).join(', ')} and ${last}`;
    }
}

/** What a new run form starts with. */
export type RunPrefill = {
    clothing: string[];
    feeling: Feeling | undefined;
    /** Says where the answers came from, or `undefined` when nothing was filled in. */
    note: string | undefined;
};

/**
 * Fills a new run's form from the last run at this temperature (clothing and feeling), or the
 * closest nearby run (clothing only: how it felt then is not how it felt today).
 */
export function prefillForTemperature({
    runs,
    temperatureF,
}: Readonly<{
    runs: ReadonlyArray<Readonly<Run>>;
    temperatureF: number | undefined;
}>): RunPrefill {
    const reference =
        temperatureF == undefined
            ? undefined
            : findReferenceRun({
                  runs,
                  temperatureF,
              });
    if (!reference) {
        return {
            clothing: [],
            feeling: undefined,
            note: undefined,
        };
    }
    const referenceF = Math.round(reference.run.temperatureF);
    return reference.exact
        ? {
              clothing: [...reference.run.clothing],
              feeling: reference.run.feeling,
              note: `Filled in from your last run at ${referenceF}°F. Change anything that was different.`,
          }
        : {
              clothing: [...reference.run.clothing],
              feeling: undefined,
              note: `Clothing filled in from your closest run (${referenceF}°F). Change anything that was different.`,
          };
}
