import {assert} from '@augment-vir/assert';
import {itCases} from '@augment-vir/test';
import {describe, it} from 'node:test';
import {formatElapsed, minutesSince} from './elapsed.js';

describe(formatElapsed.name, () => {
    itCases(formatElapsed, [
        {
            it: 'shows minutes and seconds',
            input: 245_000,
            expect: '4:05',
        },
        {
            it: 'shows hours past an hour',
            input: 3_729_000,
            expect: '1:02:09',
        },
        {
            it: 'never goes negative',
            input: -5000,
            expect: '0:00',
        },
    ]);
});

describe(minutesSince.name, () => {
    it('rounds to whole minutes', () => {
        assert.strictEquals(
            minutesSince({
                startedAt: '2026-11-17T13:00:00.000Z',
                nowMs: Date.parse('2026-11-17T13:31:40.000Z'),
            }),
            32,
        );
    });

    it('never goes negative', () => {
        assert.strictEquals(
            minutesSince({
                startedAt: '2026-11-17T13:00:00.000Z',
                nowMs: 0,
            }),
            0,
        );
    });
});
