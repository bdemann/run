import {getNowInIsoString} from 'date-vir';
import {css, defineElement, html, listen, nothing, type HtmlInterpolation} from 'element-vir';
import {activities, activityLabels, type Activity} from '../../data/activities.js';
import {
    advise,
    adviseKids,
    describeConditionsDifference,
    suggestionHeadings,
    suggestions,
    type Advice,
    type ReferenceRun,
} from '../../data/advice.js';
import {describeClothing} from '../../data/clothing.js';
import {formatElapsed} from '../../data/elapsed.js';
import {feelingShortLabels} from '../../data/feelings.js';
import {describeWeek} from '../../data/goal-plan.js';
import {formatMiles} from '../../data/gps.js';
import {parseNumber} from '../../data/parse-number.js';
import {
    describePrecipitation,
    describeWetNote,
    precipitationKinds,
} from '../../data/precipitation.js';
import {type ActiveRun, type UserData} from '../../data/shapes.js';
import {type Weather, type WeatherReading} from '../../data/weather.js';
import {sessionsInRange} from '../../data/workouts.js';
import {goTo} from '../../router.js';
import {currentWeekRangeMs, formatClockTime, formatRunDate} from '../dates.js';
import {diagnosticLog} from '../diagnostics.js';
import {gpsRecorder} from '../gps-recorder.js';
import {getRunStore} from '../storage.js';
import {screenStyles} from '../styles.js';
import {fetchWeather, freshWeather, getCachedWeather} from '../weather-client.js';

const recordNewRoute = 'record-new';

type Runtime = {
    unsubscribe: (() => void) | undefined;
    ticker: ReturnType<typeof setInterval> | undefined;
};

function round(value: number | null | undefined): string {
    return value == undefined ? '--' : String(Math.round(value));
}

/** "Measured at KPVU · 6:35 AM" or "Model estimate (Open-Meteo)". */
function describeSource(reading: Readonly<WeatherReading>): string {
    return reading.source === 'nws' && reading.station && reading.observedAt
        ? `Measured at ${reading.station} · ${formatClockTime(reading.observedAt)}`
        : 'Model estimate (Open-Meteo)';
}

function adviceTone(advice: Readonly<Advice>): string {
    if (advice.kind === 'too-cold') {
        return 'stop';
    } else if (advice.kind !== 'suggestion') {
        return '';
    } else if (advice.suggestion === suggestions.stayInside) {
        return 'stop';
    } else if (advice.suggestion === suggestions.same) {
        return 'go';
    } else {
        return 'adjust';
    }
}

const stayInside = html`
    <p>Use the treadmill, drive to the gym, or take a day off.</p>
`;

function renderAdvice(
    advice: Readonly<Advice>,
    hasLocation: boolean,
    weather: Readonly<Weather> | undefined,
): HtmlInterpolation {
    if (advice.kind === 'no-temperature') {
        return hasLocation
            ? html`
                  <p class="muted">Type the temperature above, or wait for it to load.</p>
              `
            : html`
                  <p>Type the temperature above to get advice.</p>
              `;
    } else if (advice.kind === 'too-cold') {
        return html`
            <h2>Don't go outside.</h2>
            <p>
                At ${advice.miserableAtF}°F you said it was miserable no matter what. It's
                ${advice.temperatureF}°F now.
            </p>
            ${stayInside}
        `;
    } else if (advice.kind === 'no-history') {
        return html`
            <h2>No runs near ${advice.temperatureF}°F yet</h2>
            <p class="muted">
                Whatever you wear today becomes the first data point for this temperature.
            </p>
        `;
    }
    const {run, exact} = advice.reference;
    const runF = Math.round(run.temperatureF);
    const difference = runF - advice.temperatureF;
    const wore = html`
        you wore
        <strong>${describeClothing(run.clothing)}</strong>
        and felt
        <strong>${feelingShortLabels[run.feeling]}.</strong>
    `;
    const conditions = describeConditionsDifference({
        reference: run,
        today: {
            feelsLikeF: weather?.feelsLikeF,
            windMph: weather?.windMph,
        },
    });
    return html`
        <h2>${suggestionHeadings[advice.suggestion]}</h2>
        <p>
            ${exact
                ? html`
                      The last time you ran at ${runF}°F (${formatRunDate(run.startedAt)}) ${wore}
                  `
                : html`
                      No runs at exactly ${advice.temperatureF}°F. The closest was ${runF}°F
                      (${Math.abs(difference)}° ${difference > 0 ? 'warmer' : 'colder'}) on
                      ${formatRunDate(run.startedAt)}: ${wore}
                  `}
        </p>
        ${conditions
            ? html`
                  <p>${conditions}</p>
              `
            : nothing}
        ${run.notes
            ? html`
                  <p class="muted">Your note: “${run.notes}”</p>
              `
            : nothing}
        ${advice.suggestion === suggestions.stayInside ? stayInside : nothing}
    `;
}

