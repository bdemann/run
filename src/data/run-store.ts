import {allExercises} from './exercises.js';
import {
    type ActiveRun,
    type ActiveWorkout,
    type Goal,
    type Route,
    type Run,
    type RunLocation,
    type UserData,
    type Workout,
} from './shapes.js';
import {emptyUserData, mergeUserData, parseUserData} from './user-data.js';
import {newlyAchievedGoals} from './workouts.js';

/** Where the store keeps its one document. The browser uses localStorage (`src/ui/storage.ts`). */
export type DocumentBackend = {
    load: () => unknown;
    save: (data: Readonly<UserData>) => void;
};

/** An in-memory backend for tests, and the fallback when localStorage is unavailable. */
export function createMemoryBackend(initial?: unknown): DocumentBackend {
    let stored = initial;
    return {
        load() {
            return stored;
        },
        save(data) {
            stored = structuredClone(data);
        },
    };
}

/**
 * The only API the UI uses for runs and settings. Everything is one small document, saved whole on
 * every change. `subscribe` re-renders on changes.
 */
export class RunStore {
    protected data: UserData;
    protected readonly listeners = new Set<() => void>();

    constructor(protected readonly backend: DocumentBackend) {
        let loaded: unknown;
        try {
            loaded = backend.load();
        } catch {
            loaded = undefined;
        }
        this.data = loaded == undefined ? emptyUserData() : parseUserData(loaded).data;
    }

    public getData(): Readonly<UserData> {
        return this.data;
    }

    public getRun(id: string): Readonly<Run> | undefined {
        return this.data.runs.find((run) => run.id === id);
    }

    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    protected commit(next: UserData): void {
        this.data = next;
        this.backend.save(next);
        for (const listener of this.listeners) {
            listener();
        }
    }

    public startRun(activeRun: Readonly<ActiveRun>): void {
        this.commit({
            ...this.data,
            activeRun: {
                ...activeRun,
            },
        });
    }

    /** Changes fields of the run in progress (route choice, recording). No-op without one. */
    public updateActiveRun(partial: Readonly<Partial<ActiveRun>>): void {
        if (!this.data.activeRun) {
            return;
        }
        this.commit({
            ...this.data,
            activeRun: structuredClone({
                ...this.data.activeRun,
                ...partial,
            }),
        });
    }

    /** Adds a route, or replaces the one with the same id. */
    public saveRoute(route: Readonly<Route>): void {
        this.commit({
            ...this.data,
            routes: [
                ...this.data.routes.filter((existing) => existing.id !== route.id),
                structuredClone(route),
            ],
        });
    }

    public renameRoute({id, name}: Readonly<{id: string; name: string}>): void {
        this.commit({
            ...this.data,
            routes: this.data.routes.map((route) => {
                return route.id === id
                    ? {
                          ...route,
                          name,
                      }
                    : route;
            }),
        });
    }

    /** Runs keep their own `distanceMiles`; their `routeId` just stops matching a route. */
    public deleteRoute(id: string): void {
        this.commit({
            ...this.data,
            routes: this.data.routes.filter((route) => route.id !== id),
        });
    }

    public cancelRun(): void {
        this.commit({
            ...this.data,
            activeRun: null,
        });
    }

    /**
     * Adds a run, or replaces the one with the same id. `finishesActiveRun` also clears the run in
     * progress.
     */
    public saveRun({
        run,
        finishesActiveRun = false,
    }: Readonly<{run: Readonly<Run>; finishesActiveRun?: boolean}>): void {
        const others = this.data.runs.filter((existing) => existing.id !== run.id);
        this.commit({
            ...this.data,
            runs: [
                ...others,
                {
                    ...run,
                    clothing: [...run.clothing],
                },
            ],
            activeRun: finishesActiveRun ? null : this.data.activeRun,
        });
    }

    public deleteRun(id: string): void {
        this.commit({
            ...this.data,
            runs: this.data.runs.filter((run) => run.id !== id),
        });
    }

    public startWorkout(activeWorkout: Readonly<ActiveWorkout>): void {
        this.commit({
            ...this.data,
            activeWorkout: structuredClone(activeWorkout),
        });
    }

    public updateActiveWorkout(activeWorkout: Readonly<ActiveWorkout>): void {
        this.startWorkout(activeWorkout);
    }

    public cancelWorkout(): void {
        this.commit({
            ...this.data,
            activeWorkout: null,
        });
    }

    /**
     * Saves a finished workout (replacing one with the same id), clears the workout in progress and
     * marks goals it achieved.
     */
    public finishWorkout(workout: Readonly<Workout>): void {
        const workouts = [
            ...this.data.workouts.filter((existing) => existing.id !== workout.id),
            structuredClone(workout),
        ];
        const achieved = newlyAchievedGoals({
            goals: this.data.goals,
            exercises: allExercises(this.data),
            workouts,
            nowIso: workout.startedAt,
        });
        this.commit({
            ...this.data,
            workouts,
            goals: this.data.goals.map(
                (goal) => achieved.find((done) => done.id === goal.id) ?? goal,
            ),
            activeWorkout: null,
        });
    }

    public deleteWorkout(id: string): void {
        this.commit({
            ...this.data,
            workouts: this.data.workouts.filter((workout) => workout.id !== id),
        });
    }

    /** Adds a goal, or replaces the one with the same id. */
    public saveGoal(goal: Readonly<Goal>): void {
        this.commit({
            ...this.data,
            goals: [
                ...this.data.goals.filter((existing) => existing.id !== goal.id),
                {
                    ...goal,
                },
            ],
        });
    }

    public deleteGoal(id: string): void {
        this.commit({
            ...this.data,
            goals: this.data.goals.filter((goal) => goal.id !== id),
        });
    }

    public setLocation(location: Readonly<RunLocation>): void {
        this.commit({
            ...this.data,
            settings: {
                ...this.data.settings,
                location: {
                    ...location,
                },
            },
        });
    }

    public setCustomClothing(customClothing: ReadonlyArray<string>): void {
        this.commit({
            ...this.data,
            settings: {
                ...this.data.settings,
                customClothing: [...customClothing],
            },
        });
    }

    /** Merges an export file's contents in. Returns how many runs it had and how many were bad. */
    public importData(raw: unknown): {
        imported: number;
        dropped: number;
        importedWorkouts: number;
        droppedWorkouts: number;
    } {
        const parsed = parseUserData(raw);
        this.commit(
            mergeUserData({
                current: this.data,
                imported: parsed.data,
            }),
        );
        return {
            imported: parsed.data.runs.length,
            dropped: parsed.droppedRuns,
            importedWorkouts: parsed.data.workouts.length,
            droppedWorkouts: parsed.droppedWorkouts,
        };
    }
}
