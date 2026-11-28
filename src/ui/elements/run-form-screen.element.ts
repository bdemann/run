import {getNowInIsoString} from 'date-vir';
import {css, defineElement, html, listen, nothing} from 'element-vir';
import {activities, activityLabels, type Activity} from '../../data/activities.js';
import {
    addClothingItem,
    clothingGroups,
    defaultKidsClothing,
    prefillForTemperature,
} from '../../data/clothing.js';
import {minutesSince} from '../../data/elapsed.js';
import {feelingLabels, feelingOrder, type Feeling} from '../../data/feelings.js';
import {formatMiles, paceText, simplifyPoints, trackDistanceMiles} from '../../data/gps.js';
import {parseNumber} from '../../data/parse-number.js';
import {type RecordedPoint, type Route, type Run} from '../../data/shapes.js';
import {goTo} from '../../router.js';
import {inputValueToIso, isoToInputValue} from '../dates.js';
import {diagnosticLog} from '../diagnostics.js';
import {renderRoutePreview} from '../route-preview.js';
import {getRunStore} from '../storage.js';
import {screenStyles} from '../styles.js';
import {getCachedWeather} from '../weather-client.js';

/** `finish` the run in progress, `log` one after the fact, or `edit` a saved one. */
export type RunFormMode = 'finish' | 'log' | 'edit';

/** Number fields are kept as typed text until Save. */
type Draft = {
    id: string | undefined;
    startedAt: string;
    durationMinutes: string;
    temperatureF: string;
    feelsLikeF: string;
    windMph: string;
    activity: Activity;
    clothing: string[];
    feeling: Feeling | undefined;
    /** Walks only. */
    kidsClothing: string[];
    kidsFeeling: Feeling | undefined;
    notes: string;
    /** A saved route's id, or `''` for none. */
    routeId: string;
    distanceMiles: string;
    /** Name to save the recorded track under; empty means do not save it as a route. */
    routeName: string;
};

/** A distance as typed: two decimals at most, no trailing zeros. */
function distanceText(miles: number | null | undefined): string {
    return miles == undefined ? '' : String(Math.round(miles * 100) / 100);
}

function numberText(value: number | null | undefined): string {
    return value == undefined ? '' : String(Math.round(value));
}

/** The form's starting values, and a note when they were filled in from a past run. */
function initialDraft({mode, runId}: Readonly<{mode: RunFormMode; runId?: string | undefined}>): {
    draft: Draft | undefined;
    note: string | undefined;
    recorded: RecordedPoint[];
} {
    const store = getRunStore();
    const data = store.getData();
    if (mode === 'edit') {
        const run = runId ? store.getRun(runId) : undefined;
        return {
            draft: run && {
                id: run.id,
                startedAt: isoToInputValue(run.startedAt),
                durationMinutes: numberText(run.durationMinutes),
                temperatureF: numberText(run.temperatureF),
                feelsLikeF: numberText(run.feelsLikeF),
                windMph: numberText(run.windMph),
                activity: run.activity,
                clothing: [...run.clothing],
                feeling: run.feeling,
                kidsClothing: [...run.kidsClothing],
                kidsFeeling: run.kidsFeeling ?? undefined,
                notes: run.notes,
                routeId: run.routeId ?? '',
                distanceMiles: distanceText(run.distanceMiles),
                routeName: '',
            },
            note: undefined,
            recorded: [],
        };
    }

    let base: Omit<
        Draft,
        | 'clothing'
        | 'feeling'
        | 'notes'
        | 'id'
        | 'routeName'
        | 'activity'
        | 'kidsClothing'
        | 'kidsFeeling'
    >;
    let activity: Activity = activities.run;
    let recorded: RecordedPoint[] = [];
    if (mode === 'finish') {
        const active = data.activeRun;
        if (!active) {
            return {
                draft: undefined,
                note: undefined,
                recorded: [],
            };
        }
        activity = active.activity;
        recorded = active.recording?.points ?? [];
        const route = data.routes.find((existing) => existing.id === active.routeId);
        base = {
            startedAt: isoToInputValue(active.startedAt),
            durationMinutes: String(
                minutesSince({
                    startedAt: active.startedAt,
                    nowMs: Date.now(),
                }),
            ),
            temperatureF: numberText(active.temperatureF),
            feelsLikeF: numberText(active.feelsLikeF),
            windMph: numberText(active.windMph),
            routeId: route?.id ?? '',
            distanceMiles:
                recorded.length > 1
                    ? distanceText(trackDistanceMiles(recorded))
                    : distanceText(route?.distanceMiles),
        };
    } else {
        const location = data.settings.location;
        const weather = location ? getCachedWeather(location)?.reading.weather : undefined;
        base = {
            startedAt: isoToInputValue(getNowInIsoString()),
            durationMinutes: '',
            temperatureF: numberText(weather?.temperatureF),
            feelsLikeF: numberText(weather?.feelsLikeF),
            windMph: numberText(weather?.windMph),
            routeId: '',
            distanceMiles: '',
        };
    }
    const prefill = prefillForTemperature({
        activity,
        runs: data.runs,
        temperatureF: parseNumber(base.temperatureF) ?? undefined,
    });
    return {
        draft: {
            ...base,
            id: undefined,
            activity,
            clothing: prefill.clothing,
            feeling: prefill.feeling,
            kidsClothing: prefill.kidsClothing,
            kidsFeeling: prefill.kidsFeeling,
            notes: '',
            routeName: '',
        },
        note: prefill.note,
        recorded: recorded.map((point) => {
            return {
                ...point,
            };
        }),
    };
}