const activityOrder: ReadonlyArray<Activity> = [
    activities.run,
    activities.walk,
];

/** One side (you or the kids) of the walk advice card. */
function renderWalkPart({
    title,
    advice,
}: Readonly<{title: string; advice: Readonly<Advice>}>): HtmlInterpolation {
    if (advice.kind !== 'suggestion') {
        return html`
            <div class="part">
                <h3>${title}</h3>
                <p class="muted">No walks near this temperature yet.</p>
            </div>
        `;
    }
    const {run, exact} = advice.reference;
    const runF = Math.round(run.temperatureF);
    return html`
        <div class="part">
            <h3>${title}</h3>
            <p><strong>${suggestionHeadings[advice.suggestion]}</strong></p>
            <p>
                ${exact
                    ? html`
                          ${formatRunDate(run.startedAt)} at ${runF}°F:
                      `
                    : html`
                          Closest was ${runF}°F on ${formatRunDate(run.startedAt)}:
                      `}
                <strong>${describeClothing(run.clothing)}</strong>
                and felt
                <strong>${feelingShortLabels[run.feeling]}.</strong>
            </p>
        </div>
    `;
}

function renderWalkAdvice({
    you,
    kids,
    hasLocation,
    weather,
}: Readonly<{
    you: Readonly<Advice>;
    kids: Readonly<Advice>;
    hasLocation: boolean;
    weather: Readonly<Weather> | undefined;
}>): HtmlInterpolation {
    if (you.kind === 'no-temperature') {
        return renderAdvice(you, hasLocation, weather);
    } else if (you.kind === 'too-cold' || kids.kind === 'too-cold') {
        const miserable =
            kids.kind === 'too-cold' ? kids : you.kind === 'too-cold' ? you : undefined;
        const who = kids.kind === 'too-cold' ? 'The kids were' : 'You were';
        return html`
            <h2>Don't go outside.</h2>
            <p>${who} miserable at ${miserable?.miserableAtF}°F. It's ${you.temperatureF}°F now.</p>
            ${stayInside}
        `;
    } else if (you.kind === 'no-history' && kids.kind === 'no-history') {
        return html`
            <h2>No walks near ${you.temperatureF}°F yet</h2>
            <p class="muted">
                Whatever you and the kids wear today becomes the first data point for this
                temperature.
            </p>
        `;
    } else {
        const conditions = describeConditionsDifference({
            reference: (you.kind === 'suggestion' ? you : (kids as {reference: ReferenceRun}))
                .reference.run,
            today: {
                feelsLikeF: weather?.feelsLikeF,
                windMph: weather?.windMph,
            },
        });
        return html`
            ${renderWalkPart({
                title: 'You',
                advice: you,
            })}
            ${renderWalkPart({
                title: 'Kids',
                advice: kids,
            })}
            ${conditions
                ? html`
                      <p>${conditions}</p>
                  `
                : nothing}
        `;
    }
}

/**
 * Home. With no run in progress: the temperature, what to wear (from past runs), and Start. With a
 * run in progress: a stopwatch and Finish.
 */
