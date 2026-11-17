import {assert} from '@augment-vir/assert';
import {itCases} from '@augment-vir/test';
import {describe, it} from 'node:test';
import {
    advise,
    describeConditionsDifference,
    findReferenceRun,
    isOverruled,
    miserableCeiling,
    suggestFrom,
    suggestionHeadings,
    suggestions,
} from './advice.js';
import {feelings, type Feeling} from './feelings.js';
import {testRun} from './test-runs.js';

const morning51 = testRun({
    id: 'morning-51',
    temperatureF: 51,
    feeling: feelings.coldOk,
});

const miserable25 = testRun({
    id: 'miserable-25',
    startedAt: '2026-12-01T13:00:00.000Z',
    temperatureF: 25,
    feeling: feelings.miserable,
    clothing: ['Jacket'],
});

const fineAt23Later = testRun({
    id: 'fine-23',
    startedAt: '2026-12-05T13:00:00.000Z',
    temperatureF: 23,
    feeling: feelings.coldOk,
    clothing: [
        'Jacket',
        'Gloves',
    ],
});

describe(suggestFrom.name, () => {
    function suggestAt({feeling, temperatureF}: {feeling: Feeling; temperatureF: number}) {
        return suggestFrom({
            reference: testRun({
                temperatureF: 50,
                feeling,
            }),
            temperatureF,
        });
    }

    itCases(suggestAt, [
        {
            it: 'repeats a just-right outfit at the same temperature',
            input: {
                feeling: feelings.right,
                temperatureF: 50,
            },
            expect: suggestions.same,
        },
        {
            it: 'keeps "a bit cold" as same-or-a-light-layer',
            input: {
                feeling: feelings.coldOk,
                temperatureF: 50,
            },
            expect: suggestions.sameOrLightLayer,
        },
        {
            it: 'says bundle up when "a bit cold" was 7°F warmer',
            input: {
                feeling: feelings.coldOk,
                temperatureF: 43,
            },
            expect: suggestions.bundleUp,
        },
        {
            it: 'says stay inside when "too cold" was 7°F warmer',
            input: {
                feeling: feelings.tooCold,
                temperatureF: 43,
            },
            expect: suggestions.stayInside,
        },
        {
            it: 'says leave a layer when it was too warm',
            input: {
                feeling: feelings.tooWarm,
                temperatureF: 50,
            },
            expect: suggestions.fewerLayers,
        },
        {
            it: 'says the same when "a bit cold" is now 7°F warmer',
            input: {
                feeling: feelings.coldOk,
                temperatureF: 57,
            },
            expect: suggestions.same,
        },
    ]);

    it('has a heading for every suggestion', () => {
        assert.deepEquals(
            Object.keys(suggestionHeadings).toSorted(),
            Object.values(suggestions).toSorted(),
        );
    });
});

describe(isOverruled.name, () => {
    it('overrules a miserable run after a later OK run at or below it', () => {
        assert.isTrue(
            isOverruled({
                run: miserable25,
                runs: [
                    miserable25,
                    fineAt23Later,
                ],
            }),
        );
    });

    it('keeps it when the OK run came first', () => {
        assert.isFalse(
            isOverruled({
                run: miserable25,
                runs: [
                    miserable25,
                    {
                        ...fineAt23Later,
                        startedAt: '2026-11-01T13:00:00.000Z',
                    },
                ],
            }),
        );
    });

    it('keeps it when the later run was warmer', () => {
        assert.isFalse(
            isOverruled({
                run: miserable25,
                runs: [
                    miserable25,
                    {
                        ...fineAt23Later,
                        temperatureF: 30,
                    },
                ],
            }),
        );
    });

    it('never overrules a run that was not miserable', () => {
        assert.isFalse(
            isOverruled({
                run: morning51,
                runs: [
                    morning51,
                    fineAt23Later,
                ],
            }),
        );
    });
});

describe(miserableCeiling.name, () => {
    it('is undefined with no miserable runs', () => {
        assert.isUndefined(miserableCeiling([morning51]));
    });

    it('is the warmest standing miserable temperature', () => {
        assert.strictEquals(
            miserableCeiling([
                miserable25,
                testRun({
                    id: 'miserable-18',
                    temperatureF: 18.4,
                    feeling: feelings.miserable,
                }),
            ]),
            25,
        );
    });

    it('ignores overruled ones', () => {
        assert.isUndefined(
            miserableCeiling([
                miserable25,
                fineAt23Later,
            ]),
        );
    });
});

