import {handleFeedbackRequest} from '@bdemann/app-kit/server';
import {apiPaths, appName, repo} from '../data/app-info.js';
import {withSecurityHeaders} from './security-headers.js';
import {handleWeatherRequest} from './weather.js';

/** Bindings and vars from `wrangler.jsonc`, plus secrets (`.dev.vars` locally). */
export type WorkerEnv = {
    ASSETS: {fetch: (request: Request) => Promise<Response>};
    /** Build commit; set with `wrangler deploy --var COMMIT:<sha>`. Defaults to `dev`. */
    COMMIT?: string | undefined;
    /** Fine-grained GitHub token with Issues: read and write on this repo only (secret). */
    GITHUB_FEEDBACK_TOKEN?: string | undefined;
};

const localHostnames = new Set([
    'localhost',
    '127.0.0.1',
    '[::1]',
]);

/** A 301 to the https URL for plain-http requests on non-local hosts, otherwise `undefined`. */
export function httpsRedirect(request: Request): Response | undefined {
    const url = new URL(request.url);
    if (url.protocol !== 'http:' || localHostnames.has(url.hostname)) {
        return undefined;
    }
    url.protocol = 'https:';
    return new Response(null, {
        status: 301,
        headers: {
            Location: url.toString(),
        },
    });
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
        },
    });
}

/**
 * The app keeps all run data in the browser, so the Worker only serves the static build plus two
 * small endpoints: a health check for the About page and the feedback form.
 */
export async function handleRequest(request: Request, env: WorkerEnv): Promise<Response> {
    const redirect = httpsRedirect(request);
    if (redirect) {
        return redirect;
    }
    const {pathname} = new URL(request.url);
    let response: Response;
    if (pathname === apiPaths.health) {
        response = json({
            ok: true,
            commit: env.COMMIT || 'dev',
        });
    } else if (pathname === apiPaths.feedback) {
        /** No sign-in: the kit's honeypot and contact fields are on (see the feedback page). */
        response = await handleFeedbackRequest(request, {
            token: env.GITHUB_FEEDBACK_TOKEN,
            repo,
            appName,
            labels: {
                base: ['app-feedback'],
                byKind: {
                    idea: ['idea'],
                    problem: ['bug'],
                },
            },
            commit: env.COMMIT || 'dev',
            /**
             * Raw Date on purpose: date-vir compiles shapes with `new Function`, which Workers
             * forbid.
             */
            // eslint-disable-next-line @virmator/no-raw-date
            submittedAt: new Date().toISOString(),
            fetchFunction: fetch,
            userAgent: 'run-log-feedback',
        });
    } else if (pathname === apiPaths.weather) {
        response =
            request.method === 'GET'
                ? await handleWeatherRequest({
                      request,
                      fetchFunction: fetch,
                      nowMs: Date.now(),
                  })
                : json(
                      {
                          ok: false,
                          error: 'Use GET.',
                      },
                      405,
                  );
    } else if (pathname === '/api' || pathname.startsWith('/api/')) {
        response = json(
            {
                ok: false,
                error: 'Not found.',
            },
            404,
        );
    } else {
        response = await env.ASSETS.fetch(request);
    }
    return withSecurityHeaders(response);
}

export default {
    fetch(request, env) {
        return handleRequest(request, env);
    },
} satisfies ExportedHandler<WorkerEnv>;
