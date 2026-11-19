import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {deadlinePassed, describeWeek, sortGoals} from './goal-plan.js';
import {type Goal} from './workout-shapes.js';

function goal(overrides: Partial<Goal>): Goal {
    return {
        id: 'g',
        exerciseId: 'pushup',
        variationId: 'full',
        target: 20,
        createdAt: '2026-01-01T00:00:00.000Z',
        deadline: null,
        achievedAt: null,
        ...overrides,
    };
}

describe(sortGoals.name, () => {
    it('orders active goals by deadline, then newest, with reached ones last', () => {
        const {active, reached} = sortGoals([
            goal({
                id: 'none-old',
            }),
            goal({
                id: 'late',
                deadline: '2026-12-31T00:00:00.000Z',
            }),
            goal({
                id: 'none-new',
                createdAt: '2026-02-01T00:00:00.000Z',
            }),
            goal({
                id: 'soon',
                deadline: '2026-06-01T00:00:00.000Z',
            }),
            goal({
                id: 'soon-newer',
                deadline: '2026-06-01T00:00:00.000Z',
                createdAt: '2026-03-01T00:00:00.000Z',
            }),
            goal({
                id: 'r1',
                achievedAt: '2026-04-01T00:00:00.000Z',
            }),
            goal({
                id: 'r2',
                achievedAt: '2026-05-01T00:00:00.000Z',
            }),
            goal({
                id: 'r3',
                achievedAt: '2026-05-01T00:00:00.000Z',
            }),
        ]);
        assert.deepEquals(
            active.map((entry) => entry.id),
            [
                'soon-newer',
                'soon',
                'late',
                'none-new',
                'none-old',
            ],
        );
        assert.deepEquals(
            reached.map((entry) => entry.id),
            [
                'r2',
                'r3',
                'r1',
            ],
        );
    });

    it('puts a goal without a deadline after one with, whichever order they come in', () => {
        const dated = goal({
            id: 'dated',
            deadline: '2026-06-01T00:00:00.000Z',
        });
        const undated = goal({
            id: 'undated',
        });
        for (const input of [
            [
                dated,
                undated,
            ],
            [
                undated,
                dated,
            ],
        ]) {
            assert.deepEquals(
                sortGoals(input).active.map((entry) => entry.id),
                [
                    'dated',
                    'undated',
                ],
            );
        }
    });
});

describe(describeWeek.name, () => {
    it('counts toward the target, then checks it off', () => {
        assert.strictEquals(describeWeek(0), '0 of 3 this week');
        assert.strictEquals(describeWeek(2), '2 of 3 this week');
        assert.strictEquals(describeWeek(3), '3 this week ✓');
        assert.strictEquals(describeWeek(5), '5 this week ✓');
    });
});

describe(deadlinePassed.name, () => {
    it('is false without a deadline or before it, true after', () => {
        const nowMs = Date.parse('2026-06-01T00:00:00.000Z');
        assert.isFalse(
            deadlinePassed({
                goal: goal({}),
                nowMs,
            }),
        );
        assert.isFalse(
            deadlinePassed({
                goal: goal({
                    deadline: '2026-07-01T00:00:00.000Z',
                }),
                nowMs,
            }),
        );
        assert.isTrue(
            deadlinePassed({
                goal: goal({
                    deadline: '2026-05-01T00:00:00.000Z',
                }),
                nowMs,
            }),
        );
    });
});
