# CLAUDE.md: Run Log agent handbook

Run Log is a small PWA for one person: before a run it says what to wear (or whether to stay
inside) based on what they wore and how they felt at the same temperature before. Start with
`README.md`. Work items are GitHub issues on `bdemann/run`. It follows the same stack and
conventions as the sibling apps `shopping-list` (Cloudflare Worker hosting) and `thoth` (all user
data in the browser).

## Commands (read this before running anything)

Every Bash call is a fresh shell and the default Node (22.x) is rejected by virmator. Put Node 24
first on `PATH`:

```bash
export PATH=$HOME/.nvm/versions/node/v24.20.0/bin:$PATH && npm run test:all
```

| Command                 | What it does                                                         |
| ----------------------- | -------------------------------------------------------------------- |
| `npm start`             | Vite dev server on http://localhost:5173 (no Worker: feedback fails) |
| `npm run build`         | Production build to `dist/` (includes manifest + service worker)     |
| `npm run test:all`      | compile, then coverage tests, no-eval, spelling, format, deps, lint  |
| `npm test`              | Unit tests only (`src/**/*.test.ts`, node:test via tsx)              |
| `npm run test:coverage` | Tests with c8; **100% per file** is enforced for `src/data`          |
| `npm run format`        | Prettier write                                                       |
| `npm run lint`          | ESLint with `--fix`; **always run `npm run format` after it**        |

**Never** run bare `virmator`, `npx virmator`, or `virmator <anything> --help`: it infinite-loops and
eats all memory. Never run `virmator init` (it clobbers `package.json`). Use the npm scripts.

**`npm run test:all` must pass before opening a PR.** `npm run compile` writes `tsc` output into
`dist/`, so run `npm run build` again afterwards before serving `dist/`.

### Running the real thing

```bash
npm run build
npx wrangler dev --host localhost:8799 --port 8799   # http://localhost:8799, Worker + assets
```

Never run remote wrangler commands (`--remote`, `deploy`, `secret put`); CI deploys on merge to
`main` once the repo variable `CLOUDFLARE_DEPLOY` is `true`. If `dist/` is deleted while
`wrangler dev` runs, restart it (it stops serving the new folder).

### Installing a just-published package

`.npmrc` sets `min-release-age=5` (days), and npm 11 ignores its `min-release-age-exclude[]` list,
so even `@bdemann/*` and electrovir releases younger than 5 days fail with `notarget`. For a fresh
`@bdemann/app-kit` (or other own/electrovir package) only, override it on that one command:
`npm install @bdemann/app-kit@<version> --save-exact --min-release-age=0`. Leave `.npmrc` alone.

## Architecture

