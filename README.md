# Run Log

A tiny running log for one question: **what should I wear to run at this temperature, and should I
go outside at all?**

-   **Start run** records the current temperature, feels-like temperature and wind from
    the nearest US National Weather Service station measurement (through the app's Worker), falling
    back to [Open-Meteo](https://open-meteo.com)'s model estimate (free, no API key). Today shows
    which one you got.
-   **Finish run** asks what you wore and how you felt. If you have run at this temperature before,
    the form is filled in with your answers from last time.
-   Before a run, **Today** says what you wore and how you felt last time at this temperature (or
    the closest one), and suggests: do the same, add a layer, leave a layer at home, or stay inside
    (treadmill, gym, or a day off).
-   Rate a run **Miserable** and every temperature at or below it says _don't go outside_, until a
    later run at that temperature or colder goes OK.
-   **Log a run I already did** adds a run after the fact. **Runs** lists every run, coldest first.
-   **Routes:** pick "Record a new route" on Today and keep the screen on while you run (GPS). On
    finish, name the route to save it. Pick it on later runs and the distance and pace come from the
    saved route and your time, no GPS needed. History shows distance and pace.
-   **Workout** is a short bodyweight circuit: a baseline test first, then sets that grow a rep at a
    time, one tap per set. Finishing shows what to do next time. The baseline lets you pick a
    harder variation per exercise.
-   **Goals** (from the Workout screen or the "2 of 3 this week" line on Today) tracks a target for
    an exercise and shows progress, a deadline and when you reached it.

Run data, including saved routes (GPS tracks, which are precise locations), lives only in the
browser (localStorage) and is never sent anywhere; **Settings** exports and imports it as JSON.

## Stack

A PWA built like its sibling apps: [element-vir](https://github.com/electrovir/element-vir),
spa-router-vir, object-shape-tester, date-vir, `@electrovir/local-storage-client`, virmator for
tooling, `@bdemann/app-kit` for the bottom nav, menu, About and Feedback pages, and
vite-plugin-pwa. Hosted on a Cloudflare Worker at `run.demann.family`, which also files feedback as
GitHub issues. See `CLAUDE.md` for commands and architecture.

## Development

```bash
npm ci
npm start            # http://localhost:5173
npm run test:all     # everything CI runs
```

## Deploying

`.github/workflows/deploy.yml` deploys on every push to `main` once set up:

1. Repo secrets `CLOUDFLARE_API_TOKEN` (Workers edit) and `CLOUDFLARE_ACCOUNT_ID`.
2. Repo variable `CLOUDFLARE_DEPLOY` = `true`.
3. `npx wrangler secret put GITHUB_FEEDBACK_TOKEN` (fine-grained token, Issues read/write on this
   repo) for the feedback form.

`wrangler.jsonc` claims the custom domain `run.demann.family`; other subdomains of `demann.family`
are unaffected.
