import {type Goal} from './workout-shapes.js';
import {weeklyTarget} from './workouts.js';

function compareText({first, second}: Readonly<{first: string; second: string}>): number {
    return Number(first > second) - Number(first < second);
}

/**
 * Active goals first (soonest deadline first, goals without one last, then newest), then the
 * achieved ones (most recently reached first).
 */
export function sortGoals(goals: ReadonlyArray<Goal>): {active: Goal[]; reached: Goal[]} {
    return {
        active: goals
            .filter((goal) => goal.achievedAt == undefined)
            .toSorted((first, second) => {
                if (first.deadline != second.deadline) {
                    if (first.deadline == undefined) {
                        return 1;
                    } else if (second.deadline == undefined) {
                        return -1;
                    } else {
                        return compareText({
                            first: first.deadline,
                            second: second.deadline,
                        });
                    }
                }
                return compareText({
                    first: second.createdAt,
                    second: first.createdAt,
                });
            }),
        reached: goals
            .filter((goal) => goal.achievedAt != undefined)
            .toSorted((first, second) => {
                return compareText({
                    first: second.achievedAt as string,
                    second: first.achievedAt as string,
                });
            }),
    };
}

/** "2 of 3 this week", or "3 this week ✓" once the weekly target is met. */
export function describeWeek(count: number): string {
    return count >= weeklyTarget ? `${count} this week ✓` : `${count} of ${weeklyTarget} this week`;
}

/** True when a goal's deadline (a UTC ISO time) is before `nowMs`. */
export function deadlinePassed({
    goal,
    nowMs,
}: Readonly<{goal: Readonly<Pick<Goal, 'deadline'>>; nowMs: number}>): boolean {
    return goal.deadline != undefined && Date.parse(goal.deadline) < nowMs;
}