/** Finish, log or edit a run: weather, what you wore and how it felt. */
export const RunFormScreen = defineElement<{mode: RunFormMode; runId?: string | undefined}>()({
    tagName: 'run-form-screen',
    styles: css`
        ${screenStyles}

        .row {
            display: flex;
            gap: 10px;
        }

        .row > label {
            flex: 1;
            min-width: 0;
        }

        form > label,
        .row {
            margin: 12px 0;
        }

        fieldset {
            margin: 16px 0;
            padding: 8px 12px 12px;
            border: 1px solid var(--run-border);
            border-radius: 12px;
        }

        legend {
            padding: 0 6px;
            font-weight: 600;
        }

        .group-name {
            margin: 10px 0 4px;
            color: var(--run-muted);
            font-size: 13px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }

        .chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .chips button {
            border-radius: 999px;
        }

        .activity {
            display: flex;
            gap: 6px;
            margin: 0 0 12px;
        }

        .activity button {
            border-radius: 999px;
        }

        .activity button[aria-pressed='true'],
        .chips button[aria-pressed='true'],
        .feelings button[aria-pressed='true'] {
            border-color: var(--run-accent);
            background: var(--run-selected);
            font-weight: 600;
        }

        .feelings {
            display: grid;
            gap: 6px;
        }

        .feelings button {
            text-align: left;
        }

        .recorded {
            flex-wrap: wrap;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .recorded label {
            flex: 1;
            min-width: 0;
        }

        .recorded p {
            flex-basis: 100%;
        }

        .add-item {
            display: flex;
            gap: 6px;
            margin-top: 12px;
        }
    `,
    state({inputs}) {
        const {draft, note, recorded} = initialDraft(inputs);
        return {
            draft,
            note,
            /** The GPS track recorded during this run (finish mode only). */
            recorded,
            /** Distance typed by hand: choosing a route no longer fills it in. */
            distanceTouched: false,
            newItem: '',
            newKidsItem: '',
            error: '',
            /** Clothing or feeling picked by hand: a new temperature no longer refills them. */
            answersTouched: false,
            /** Feels-like or wind typed by hand: a new temperature no longer clears them. */
            weatherTouched: false,
        };
    },
    render({inputs, state, updateState}) {
        const {draft} = state;
        const store = getRunStore();

        function back() {
            if (inputs.mode !== 'edit') {
                goTo([]);
            } else if (inputs.runId && draft) {
                goTo([
                    'runs',
                    inputs.runId,
                ]);
            } else {
                goTo(['runs']);
            }
        }

        if (!draft) {
            return html`
                <p>
                    ${inputs.mode === 'edit'
                        ? 'That run was not found.'
                        : 'There is no run in progress.'}
                </p>
                <button class="link" ${listen('click', back)}>Back</button>
            `;
        }

        function change(partial: Partial<Draft>) {
            if (!draft) {
                return;
            }
            updateState({
                draft: {
                    ...draft,
                    ...partial,
                },
                error: '',
            });
        }

        /** What the form refills for a new temperature or activity (not on edit). */
        function refill({
            temperatureF,
            activity,
        }: Readonly<{temperatureF: string; activity: Activity}>): Partial<Draft> {
            const prefill = prefillForTemperature({
                activity,
                runs: store.getData().runs,
                temperatureF: parseNumber(temperatureF) ?? undefined,
            });
            updateState({
                note: prefill.note,
            });
            return {
                clothing: prefill.clothing,
                feeling: prefill.feeling,
                kidsClothing: prefill.kidsClothing,
                kidsFeeling: prefill.kidsFeeling,
            };
        }

        function changeActivity(activity: Activity) {
            if (!draft) {
                return;
            }
            change({
                activity,
                ...(inputs.mode === 'edit' || state.answersTouched
                    ? {}
                    : refill({
                          temperatureF: draft.temperatureF,
                          activity,
                      })),
            });
        }

        function changeTemperature(text: string) {
            if (!draft) {
                return;
            } else if (inputs.mode === 'edit') {
                change({
                    temperatureF: text,
                });
                return;
            }
            /**
             * A new run whose answers were filled in automatically: refill them for the typed
             * temperature. The looked-up feels-like and wind were for the old temperature, so they
             * are cleared unless typed by hand.
             */
            change({
                temperatureF: text,
                ...(state.answersTouched
                    ? {}
                    : refill({
                          temperatureF: text,
                          activity: draft.activity,
                      })),
                ...(state.weatherTouched
                    ? {}
                    : {
                          feelsLikeF: '',
                          windMph: '',
                      }),
            });
        }

        function toggleItem(item: string) {
            if (!draft) {
                return;
            }
            updateState({
                answersTouched: true,
            });
            change({
                clothing: draft.clothing.includes(item)
                    ? draft.clothing.filter((existing) => existing !== item)
                    : [
                          ...draft.clothing,
                          item,
                      ],
            });
        }

        function toggleKidsItem(item: string) {
            if (!draft) {
                return;
            }
            updateState({
                answersTouched: true,
            });
            change({
                kidsClothing: draft.kidsClothing.includes(item)
                    ? draft.kidsClothing.filter((existing) => existing !== item)
                    : [
                          ...draft.kidsClothing,
                          item,
                      ],
            });
        }

        function addKidsItem() {
            if (!draft) {
                return;
            }
            const added = addClothingItem({
                customClothing: store.getData().settings.customClothing,
                typed: state.newKidsItem,
                defaults: defaultKidsClothing,
            });
            if (!added) {
                return;
            }
            store.setCustomClothing(added.customClothing);
            updateState({
                newKidsItem: '',
            });
            if (!draft.kidsClothing.includes(added.item)) {
                toggleKidsItem(added.item);
            }
        }

        function addItem() {
            if (!draft) {
                return;
            }
            const added = addClothingItem({
                customClothing: store.getData().settings.customClothing,
                typed: state.newItem,
            });
            if (!added) {
                return;
            }
            store.setCustomClothing(added.customClothing);
            updateState({
                newItem: '',
            });
            if (!draft.clothing.includes(added.item)) {
                toggleItem(added.item);
            }
        }

        function save() {
            if (!draft) {
                return;
            }
            const temperatureF = parseNumber(draft.temperatureF);
            const startedAt = inputValueToIso(draft.startedAt);
            if (temperatureF == undefined) {
                updateState({
                    error: 'Enter the temperature.',
                });
                return;
            } else if (!draft.feeling) {
                updateState({
                    error: 'Pick how you felt.',
                });
                return;
            } else if (draft.activity === activities.walk && !draft.kidsFeeling) {
                updateState({
                    error: 'Pick how the kids felt.',
                });
                return;
            } else if (!startedAt) {
                updateState({
                    error: 'Enter when you went out.',
                });
                return;
            }
            const distanceMiles = parseNumber(draft.distanceMiles);
            const routeName = draft.routeName.trim();
            let routeId = draft.routeId || null;
            if (state.recorded.length > 1 && routeName) {
                const route: Route = {
                    id: globalThis.crypto.randomUUID(),
                    name: routeName,
                    distanceMiles: Math.round(trackDistanceMiles(state.recorded) * 100) / 100,
                    points: simplifyPoints(state.recorded),
                    createdAt: getNowInIsoString(),
                };
                store.saveRoute(route);
                routeId = route.id;
                diagnosticLog.log('route-saved', {
                    points: route.points.length,
                });
            }
            const isWalk = draft.activity === activities.walk;
            const run: Run = {
                id: draft.id ?? globalThis.crypto.randomUUID(),
                startedAt,
                durationMinutes: parseNumber(draft.durationMinutes),
                temperatureF,
                feelsLikeF: parseNumber(draft.feelsLikeF),
                windMph: parseNumber(draft.windMph),
                clothing: draft.clothing,
                feeling: draft.feeling,
                notes: draft.notes.trim(),
                routeId,
                distanceMiles,
                activity: draft.activity,
                kidsFeeling: isWalk ? (draft.kidsFeeling ?? null) : null,
                kidsClothing: isWalk ? draft.kidsClothing : [],
            };
            store.saveRun({
                run,
                finishesActiveRun: inputs.mode === 'finish',
            });
            if (inputs.mode === 'finish') {
                diagnosticLog.log('run-finish');
            }
            back();
        }

        const walking = draft.activity === activities.walk;
        const headings: Record<RunFormMode, string> = walking
            ? {
                  finish: 'Finish walk',
                  log: 'Log a walk',
                  edit: 'Edit walk',
              }
            : {
                  finish: 'How did it go?',
                  log: 'Log a run',
                  edit: 'Edit run',
              };

        const routes = store.getData().routes;
        const pace = paceText({
            distanceMiles: parseNumber(draft.distanceMiles),
            durationMinutes: parseNumber(draft.durationMinutes),
        });
        const groups = clothingGroups({
            customClothing: store.getData().settings.customClothing,
            selected: draft.clothing,
        });
        const kidsGroups = clothingGroups({
            customClothing: store.getData().settings.customClothing,
            selected: draft.kidsClothing,
            defaults: defaultKidsClothing,
        });

        return html`
            <h2>${headings[inputs.mode]}</h2>
            <div class="activity" role="group" aria-label="Activity">
                ${[
                    activities.run,
                    activities.walk,
                ].map((activity) => {
                    return html`
                        <button
                            type="button"
                            aria-pressed=${draft.activity === activity ? 'true' : 'false'}
                            ${listen('click', () => changeActivity(activity))}
                        >
                            ${activityLabels[activity]}
                        </button>
                    `;
                })}
            </div>
            ${state.note
                ? html`
                      <p class="muted">${state.note}</p>
                  `
                : nothing}
            <form
                novalidate
                ${listen('submit', (event) => {
                    event.preventDefault();
                    save();
                })}
            >
                <div class="row">
                    <label>
                        When
                        <input
                            type="datetime-local"
                            .value=${draft.startedAt}
                            ${listen('input', (event) => {
                                change({
                                    startedAt: (event.target as HTMLInputElement).value,
                                });
                            })}
                        />
                    </label>
                    <label>
                        Minutes
                        <input
                            type="number"
                            inputmode="numeric"
                            min="0"
                            .value=${draft.durationMinutes}
                            ${listen('input', (event) => {
                                change({
                                    durationMinutes: (event.target as HTMLInputElement).value,
                                });
                            })}
                        />
                    </label>
                </div>
                <div class="row">
                    <label>
                        Temp °F
                        <input
                            type="number"
                            .value=${draft.temperatureF}
                            ${listen('change', (event) => {
                                changeTemperature((event.target as HTMLInputElement).value);
                            })}
                        />
                    </label>
                    <label>
                        Feels like °F
                        <input
                            type="number"
                            .value=${draft.feelsLikeF}
                            ${listen('input', (event) => {
                                updateState({
                                    weatherTouched: true,
                                });
                                change({
                                    feelsLikeF: (event.target as HTMLInputElement).value,
                                });
                            })}
                        />
                    </label>
                    <label>
                        Wind mph
                        <input
                            type="number"
                            inputmode="numeric"
                            min="0"
                            .value=${draft.windMph}
                            ${listen('input', (event) => {
                                updateState({
                                    weatherTouched: true,
                                });
                                change({
                                    windMph: (event.target as HTMLInputElement).value,
                                });
                            })}
                        />
                    </label>
                </div>

                <div class="row">
                    <label>
                        Route
                        <select
                            aria-label="Route"
                            ${listen('change', (event) => {
                                const routeId = (event.target as HTMLSelectElement).value;
                                const route = routes.find((existing) => existing.id === routeId);
                                change({
                                    routeId,
                                    ...(route && !state.distanceTouched
                                        ? {
                                              distanceMiles: distanceText(route.distanceMiles),
                                          }
                                        : {}),
                                });
                            })}
                        >
                            <option value="" ?selected=${draft.routeId === ''}>No route</option>
                            ${routes.map((route) => {
                                return html`
                                    <option
                                        value=${route.id}
                                        ?selected=${draft.routeId === route.id}
                                    >
                                        ${route.name} · ${formatMiles(route.distanceMiles)}
                                    </option>
                                `;
                            })}
                        </select>
                    </label>
                    <label>
                        Distance (mi)
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            .value=${draft.distanceMiles}
                            ${listen('input', (event) => {
                                updateState({
                                    distanceTouched: true,
                                });
                                change({
                                    distanceMiles: (event.target as HTMLInputElement).value,
                                });
                            })}
                        />
                    </label>
                </div>
                ${pace
                    ? html`
                          <p class="muted pace">${pace}</p>
                      `
                    : nothing}
                ${state.recorded.length > 1
                    ? html`
                          <div class="card recorded">
                              ${renderRoutePreview({
                                  points: state.recorded,
                                  size: 96,
                              })}
                              <label>
                                  Save this route as
                                  <input
                                      type="text"
                                      placeholder="River loop"
                                      enterkeyhint="done"
                                      .value=${draft.routeName}
                                      ${listen('input', (event) => {
                                          change({
                                              routeName: (event.target as HTMLInputElement).value,
                                          });
                                      })}
                                  />
                              </label>
                              <p class="muted">
                                  Recorded ${formatMiles(trackDistanceMiles(state.recorded))}. Leave
                                  the name empty to skip saving the route.
                              </p>
                          </div>
                      `
                    : nothing}

                <fieldset>
                    <legend>What were you wearing?</legend>
                    ${groups.map((group) => {
                        return html`
                            <div class="group-name">${group.name}</div>
                            <div class="chips">
                                ${group.items.map((item) => {
                                    return html`
                                        <button
                                            type="button"
                                            aria-pressed=${draft.clothing.includes(item)
                                                ? 'true'
                                                : 'false'}
                                            ${listen('click', () => toggleItem(item))}
                                        >
                                            ${item}
                                        </button>
                                    `;
                                })}
                            </div>
                        `;
                    })}
                    <div class="add-item">
                        <input
                            type="text"
                            aria-label="Add a clothing item"
                            placeholder="Something else…"
                            enterkeyhint="done"
                            .value=${state.newItem}
                            ${listen('input', (event) => {
                                updateState({
                                    newItem: (event.target as HTMLInputElement).value,
                                });
                            })}
                            ${listen('keydown', (event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addItem();
                                }
                            })}
                        />
                        <button type="button" ${listen('click', addItem)}>Add</button>
                    </div>
                </fieldset>

                <fieldset>
                    <legend>How did you feel?</legend>
                    <div class="feelings">
                        ${feelingOrder.map((feeling) => {
                            return html`
                                <button
                                    type="button"
                                    aria-pressed=${draft.feeling === feeling ? 'true' : 'false'}
                                    ${listen('click', () => {
                                        updateState({
                                            answersTouched: true,
                                        });
                                        change({
                                            feeling,
                                        });
                                    })}
                                >
                                    ${feelingLabels[feeling]}
                                </button>
                            `;
                        })}
                    </div>
                </fieldset>
                ${walking
                    ? html`
                          <fieldset>
                              <legend>How were the kids?</legend>
                              <div class="feelings kids-feelings">
                                  ${feelingOrder.map((feeling) => {
                                      return html`
                                          <button
                                              type="button"
                                              aria-pressed=${draft.kidsFeeling === feeling
                                                  ? 'true'
                                                  : 'false'}
                                              ${listen('click', () => {
                                                  updateState({
                                                      answersTouched: true,
                                                  });
                                                  change({
                                                      kidsFeeling: feeling,
                                                  });
                                              })}
                                          >
                                              ${feelingLabels[feeling]}
                                          </button>
                                      `;
                                  })}
                              </div>
                          </fieldset>

                          <fieldset>
                              <legend>Kids wore</legend>
                              ${kidsGroups.map((group) => {
                                  return html`
                                      <div class="group-name">${group.name}</div>
                                      <div class="chips">
                                          ${group.items.map((item) => {
                                              return html`
                                                  <button
                                                      type="button"
                                                      aria-pressed=${draft.kidsClothing.includes(
                                                          item,
                                                      )
                                                          ? 'true'
                                                          : 'false'}
                                                      ${listen('click', () => toggleKidsItem(item))}
                                                  >
                                                      ${item}
                                                  </button>
                                              `;
                                          })}
                                      </div>
                                  `;
                              })}
                              <div class="add-item">
                                  <input
                                      type="text"
                                      aria-label="Add a clothing item for the kids"
                                      placeholder="Something else…"
                                      enterkeyhint="done"
                                      .value=${state.newKidsItem}
                                      ${listen('input', (event) => {
                                          updateState({
                                              newKidsItem: (event.target as HTMLInputElement).value,
                                          });
                                      })}
                                      ${listen('keydown', (event) => {
                                          if (event.key === 'Enter') {
                                              event.preventDefault();
                                              addKidsItem();
                                          }
                                      })}
                                  />
                                  <button type="button" ${listen('click', addKidsItem)}>Add</button>
                              </div>
                          </fieldset>
                      `
                    : nothing}

                <label>
                    Notes
                    <textarea
                        rows="3"
                        placeholder="Hands froze the first mile, fine after that…"
                        .value=${draft.notes}
                        ${listen('input', (event) => {
                            change({
                                notes: (event.target as HTMLTextAreaElement).value,
                            });
                        })}
                    ></textarea>
                </label>

                ${state.error
                    ? html`
                          <p class="error" role="alert">${state.error}</p>
                      `
                    : nothing}
                <button type="submit" class="primary">${walking ? 'Save walk' : 'Save run'}</button>
                <button type="button" class="link" ${listen('click', back)}>
                    ${inputs.mode === 'finish' ? 'Back to the run' : 'Cancel'}
                </button>
                ${inputs.mode === 'edit' && draft.id
                    ? html`
                          <button
                              type="button"
                              class="link danger"
                              ${listen('click', () => {
                                  if (
                                      draft.id &&
                                      globalThis.confirm(
                                          walking ? 'Delete this walk?' : 'Delete this run?',
                                      )
                                  ) {
                                      store.deleteRun(draft.id);
                                      goTo(['runs']);
                                  }
                              })}
                          >
                              ${walking ? 'Delete walk' : 'Delete run'}
                          </button>
                      `
                    : nothing}
            </form>
        `;
    },
});