export const TodayScreen = defineElement()({
    tagName: 'today-screen',
    styles: css`
        ${screenStyles}

        .weather {
            flex-wrap: wrap;
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .temperature {
            font-size: 56px;
            font-weight: 700;
            line-height: 1;
            font-variant-numeric: tabular-nums;
        }

        .open-settings {
            flex-basis: 100%;
        }

        .manual-temperature {
            flex: 1;
            min-width: 0;
        }

        .manual-temperature input {
            font-size: 20px;
        }

        .weather-details {
            flex: 1;
            min-width: 0;
        }

        .advice h2 {
            margin-top: 0;
            font-size: 18px;
        }

        .advice h3 {
            margin: 0 0 4px;
            color: var(--run-muted);
            font-size: 13px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }

        .advice .part + .part {
            margin-top: 12px;
        }

        .advice p {
            margin: 0 0 6px;
        }

        .activity {
            display: flex;
            gap: 6px;
            margin: 0 0 12px;
        }

        .activity button {
            border-radius: 999px;
        }

        .activity button[aria-pressed='true'] {
            border-color: var(--run-accent);
            background: var(--run-selected);
            font-weight: 600;
        }

        .advice.stop {
            background: var(--run-stop-bg);
        }

        .advice.adjust {
            background: var(--run-adjust-bg);
        }

        .advice.go {
            background: var(--run-go-bg);
        }

        .route-choice {
            margin: 0 0 12px;
        }

        .recording {
            margin-top: 8px;
        }

        .running {
            text-align: center;
        }

        .clock {
            font-size: 56px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
        }
    `,
    state() {
        return {
            data: getRunStore().getData() as Readonly<UserData>,
            reading: undefined as WeatherReading | undefined,
            weatherError: '',
            typedTemperature: '',
            loadingWeather: false,
            starting: false,
            activity: activities.run as Activity,
            /** `''` for no route, a saved route's id, or {@link recordNewRoute}. */
            routeChoice: '',
            nowMs: Date.now(),
            runtime: {
                unsubscribe: undefined,
                ticker: undefined,
            } as Runtime,
        };
    },
    init({state, updateState}) {
        const store = getRunStore();
        state.runtime.unsubscribe = store.subscribe(() => {
            updateState({
                data: store.getData(),
            });
        });
        state.runtime.ticker = setInterval(() => {
            updateState({
                nowMs: Date.now(),
            });
        }, 1000);

        const location = store.getData().settings.location;
        if (!location) {
            return;
        }
        const cached = getCachedWeather(location);
        if (cached) {
            updateState({
                reading: cached.reading,
            });
        }
        updateState({
            loadingWeather: true,
        });
        freshWeather(location)
            .then((reading) => {
                updateState({
                    reading,
                    weatherError: '',
                    loadingWeather: false,
                });
            })
            .catch((error: unknown) => {
                updateState({
                    weatherError: error instanceof Error ? error.message : String(error),
                    loadingWeather: false,
                });
            });
    },
    cleanup({state}) {
        state.runtime.unsubscribe?.();
        clearInterval(state.runtime.ticker);
    },
    render({state, updateState}) {
        const {data} = state;
        const location = data.settings.location;
        const weather = state.reading?.weather;

        async function refresh() {
            if (!location) {
                return;
            }
            updateState({
                loadingWeather: true,
            });
            try {
                updateState({
                    reading: await fetchWeather(location),
                    weatherError: '',
                });
            } catch (error) {
                updateState({
                    weatherError: error instanceof Error ? error.message : String(error),
                });
            }
            updateState({
                loadingWeather: false,
            });
        }

        async function start() {
            updateState({
                starting: true,
            });
            let weather: Weather | undefined = state.reading?.weather;
            const typedTemperatureF = parseNumber(state.typedTemperature);
            if (location) {
                try {
                    weather = (await freshWeather(location)).weather;
                } catch {
                    /** Start anyway; the temperature can be typed in at the end. */
                }
            }
            const activeRun: ActiveRun = {
                activity: state.activity,
                startedAt: getNowInIsoString(),
                temperatureF: weather?.temperatureF ?? typedTemperatureF,
                feelsLikeF: weather?.feelsLikeF ?? null,
                windMph: weather?.windMph ?? null,
                precipitation: weather?.precipitation ?? null,
                routeId: data.routes.some((route) => route.id === state.routeChoice)
                    ? state.routeChoice
                    : null,
                recording:
                    state.routeChoice === recordNewRoute
                        ? {
                              points: [],
                          }
                        : null,
            };
            getRunStore().startRun(activeRun);
            diagnosticLog.log('run-start', {
                activity: state.activity,
                weather: weather ? 'yes' : 'no',
            });
            updateState({
                starting: false,
            });
        }

        if (data.activeRun) {
            const active = data.activeRun;
            const activeRoute = data.routes.find((route) => route.id === active.routeId);
            return html`
                <div class="card running">
                    <div class="muted">
                        ${active.activity === activities.walk ? 'Walk in progress' : 'Running'}
                    </div>
                    <div class="clock" role="timer">
                        ${formatElapsed(state.nowMs - Date.parse(active.startedAt))}
                    </div>
                    <div class="muted">
                        ${activeRoute
                            ? html`
                                  ${activeRoute.name} ·
                              `
                            : nothing}Started
                        ${formatClockTime(active.startedAt)}
                        ${active.temperatureF == undefined
                            ? nothing
                            : html`
                                  · ${round(active.temperatureF)}°F, feels like
                                  ${round(active.feelsLikeF)}°F
                              `}
                    </div>
                    ${active.recording
                        ? html`
                              <div class="recording" role="status">
                                  Recording route · ${formatMiles(gpsRecorder.getDistanceMiles())} ·
                                  keep the screen on
                              </div>
                              ${gpsRecorder.note
                                  ? html`
                                        <div class="muted">${gpsRecorder.note}</div>
                                    `
                                  : nothing}
                          `
                        : nothing}
                </div>
                <button
                    class="primary"
                    ${listen('click', () => {
                        gpsRecorder.flush();
                        goTo(['finish']);
                    })}
                >
                    ${active.activity === activities.walk ? 'Finish walk' : 'Finish run'}
                </button>
                <button
                    class="link danger"
                    ${listen('click', () => {
                        if (
                            globalThis.confirm(
                                active.activity === activities.walk
                                    ? 'Throw away this walk?'
                                    : 'Throw away this run?',
                            )
                        ) {
                            getRunStore().cancelRun();
                            diagnosticLog.log('run-cancel');
                        }
                    })}
                >
                    ${active.activity === activities.walk ? 'Cancel this walk' : 'Cancel this run'}
                </button>
            `;
        }

        const typedTemperatureF = parseNumber(state.typedTemperature) ?? undefined;
        const temperatureF = weather?.temperatureF ?? typedTemperatureF;
        const walking = state.activity === activities.walk;
        const advice = advise({
            activity: state.activity,
            runs: data.runs,
            temperatureF,
        });
        const kidsAdvice = adviseKids({
            runs: data.runs,
            temperatureF,
        });
        const tones = walking
            ? [
                  adviceTone(advice),
                  adviceTone(kidsAdvice),
              ]
            : [adviceTone(advice)];
        const tone = tones.includes('stop')
            ? 'stop'
            : tones.includes('adjust')
              ? 'adjust'
              : tones.includes('go')
                ? 'go'
                : '';

        const wetNote = describeWetNote(weather?.precipitation ?? null);

        return html`
            <div class="card weather">
                ${weather
                    ? html`
                          <div class="temperature" aria-label="Temperature">
                              ${round(weather.temperatureF)}°
                          </div>
                      `
                    : html`
                          <label class="manual-temperature">
                              Temperature °F
                              <input
                                  type="number"
                                  step="any"
                                  autocomplete="off"
                                  .value=${state.typedTemperature}
                                  ${listen('input', (event) => {
                                      updateState({
                                          typedTemperature: (event.target as HTMLInputElement)
                                              .value,
                                      });
                                  })}
                              />
                          </label>
                      `}
                <div class="weather-details">
                    ${weather
                        ? html`
                              <div>Feels like ${round(weather.feelsLikeF)}°</div>
                              <div>Wind ${round(weather.windMph)} mph</div>
                              ${weather.precipitation &&
                              weather.precipitation.kind !== precipitationKinds.none
                                  ? html`
                                        <div class="precipitation">
                                            ${describePrecipitation(weather.precipitation)}
                                        </div>
                                    `
                                  : nothing}
                          `
                        : nothing}
                    ${state.reading
                        ? html`
                              <div class="muted source">${describeSource(state.reading)}</div>
                          `
                        : nothing}
                    <div class="muted">
                        ${state.weatherError
                            ? html`
                                  <span class="error">${state.weatherError}</span>
                                  ${location
                                      ? html`
                                            <button
                                                class="link retry-weather"
                                                ?disabled=${state.loadingWeather}
                                                ${listen('click', () => void refresh())}
                                            >
                                                Retry
                                            </button>
                                        `
                                      : nothing}
                              `
                            : (location?.name ?? 'No location set')}
                    </div>
                </div>
                ${location
                    ? nothing
                    : html`
                          <button
                              class="link open-settings"
                              ${listen('click', () => goTo(['settings']))}
                          >
                              Open Settings to set your location
                          </button>
                      `}
                ${location
                    ? html`
                          <button
                              aria-label="Refresh temperature"
                              ?disabled=${state.loadingWeather}
                              ${listen('click', () => void refresh())}
                          >
                              ↻
                          </button>
                      `
                    : nothing}
            </div>
            <div class="activity" role="group" aria-label="Activity">
                ${activityOrder.map((activity) => {
                    return html`
                        <button
                            aria-pressed=${state.activity === activity ? 'true' : 'false'}
                            ${listen('click', () => {
                                updateState({
                                    activity,
                                });
                            })}
                        >
                            ${activityLabels[activity]}
                        </button>
                    `;
                })}
            </div>
            <div class="card advice ${tone}" aria-live="polite">
                ${walking
                    ? renderWalkAdvice({
                          you: advice,
                          kids: kidsAdvice,
                          hasLocation: !!location,
                          weather,
                      })
                    : renderAdvice(advice, !!location, weather)}
            </div>
            ${wetNote
                ? html`
                      <p class="muted wet-note">${wetNote}</p>
                  `
                : nothing}
            <label class="route-choice">
                Route
                <select
                    aria-label="Route"
                    ${listen('change', (event) => {
                        updateState({
                            routeChoice: (event.target as HTMLSelectElement).value,
                        });
                    })}
                >
                    <option value="" ?selected=${state.routeChoice === ''}>No route</option>
                    ${data.routes.map((route) => {
                        return html`
                            <option value=${route.id} ?selected=${state.routeChoice === route.id}>
                                ${route.name} · ${formatMiles(route.distanceMiles)}
                            </option>
                        `;
                    })}
                    <option
                        value=${recordNewRoute}
                        ?selected=${state.routeChoice === recordNewRoute}
                    >
                        Record a new route
                    </option>
                </select>
            </label>
            <button
                class="primary"
                ?disabled=${state.starting}
                ${listen('click', () => void start())}
            >
                ${state.starting ? 'Starting…' : walking ? 'Start walk' : 'Start run'}
            </button>
            <button class="link" ${listen('click', () => goTo(['log']))}>
                Log a run I already did
            </button>
            <button class="link week" ${listen('click', () => goTo(['goals']))}>
                ${describeWeek(
                    sessionsInRange({
                        runs: data.runs,
                        workouts: data.workouts,
                        ...currentWeekRangeMs(),
                    }),
                )}
            </button>
        `;
    },
});
