/** Shared by the Playwright config and the tests. */
export const e2ePort = Number(process.env['E2E_PORT'] ?? '8804');
export const e2eOrigin = `http://localhost:${e2ePort}`;
