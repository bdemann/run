import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {handleRequest, httpsRedirect, type WorkerEnv} from './index.js';

function makeEnv(overrides: Partial<WorkerEnv> = {}): WorkerEnv {
    return {
        ASSETS: {
            fetch() {
                return Promise.resolve(
                    new Response('asset', {
                        status: 200,
                    }),
                );
            },
        },
        COMMIT: 'abc123',
        ...overrides,
    };
}

const origin = 'https://run.demann.family';
/** Plain http on purpose: these tests exercise the redirect. */
// eslint-disable-next-line sonarjs/no-clear-text-protocols
const httpOrigin = 'http://run.demann.family';

describe('httpsRedirect', () => {
    it('redirects plain http on a real host', () => {
        const response = httpsRedirect(new Request(`${httpOrigin}/x?y=1`));
        assert.isDefined(response);
        assert.strictEquals(response.status, 301);
        assert.strictEquals(response.headers.get('Location'), `${origin}/x?y=1`);
    });

    it('leaves local hosts alone', () => {
        assert.isUndefined(httpsRedirect(new Request('http://localhost:8799/')));
        assert.isUndefined(httpsRedirect(new Request('http://127.0.0.1:8799/')));
    });

    it('leaves https alone', () => {
        assert.isUndefined(httpsRedirect(new Request(`${origin}/`)));
    });
});

describe('handleRequest', () => {
    it('answers the health check', async () => {
        const response = await handleRequest(new Request(`${origin}/api/health`), makeEnv());
        assert.strictEquals(response.status, 200);
        assert.strictEquals(response.headers.get('cache-control'), 'no-store');
        assert.deepEquals(await response.json(), {
            ok: true,
            commit: 'abc123',
        });
    });

    it('defaults the commit to dev', async () => {
        const response = await handleRequest(
            new Request(`${origin}/api/health`),
            makeEnv({
                COMMIT: undefined,
            }),
        );
        assert.deepEquals(await response.json(), {
            ok: true,
            commit: 'dev',
        });
    });

    it('404s unknown api paths', async () => {
        const response = await handleRequest(new Request(`${origin}/api/nope`), makeEnv());
        assert.strictEquals(response.status, 404);
        const body = (await response.json()) as {ok: boolean};
        assert.strictEquals(body.ok, false);
    });

    it('serves assets for everything else', async () => {
        for (const path of [
            '/',
            '/runs/abc',
        ]) {
            const response = await handleRequest(new Request(`${origin}${path}`), makeEnv());
            assert.strictEquals(response.status, 200);
            assert.strictEquals(await response.text(), 'asset');
        }
    });

    it('redirects http requests', async () => {
        const response = await handleRequest(new Request(`${httpOrigin}/`), makeEnv());
        assert.strictEquals(response.status, 301);
    });

    it('rejects GET on feedback', async () => {
        const response = await handleRequest(new Request(`${origin}/api/feedback`), makeEnv());
        assert.strictEquals(response.status, 405);
    });

    it('503s feedback posts without a token', async () => {
        const response = await handleRequest(
            new Request(`${origin}/api/feedback`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    kind: 'idea',
                    message: 'hi',
                }),
            }),
            makeEnv({
                GITHUB_FEEDBACK_TOKEN: undefined,
            }),
        );
        assert.strictEquals(response.status, 503);
    });

    it('adds a tight CSP to every response', async () => {
        const requests = [
            new Request(`${origin}/api/health`),
            new Request(`${origin}/api/nope`),
            new Request(`${origin}/`),
            new Request(`${origin}/runs/abc`),
            new Request(`${origin}/api/feedback`),
        ];
        for (const request of requests) {
            const response = await handleRequest(request, makeEnv());
            const csp = response.headers.get('Content-Security-Policy');
            assert.isDefined(csp);
            const connect = csp
                .split(';')
                .map((part) => part.trim())
                .find((part) => part.startsWith('connect-src'));
            assert.strictEquals(
                connect,
                "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com",
            );
        }
    });
});
