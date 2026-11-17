import {unknownBuildValue} from '@bdemann/app-kit/data';
import {type AboutBuildInfo} from '@bdemann/app-kit/ui';

/** Replaced at build time by Vite `define` (configs/vite.config.ts). Absent in odd tooling. */
declare const __APP_VERSION__: string | undefined;
declare const __APP_COMMIT__: string | undefined;
declare const __APP_BUILD_TIME__: string | undefined;

/** The full commit is kept so it can link to GitHub; the page shortens it for display. */
const commit = typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__.trim() : '';

export const buildInfo: AboutBuildInfo = {
    version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : unknownBuildValue,
    commit: commit || unknownBuildValue,
    buildTime: typeof __APP_BUILD_TIME__ === 'string' ? __APP_BUILD_TIME__ : undefined,
};
