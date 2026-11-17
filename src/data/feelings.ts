/** How a run felt, coldest first. The ids are stored; never rename them. */
export const feelings = {
    miserable: 'miserable',
    tooCold: 'too-cold',
    coldOk: 'cold-ok',
    right: 'right',
    tooWarm: 'too-warm',
} as const;

export type Feeling = (typeof feelings)[keyof typeof feelings];

/** Display order in the form: coldest first. */
export const feelingOrder: ReadonlyArray<Feeling> = [
    feelings.miserable,
    feelings.tooCold,
    feelings.coldOk,
    feelings.right,
    feelings.tooWarm,
];

/**
 * How far from comfortable each feeling is, in "layers". Negative is too cold. Used to shift a past
 * run's feeling to today's temperature (see `advice.ts`).
 */
export const feelingScores: Readonly<Record<Feeling, number>> = {
    [feelings.miserable]: -3,
    [feelings.tooCold]: -2,
    [feelings.coldOk]: -1,
    [feelings.right]: 0,
    [feelings.tooWarm]: 1,
};

/** The choices in the run form. */
export const feelingLabels: Readonly<Record<Feeling, string>> = {
    [feelings.miserable]: "Miserable: don't go outside at this temp",
    [feelings.tooCold]: 'Too cold: needed more layers',
    [feelings.coldOk]: 'A bit cold, but fine',
    [feelings.right]: 'Just right',
    [feelings.tooWarm]: 'Too warm: could have worn less',
};

/** Short form for sentences and lists ("you felt a bit cold, but fine"). */
export const feelingShortLabels: Readonly<Record<Feeling, string>> = {
    [feelings.miserable]: 'miserable',
    [feelings.tooCold]: 'too cold',
    [feelings.coldOk]: 'a bit cold, but fine',
    [feelings.right]: 'just right',
    [feelings.tooWarm]: 'too warm',
};
