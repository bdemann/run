import {type Activity, activities} from './activities.js';
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

/** Built-in clothing choices for the kids on a walk. */
export const defaultKidsClothing: Readonly<Record<string, ReadonlyArray<string>>> = {
    Top: [
        'Shirt',
        'Long sleeve',
        'Sweater',
        'Jacket',
        'Winter coat',
    ],
    Bottom: [
        'Pants',
        'Snow pants',
    ],
    Extras: [
        'Hat',
        'Mittens',
        'Boots',
        'Blanket',
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
    defaults = defaultClothing,
}: Readonly<{
    customClothing: ReadonlyArray<string>;
    selected: ReadonlyArray<string>;
    defaults?: Readonly<Record<string, ReadonlyArray<string>>>;
}>): ClothingGroup[] {
    const known = new Set([
        ...Object.values(defaults).flat(),
        ...customClothing,
    ]);
    const other = [
        ...customClothing,
        ...selected.filter((item) => !known.has(item)),
    ];
    return [
        ...Object.entries(defaults).map(
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
    defaults = defaultClothing,
}: Readonly<{
    customClothing: ReadonlyArray<string>;
    typed: string;
    defaults?: Readonly<Record<string, ReadonlyArray<string>>>;
}>): {item: string; customClothing: string[]} | undefined {
    const name = typed.trim().replaceAll(/\s+/g, ' ');
    if (!name) {
        return undefined;
    }
    const existing = [
        ...Object.values(defaults).flat(),
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
    /** What the kids wore (walks only; `[]` otherwise). */
    kidsClothing: string[];
    /** How the kids felt (walks only, exact temperature only). */
    kidsFeeling: Feeling | undefined;
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
    activity,
}: Readonly<{
    runs: ReadonlyArray<Readonly<Run>>;
    temperatureF: number | undefined;
    activity: Activity;
}>): RunPrefill {
    const reference =
        temperatureF == undefined
            ? undefined
            : findReferenceRun({
                  runs: runs.filter((run) => run.activity === activity),
                  temperatureF,
              });
    if (!reference) {
        return {
            clothing: [],
            feeling: undefined,
            kidsClothing: [],
            kidsFeeling: undefined,
            note: undefined,
        };
    }
    const referenceF = Math.round(reference.run.temperatureF);
    const word = activity === activities.walk ? 'walk' : 'run';
    return reference.exact
        ? {
              clothing: [...reference.run.clothing],
              feeling: reference.run.feeling,
              kidsClothing: [...reference.run.kidsClothing],
              kidsFeeling: reference.run.kidsFeeling ?? undefined,
              note: `Filled in from your last ${word} at ${referenceF}°F. Change anything that was different.`,
          }
        : {
              clothing: [...reference.run.clothing],
              feeling: undefined,
              kidsClothing: [...reference.run.kidsClothing],
              kidsFeeling: undefined,
              note: `Clothing filled in from your closest ${word} (${referenceF}°F). Change anything that was different.`,
          };
}

/** Removes one custom item (case-sensitive exact match). Returns a new array. */
export function removeClothingItem({
    customClothing,
    item,
}: Readonly<{customClothing: ReadonlyArray<string>; item: string}>): string[] {
    return customClothing.filter((existing) => existing !== item);
}
