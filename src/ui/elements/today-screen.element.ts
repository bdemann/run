import {getNowInIsoString} from 'date-vir';
import {css, defineElement, html, listen, nothing, type HtmlInterpolation} from 'element-vir';
import {
    advise,
    describeConditionsDifference,
    suggestionHeadings,
    suggestions,
    type Advice,
} from '../../data/advice.js';
import {describeClothing} from '../../data/clothing.js';
import {formatElapsed} from '../../data/elapsed.js';
import {feelingShortLabels} from '../../data/feelings.js';
import {parseNumber} from '../../data/parse-number.js';
import {type ActiveRun, type UserData} from '../../data/shapes.js';
import {type Weather} from '../../data/weather.js';
import {goTo} from '../../router.js';
import {formatClockTime, formatRunDate} from '../dates.js';
import {getRunStore} from '../storage.js';
import {screenStyles} from '../styles.js';
import {fetchWeather, freshWeather, getCachedWeather} from '../weather-client.js';

type Runtime = {
    unsubscribe: (() => void) | undefined;
    ticker: ReturnType<typeof setInterval> | undefined;
};

function round(value: number | null | undefined): string {
    return value == undefined ? '--' : String(Math.round(value));
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

        .advice.stop {
            background: var(--run-stop-bg);
        }

        .advice.adjust {
            background: var(--run-adjust-bg);
        }

        .advice.go {
            background: var(--run-go-bg);
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
            weather: undefined as Weather | undefined,
            weatherError: '',
            typedTemperature: '',
            loadingWeather: false,
            starting: false,
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
                weather: cached.weather,
            });
        }
        updateState({
            loadingWeather: true,
        });
        freshWeather(location)
            .then((weather) => {
                updateState({
                    weather,
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

        async function refresh() {
            if (!location) {
                return;
            }
            updateState({
                loadingWeather: true,
            });
            try {
                updateState({
                    weather: await fetchWeather(location),
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
            let weather = state.weather;
            const typedTemperatureF = parseNumber(state.typedTemperature);
            if (location) {
                try {
                    weather = await freshWeather(location);
                } catch {
                    /** Start anyway; the temperature can be typed in at the end. */
                }
            }
            const activeRun: ActiveRun = {
                startedAt: getNowInIsoString(),
                temperatureF: weather?.temperatureF ?? typedTemperatureF,
                feelsLikeF: weather?.feelsLikeF ?? null,
                windMph: weather?.windMph ?? null,
            };
            getRunStore().startRun(activeRun);
            updateState({
                starting: false,
            });
        }

        if (data.activeRun) {
            const active = data.activeRun;
            return html`
                <div class="card running">
                    <div class="muted">Running</div>
                    <div class="clock" role="timer">
                        ${formatElapsed(state.nowMs - Date.parse(active.startedAt))}
                    </div>
                    <div class="muted">
                        Started ${formatClockTime(active.startedAt)}
                        ${active.temperatureF == undefined
                            ? nothing
                            : html`
                                  · ${round(active.temperatureF)}°F, feels like
                                  ${round(active.feelsLikeF)}°F
                              `}
                    </div>
                </div>
                <button class="primary" ${listen('click', () => goTo(['finish']))}>
                    Finish run
                </button>
                <button
                    class="link danger"
                    ${listen('click', () => {
                        if (globalThis.confirm('Throw away this run?')) {
                            getRunStore().cancelRun();
                        }
                    })}
                >
                    Cancel this run
                </button>
            `;
        }

        const typedTemperatureF = parseNumber(state.typedTemperature) ?? undefined;
        const temperatureF = state.weather?.temperatureF ?? typedTemperatureF;
        const advice = advise({
            runs: data.runs,
            temperatureF,
        });

        return html`
            <div class="card weather">
                ${state.weather
                    ? html`
                          <div class="temperature" aria-label="Temperature">
                              ${round(state.weather.temperatureF)}°
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
                    ${state.weather
                        ? html`
                              <div>Feels like ${round(state.weather.feelsLikeF)}°</div>
                              <div>Wind ${round(state.weather.windMph)} mph</div>
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
            <div class="card advice ${adviceTone(advice)}" aria-live="polite">
                ${renderAdvice(advice, !!location, state.weather)}
            </div>
            <button
                class="primary"
                ?disabled=${state.starting}
                ${listen('click', () => void start())}
            >
                ${state.starting ? 'Starting…' : 'Start run'}
            </button>
            <button class="link" ${listen('click', () => goTo(['log']))}>
                Log a run I already did
            </button>
        `;
    },
});
