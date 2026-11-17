import {getNowInIsoString} from 'date-vir';
import {css, defineElement, html, listen, nothing} from 'element-vir';
import {addClothingItem, clothingGroups, prefillForTemperature} from '../../data/clothing.js';
import {minutesSince} from '../../data/elapsed.js';
import {feelingLabels, feelingOrder, type Feeling} from '../../data/feelings.js';
import {parseNumber} from '../../data/parse-number.js';
import {type Run} from '../../data/shapes.js';
import {goTo} from '../../router.js';
import {inputValueToIso, isoToInputValue} from '../dates.js';
import {diagnosticLog} from '../diagnostics.js';
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
    clothing: string[];
    feeling: Feeling | undefined;
    notes: string;
};

function numberText(value: number | null | undefined): string {
    return value == undefined ? '' : String(Math.round(value));
}

/** The form's starting values, and a note when they were filled in from a past run. */
function initialDraft({mode, runId}: Readonly<{mode: RunFormMode; runId?: string | undefined}>): {
    draft: Draft | undefined;
    note: string | undefined;
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
                clothing: [...run.clothing],
                feeling: run.feeling,
                notes: run.notes,
            },
            note: undefined,
        };
    }

    let base: Omit<Draft, 'clothing' | 'feeling' | 'notes' | 'id'>;
    if (mode === 'finish') {
        const active = data.activeRun;
        if (!active) {
            return {
                draft: undefined,
                note: undefined,
            };
        }
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
        };
    } else {
        const location = data.settings.location;
        const weather = location ? getCachedWeather(location)?.weather : undefined;
        base = {
            startedAt: isoToInputValue(getNowInIsoString()),
            durationMinutes: '',
            temperatureF: numberText(weather?.temperatureF),
            feelsLikeF: numberText(weather?.feelsLikeF),
            windMph: numberText(weather?.windMph),
        };
    }
    const prefill = prefillForTemperature({
        runs: data.runs,
        temperatureF: parseNumber(base.temperatureF) ?? undefined,
    });
    return {
        draft: {
            ...base,
            id: undefined,
            clothing: prefill.clothing,
            feeling: prefill.feeling,
            notes: '',
        },
        note: prefill.note,
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

        .add-item {
            display: flex;
            gap: 6px;
            margin-top: 12px;
        }
    `,
    state({inputs}) {
        const {draft, note} = initialDraft(inputs);
        return {
            draft,
            note,
            newItem: '',
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
            goTo(inputs.mode === 'edit' ? ['runs'] : []);
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
            const prefill = state.answersTouched
                ? undefined
                : prefillForTemperature({
                      runs: store.getData().runs,
                      temperatureF: parseNumber(text) ?? undefined,
                  });
            if (prefill) {
                updateState({
                    note: prefill.note,
                });
            }
            change({
                temperatureF: text,
                ...(prefill
                    ? {
                          clothing: prefill.clothing,
                          feeling: prefill.feeling,
                      }
                    : {}),
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
            } else if (!startedAt) {
                updateState({
                    error: 'Enter when you ran.',
                });
                return;
            }
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

        const headings: Record<RunFormMode, string> = {
            finish: 'How did it go?',
            log: 'Log a run',
            edit: 'Edit run',
        };

        const groups = clothingGroups({
            customClothing: store.getData().settings.customClothing,
            selected: draft.clothing,
        });

        return html`
            <h2>${headings[inputs.mode]}</h2>
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
                <button type="submit" class="primary">Save run</button>
                <button type="button" class="link" ${listen('click', back)}>
                    ${inputs.mode === 'finish' ? 'Back to the run' : 'Cancel'}
                </button>
                ${inputs.mode === 'edit' && draft.id
                    ? html`
                          <button
                              type="button"
                              class="link danger"
                              ${listen('click', () => {
                                  if (draft.id && globalThis.confirm('Delete this run?')) {
                                      store.deleteRun(draft.id);
                                      back();
                                  }
                              })}
                          >
                              Delete run
                          </button>
                      `
                    : nothing}
            </form>
        `;
    },
});
