import {type ActiveRun, type Run, type RunLocation, type UserData} from './shapes.js';
import {emptyUserData, mergeUserData, parseUserData} from './user-data.js';

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
    public importData(raw: unknown): {imported: number; dropped: number} {
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
        };
    }
}
