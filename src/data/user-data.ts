import {removeDuplicates} from '@augment-vir/common';
import {checkShape} from './shape-check.js';
import {
    activeRunShape,
    currentUserDataVersion,
    locationShape,
    runShape,
    type Run,
    type UserData,
} from './shapes.js';

export function emptyUserData(): UserData {
    return {
        version: currentUserDataVersion,
        runs: [],
        activeRun: null,
        settings: {
            location: null,
            customClothing: [],
        },
    };
}

function field(raw: unknown, key: string): unknown {
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined;
}

function arrayField(raw: unknown, key: string): unknown[] {
    const value = field(raw, key);
    return Array.isArray(value) ? value : [];
}

/** Result of reading stored or imported data. */
export type ParsedUserData = {
    data: UserData;
    /** How many runs were unreadable and left out. */
    droppedRuns: number;
};

/**
 * Reads anything (localStorage, an import file) into valid user data. Never throws: bad runs are
 * dropped one by one and bad settings fall back to defaults, so one broken record never loses the
 * rest.
 */
export function parseUserData(raw: unknown): ParsedUserData {
    const rawRuns = arrayField(raw, 'runs');
    const runs = rawRuns.filter((run): run is Run => checkShape(run, runShape));
    const activeRun = field(raw, 'activeRun');
    const settings = field(raw, 'settings');
    const location = field(settings, 'location');
    return {
        data: {
            version: currentUserDataVersion,
            runs,
            activeRun: checkShape(activeRun, activeRunShape) ? activeRun : null,
            settings: {
                location: checkShape(location, locationShape) ? location : null,
                customClothing: arrayField(settings, 'customClothing').filter(
                    (item): item is string => typeof item === 'string' && item.trim() !== '',
                ),
            },
        },
        droppedRuns: rawRuns.length - runs.length,
    };
}

/**
 * Adds imported runs to the current ones. A run with the same id is replaced by the imported copy.
 * Custom clothing is combined; the current location and run in progress are kept (falling back to
 * the imported location when none is set).
 */
export function mergeUserData({
    current,
    imported,
}: Readonly<{current: Readonly<UserData>; imported: Readonly<UserData>}>): UserData {
    const runsById = new Map(
        current.runs.map((run) => {
            return [
                run.id,
                run,
            ];
        }),
    );
    for (const run of imported.runs) {
        runsById.set(run.id, run);
    }
    return {
        version: currentUserDataVersion,
        runs: [...runsById.values()],
        activeRun: current.activeRun,
        settings: {
            location: current.settings.location ?? imported.settings.location,
            customClothing: removeDuplicates([
                ...current.settings.customClothing,
                ...imported.settings.customClothing,
            ]),
        },
    };
}

/** `run-log-2026-11-17.json`, from a UTC ISO time. */
export function exportFilename(nowIso: string): string {
    return `run-log-${nowIso.slice(0, 10)}.json`;
}
