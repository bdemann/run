import {type FeedbackRequest} from '@bdemann/app-kit/data';
import {type FeedbackDraft, type FeedbackSendResult} from '@bdemann/app-kit/ui';
import {apiPaths} from '../data/app-info.js';
import {buildInfo} from './build-info.js';

export const feedbackDraftStorageKey = 'run-log.feedbackDraft';
export const feedbackContactStorageKey = 'run-log.feedbackContact';

let pageBeforeFeedback = '/';

/** Called by the app shell on every route change except the feedback page itself. */
export function rememberPageBeforeFeedback(path: string): void {
    pageBeforeFeedback = path;
}

/**
 * Posts a draft from the kit's feedback page to the Worker, adding the page the person came from
 * and the version. Never throws; returns a friendly message on failure. Under `npm start` there is
 * no Worker, which shows up as a 404 or a non-JSON reply.
 */
export async function sendFeedback(draft: Readonly<FeedbackDraft>): Promise<FeedbackSendResult> {
    const request: FeedbackRequest = {
        ...draft,
        page: pageBeforeFeedback,
        version: buildInfo.version,
    };
    let response: Response;
    try {
        response = await fetch(apiPaths.feedback, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify(request),
        });
    } catch {
        return {
            ok: false,
            message: 'Could not reach the server. Check your connection and try again.',
        };
    }
    let error: string | undefined;
    try {
        const body = (await response.json()) as {error?: unknown};
        error = typeof body.error === 'string' ? body.error : undefined;
    } catch {
        /** Not JSON: no Worker here (the Vite dev server). */
    }
    if (response.ok) {
        return {
            ok: true,
        };
    }
    return {
        ok: false,
        message:
            error ??
            'Feedback is not available here. It only works on the live app (the dev server has no Worker).',
    };
}

/** The deployed commit, for the About page's "is this up to date" check. */
export async function fetchLatestCommit(): Promise<string | undefined> {
    try {
        const response = await fetch(apiPaths.health, {
            cache: 'no-store',
        });
        const body = (await response.json()) as {commit?: unknown};
        return typeof body.commit === 'string' ? body.commit : undefined;
    } catch {
        return undefined;
    }
}
