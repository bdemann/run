import {clientsClaim} from 'workbox-core';
import {cleanupOutdatedCaches, precacheAndRoute} from 'workbox-precaching';
import {registerRoute} from 'workbox-routing';
import {NetworkFirst} from 'workbox-strategies';

/**
 * The service worker (vite-plugin-pwa `injectManifest`). Static assets are precached (never
 * index.html) and page loads go network first, so the app opens offline but new deploys win when
 * online. The DOM library does not describe a service worker scope, so only the parts used here are
 * typed.
 */
type WorkerScope = {
    skipWaiting: () => Promise<void>;
};

declare const self: {__WB_MANIFEST: Parameters<typeof precacheAndRoute>[0]};

const worker = self as unknown as WorkerScope;

worker.skipWaiting().catch(() => {});
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

/**
 * Page loads: network first so new headers and HTML always win; the cached shell only opens when
 * the network is slow or offline. The API is never cached.
 */
registerRoute(
    ({request, url}) => {
        return request.mode === 'navigate' && !/^\/api(\/|$)/.test(url.pathname);
    },
    new NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 3,
    }),
);
