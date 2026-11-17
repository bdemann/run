/** Shown in the header, About page and feedback issues. */
export const appName = 'Run Log';

/** `owner/name` of the GitHub repo; feedback is filed there as issues. */
export const repo = 'bdemann/run';

export const repoUrl = `https://github.com/${repo}`;

/** The Worker's API routes (`src/worker/index.ts`). */
export const apiPaths = {
    /** GET: `{ok: true, commit}`, the build the Worker runs. The About page compares it. */
    health: '/api/health',
    /** POST: a feedback draft from the kit's feedback page. Files a GitHub issue. */
    feedback: '/api/feedback',
} as const;
