import {type FullSpaRoute, PathTree, SpaRouter} from 'spa-router-vir';

/**
 * Pages: `/` (Today: weather, advice, start or the run in progress), `/finish` (finish the run in
 * progress), `/log` (log a run after the fact), `/runs` (history), `/runs/:id` (edit a run),
 * `/settings`, `/about` and `/feedback`. Unknown paths are sanitized back to `/`.
 */
const pathTree = new PathTree({
    allowBare: true,
    children: {
        finish: {},
        log: {},
        runs: {
            allowBare: true,
            children: {
                ':id': {},
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
    | 'log'
    | 'history'
    | 'edit'
    | 'settings'
    | 'about'
    | 'feedback';

/** Which screen a route shows. */
export function screenForRoute(route: Readonly<Pick<RunRoute, 'paths'>>): Screen {
    const [
        first,
        second,
    ] = route.paths;
    if (first === 'runs') {
        return second ? 'edit' : 'history';
    } else if (
        first === 'finish' ||
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

/** The run id of a `/runs/:id` route. */
export function editRunId(route: Readonly<Pick<RunRoute, 'paths'>>): string | undefined {
    return route.paths[0] === 'runs' ? route.paths[1] : undefined;
}

/** Goes to a page by its path parts, e.g. `goTo(['runs', id])`. */
export function goTo(paths: RunPaths): void {
    router.setRoute({
        paths,
    });
}