describe(findReferenceRun.name, () => {
    it('prefers the newest exact match', () => {
        const older = {
            ...morning51,
            id: 'older',
            startedAt: '2026-10-01T13:00:00.000Z',
        };
        assert.deepEquals(
            findReferenceRun({
                runs: [
                    older,
                    morning51,
                ],
                temperatureF: 50.6,
            }),
            {
                run: morning51,
                exact: true,
            },
        );
    });

    it('falls back to the closest nearby run', () => {
        const at45 = testRun({
            id: 'at-45',
            temperatureF: 45,
            feeling: feelings.right,
        });
        assert.deepEquals(
            findReferenceRun({
                runs: [
                    at45,
                    morning51,
                ],
                temperatureF: 49,
            }),
            {
                run: morning51,
                exact: false,
            },
        );
    });

    it('keeps the newer run on a distance tie', () => {
        const at47Older = testRun({
            id: 'at-47',
            startedAt: '2026-10-01T13:00:00.000Z',
            temperatureF: 47,
            feeling: feelings.right,
        });
        assert.strictEquals(
            findReferenceRun({
                runs: [
                    at47Older,
                    morning51,
                ],
                temperatureF: 49,
            })?.run.id,
            morning51.id,
        );
    });

    it('finds nothing out of range', () => {
        assert.isUndefined(
            findReferenceRun({
                runs: [morning51],
                temperatureF: 60,
            }),
        );
    });

    it('skips overruled miserable runs', () => {
        assert.deepEquals(
            findReferenceRun({
                runs: [
                    miserable25,
                    fineAt23Later,
                ],
                temperatureF: 25,
            }),
            {
                run: fineAt23Later,
                exact: false,
            },
        );
    });
});

describe(advise.name, () => {
    it('needs a temperature', () => {
        assert.deepEquals(
            advise({
                runs: [morning51],
                temperatureF: undefined,
            }),
            {
                kind: 'no-temperature',
            },
        );
    });

    it('says too cold at or below a miserable temperature', () => {
        assert.deepEquals(
            advise({
                runs: [
                    morning51,
                    miserable25,
                ],
                temperatureF: 20.2,
            }),
            {
                kind: 'too-cold',
                temperatureF: 20,
                miserableAtF: 25,
            },
        );
    });

    it('says there is no history far from any run', () => {
        assert.deepEquals(
            advise({
                runs: [morning51],
                temperatureF: 70,
            }),
            {
                kind: 'no-history',
                temperatureF: 70,
            },
        );
    });

    it('suggests from the reference run', () => {
        assert.deepEquals(
            advise({
                runs: [morning51],
                temperatureF: 51,
            }),
            {
                kind: 'suggestion',
                temperatureF: 51,
                reference: {
                    run: morning51,
                    exact: true,
                },
                suggestion: suggestions.sameOrLightLayer,
            },
        );
    });
});

describe(describeConditionsDifference.name, () => {
    const reference = testRun({
        temperatureF: 51,
        feeling: feelings.coldOk,
        feelsLikeF: 51,
        windMph: 3,
    });
    const bare = testRun({
        temperatureF: 51,
        feeling: feelings.coldOk,
    });

    itCases(
        (input: Parameters<typeof describeConditionsDifference>[0]) => {
            return describeConditionsDifference(input);
        },
        [
            {
                it: 'says windier',
                input: {
                    reference,
                    today: {
                        feelsLikeF: 51,
                        windMph: 14,
                    },
                },
                expect: "It's windier today (14 mph vs 3 mph).",
            },
            {
                it: 'says calmer',
                input: {
                    reference: {
                        ...reference,
                        windMph: 14,
                    },
                    today: {
                        feelsLikeF: 51,
                        windMph: 3,
                    },
                },
                expect: "It's calmer today (3 mph vs 14 mph).",
            },
            {
                it: 'says colder',
                input: {
                    reference,
                    today: {
                        feelsLikeF: 45,
                        windMph: 3,
                    },
                },
                expect: 'It feels colder today (45°F vs 51°F).',
            },
            {
                it: 'says warmer',
                input: {
                    reference,
                    today: {
                        feelsLikeF: 56,
                        windMph: 3,
                    },
                },
                expect: 'It feels warmer today (56°F vs 51°F).',
            },
            {
                it: 'prefers wind over feels-like',
                input: {
                    reference,
                    today: {
                        feelsLikeF: 45,
                        windMph: 14,
                    },
                },
                expect: "It's windier today (14 mph vs 3 mph).",
            },
            {
                it: 'is silent below both thresholds',
                input: {
                    reference,
                    today: {
                        feelsLikeF: 47,
                        windMph: 10,
                    },
                },
                expect: undefined,
            },
            {
                it: 'falls back to feels-like when wind is missing today',
                input: {
                    reference,
                    today: {
                        feelsLikeF: 45,
                        windMph: undefined,
                    },
                },
                expect: 'It feels colder today (45°F vs 51°F).',
            },
            {
                it: 'falls back to feels-like when the run has no wind',
                input: {
                    reference: {
                        ...reference,
                        windMph: null,
                    },
                    today: {
                        feelsLikeF: 45,
                        windMph: 20,
                    },
                },
                expect: 'It feels colder today (45°F vs 51°F).',
            },
            {
                it: 'is silent when the run has no feels-like or wind',
                input: {
                    reference: bare,
                    today: {
                        feelsLikeF: 30,
                        windMph: 30,
                    },
                },
                expect: undefined,
            },
            {
                it: 'is silent when today has nothing (typed temperature)',
                input: {
                    reference,
                    today: {
                        feelsLikeF: undefined,
                        windMph: undefined,
                    },
                },
                expect: undefined,
            },
            {
                it: 'is silent when only feels-like is missing today',
                input: {
                    reference,
                    today: {
                        feelsLikeF: undefined,
                        windMph: 4,
                    },
                },
                expect: undefined,
            },
        ],
    );
});