-   `src/data/`: pure logic and object-shape-tester shapes, tested to 100%. No DOM.
    -   `advice.ts`: the heart of the app. `findReferenceRun` (newest run at the same rounded °F,
        else the closest within `nearbyRangeF`), `miserableCeiling` (a "miserable" run makes that
        temperature and colder a hard "don't go outside" until a later OK run at or below it
        overrules it), `suggestFrom` (shifts the reference run's feeling by `degreesPerLayer`).
    -   `clothing.ts`: built-in clothing groups, custom items, `prefillForTemperature` (a new run's
        form copies clothing + feeling from an exact-temperature run, clothing only from a nearby
        one).
    -   `weather.ts`: Open-Meteo URLs and response parsing (free, no key, CORS), plus National
        Weather Service (NWS) parsing and `weatherProxyUrl`. Weather path: Open-Meteo is a
        model estimate and can be several degrees off, so a real station measurement is preferred.
        The browser asks `/api/weather` on the Worker first (20 s timeout; `src/worker/weather.ts`),
        which tries NWS point, stations and latest observation (at most 90 minutes old), then
        Open-Meteo. If the Worker fails the browser tries Open-Meteo directly (6 s timeout). The
        answer is a `WeatherReading` (`source`, `observedAt`, `station`); Today shows where it came
        from. Never log the station. Coordinates sent to the Worker are rounded to 2 decimals (about 1 km) and the
        Worker never logs or stores them.
    -   Activities (`activities.ts`): a `Run` record has an `activity` (`run` or `walk`, ids stored), and
        walks also store `kidsFeeling` and `kidsClothing` (runs: `null` / `[]`). `advise`,
        `prefillForTemperature` take an `activity` and only look at that activity's records;
        `adviseKids` runs the same rules over walks' kids feeling/clothing. `defaultKidsClothing`
        is the kids' clothing list (`clothingGroups` / `addClothingItem` take optional `defaults`).
        Old documents get these keys from defaults in `parseUserData` (no version bump).
    -   `precipitation.ts`: kind + intensity (`none`, `drizzle`, `rain`, `snow`, `sleet`,
        `thunderstorm`), mappers from WMO codes (Open-Meteo `weather_code`) and NWS `presentWeather`,
        and `describePrecipitation`. It rides on `Weather.precipitation` and is stored on runs and the
        active run (`null` = unknown). Advice does not use it yet.
    -   `shapes.ts`, `user-data.ts`, `run-store.ts`: the one stored document (`UserData`, also the
        export/import format), lenient parsing (bad runs are dropped one by one), and `RunStore`,
        the only API the UI uses (`subscribe` to re-render).
-   `src/ui/`: element-vir 27 elements. `elements/run-app.element.ts` is the shell (app-kit
    `BottomNav`, `SlideDrawer`, `AboutPage`, `FeedbackPage`). `storage.ts` puts the document in
    localStorage via `@electrovir/local-storage-client`. `weather-client.ts` does the fetching.
-   `src/ui/elements/workout-screen.element.ts`: the Workout tab (start, one-tap sets, test inputs,
    finish summary, recent workouts). Its pure helpers (`planWorkout`, `finishedWorkout`,
    `describeNextTime`, goals reached) live in `src/data/workout-plan.ts`.
    In a baseline/retest each exercise has a variation `<select>`.
-   `src/ui/elements/goals-screen.element.ts`: `/goals` (not a tab; linked from the Workout screen
    and the weekly line on Today): goals with progress bars, add form, in-page delete confirm.
    `retest-card.element.ts` is the retest prompt shared with the Workout screen. Pure helpers
    (`sortGoals`, `describeWeek`, `deadlinePassed`) are in `src/data/goal-plan.ts`; the Monday week
    and end-of-day helpers are in `src/ui/dates.ts`.
-   `src/router.ts`: spa-router-vir routes `/`, `/finish`, `/log`, `/workout`, `/workout/:id` (workout details), `/goals`, `/runs`,
    `/runs/:id` (run details), `/runs/:id/edit`, `/settings`, `/about`, `/feedback`.
-   **Routes** (`src/data/gps.ts`, `src/ui/gps-recorder.ts`): record a route once with screen-on GPS
    (Wake Lock + `watchPosition`), save it with a name, pick it on later runs for distance and pace.
    The recording lives in `activeRun.recording` so it survives a reload; one app-wide recorder
    starts/stops from `run-app` by watching the store. **Route points are precise locations: they
    stay in the browser (localStorage and the export file) and are never sent or logged.**
-   `src/ui/diagnostics.ts`: the app-kit diagnostic log (`diagnosticLog.log(event, details)`), attached to
    feedback when the person ticks "Attach diagnostic logs". **Privacy rule: log event names and error
    kinds only (`step`, `reason`, `ms`, status codes). Never coordinates, place names, route points,
    notes or clothing.** Events: `weather-ok` (`source`, `ms`, `precipitation`: a kind), `error`, `storage-error`, `run-start` (`activity`: run/walk), `run-finish`, `run-cancel`,
    `workout-start` (`test`: yes/no), `workout-finish` (`sets`: a count), `workout-cancel`, `goal-add`, `route-record-start`, `route-saved` (`points`: a count). Never exercise values.
-   `src/worker/`: Cloudflare Worker: https redirect, `/api/health` (About page), `/api/feedback`
    (app-kit `handleFeedbackRequest`, no sign-in, honeypot on), security headers (CSP allows
    `connect-src` to Open-Meteo only), static assets. Run data never reaches the server.
-   `src/sw.ts`: workbox service worker (precache assets, network-first pages, never `/api`).
-   `www-static/`: `index.css` (design tokens) and icons. `art/icon.svg` is the icon source.

## Conventions

-   **Android first** (Benjamin's phone, Chrome); iPhone must work acceptably but does not drive
    design.
-   Temperature inputs are `type="number"` with no `inputmode`: Android's numeric keypad has no
    minus key, and it gets below 0°F.
-   Units are °F and mph everywhere (the person is in the US). Temperatures match on
    `Math.round`.
-   Colors only through the `--run-*` CSS vars in `www-static/index.css` (light and dark). The
    `--kit-*` vars theme app-kit.
-   Shapes in `src/data/shapes.ts`, checked with `checkShape` / `assertShape` from
    `src/data/shape-check.ts`, never object-shape-tester's compiled checks.
-   **Schema:** bump `currentUserDataVersion` and handle the old version in `parseUserData` for any
    breaking change to stored data. Adding an optional-with-default field needs parsing support.
-   Time: `new Date` is banned by lint (`@virmator/no-raw-date`); use date-vir in the UI
    (`src/ui/dates.ts`), ISO strings + `Date.parse` in `src/data`. Stored times are UTC ISO strings
    and sort as text. The Worker may not import date-vir (it uses `new Function`).
-   Tests: `*.test.ts` next to the source, `describe` from `node:test`, `itCases` / `assert` from
    `@augment-vir/test` / `@augment-vir/assert`. `src/data/test-runs.ts` builds runs for tests.
-   Lint rule `@virmator/prefer-params-object`: more than 3 params, or 2+ of the same type, take one
    destructured object. Lint `--fix` will rewrite sort comparators `(a, b)` into an object param
    and break them; write comparators inline.
-   Element state is read-only; keep mutable handles (unsubscribe, timers) in a `runtime` object.
    State/input names must not clash with `HTMLElement` / Lit members (`title`, `update`, ...).
-   Add new words to `cspell.config.cjs`.

## Working model

Opus plans and reviews (`model:opus`). Sonnet subagents implement one issue each (`model:sonnet`)
from the issue text, on a branch `issue-<n>-<slug>`, and open a PR that says `Closes #<n>`.
Issues that need Benjamin (accounts, secrets, decisions) are `needs:benjamin`.
