/** Baseline security headers added to every response the Worker returns. */
export const securityHeaders = {
    'Content-Security-Policy': [
        "default-src 'self'",
        /**
         * `'unsafe-eval'` is required by the UI stack: element-vir checks state observables with
         * observavir, which uses object-shape-tester's compiled (new Function) checks. Without it
         * the app fails to render. Inline scripts stay blocked; scripts still load only from self.
         * Revisit if object-shape-tester gains a non-compiled checking mode.
         */
        "script-src 'self' 'unsafe-eval'",
        /** The temperature comes straight from Open-Meteo (`src/data/weather.ts`). */
        "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        /** `default-src` does not cover form targets; no form ever leaves the page. */
        "form-action 'self'",
    ].join('; '),
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
} as const;

/** Returns a copy of the response with {@link securityHeaders} set (the original may be immutable). */
export function withSecurityHeaders(response: Response): Response {
    const headers = new Headers(response.headers);
    for (const [
        name,
        value,
    ] of Object.entries(securityHeaders)) {
        headers.set(name, value);
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}
