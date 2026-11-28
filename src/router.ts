import {type FullSpaRoute, PathTree, SpaRouter} from 'spa-router-vir';

/**
 * Pages: `/` (Today: weather, advice, start or the run in progress), `/finish` (finish the run in
 * progress), `/workout` (bodyweight workouts), `/goals`, `/log` (log a run after the fact), `/runs`
 * (history), `/runs/:id` (a run's details) and `/runs/:id/edit` (edit it), `/settings`, `/about`
 * and `/feedback`. Unknown paths are sanitized back to `/`.
 */
const pathTree = new PathTree({
    allowBare: true,
    children: {
        finish: {},
        workout: {},
        goals: {},
        log: {},
        runs: {
            allowBare: true,
            children: {
                ':id': {
                    allowBare: true,
                    children: {
                        edit: {},
                    },
                },
            },
        },
        settings: {},
        about: {},
        feedback: {},
    },
});

export type RunPaths = typeof pathTree.PathsType;

export type RunRoute = FullSpaRoute<RunPaths, undefined, undefined>;

export const router = new SpaRouter<RunPaths, undefined, undefined>({
    sanitizeRoute(rawRoute) {
        return {
            paths: pathTree.sanitizePaths(rawRoute.paths),
            search: undefined,
            hash: undefined,
        };
    },
});

export type Screen =
    | 'today'
    | 'finish'
    | 'workout'
    | 'goals'
    | 'log'
    | 'history'
    | 'run-details'
    | 'edit'
    | 'settings'
    | 'about'
    | 'feedback';

/** Which screen a route shows. */
export function screenForRoute(route: Readonly<Pick<RunRoute, 'paths'>>): Screen {
    const [
        first,
        second,
        third,
    ] = route.paths;
    if (first === 'runs') {
        return second ? (third === 'edit' ? 'edit' : 'run-details') : 'history';
    } else if (
        first === 'finish' ||
        first === 'workout' ||
        first === 'goals' ||
        first === 'log' ||
        first === 'settings' ||
        first === 'about' ||
        first === 'feedback'
    ) {
        return first;
    } else {
        return 'today';
    }
}

/** The run id of a `/runs/:id` or `/runs/:id/edit` route. */
export function runIdOf(route: Readonly<Pick<RunRoute, 'paths'>>): string | undefined {
    return route.paths[0] === 'runs' ? route.paths[1] : undefined;
}

/** Goes to a page by its path parts, e.g. `goTo(['runs', id])`. */
export function goTo(paths: RunPaths): void {
    router.setRoute({
        paths,
    });
}
