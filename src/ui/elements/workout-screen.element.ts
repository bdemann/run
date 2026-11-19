import {removeDuplicates} from '@augment-vir/common';
import {getNowInIsoString} from 'date-vir';
import {css, defineElement, html, listen, nothing, type HtmlInterpolation} from 'element-vir';
import {allExercises} from '../../data/exercises.js';
import {parseNumber} from '../../data/parse-number.js';
import {type UserData} from '../../data/shapes.js';
import {
    describeGoal,
    describeNextTime,
    finishedWorkout,
    goalsReachedBetween,
    needsBaseline,
    planWorkout,
    totalSets,
} from '../../data/workout-plan.js';
import {type ActiveWorkout, type Exercise} from '../../data/workout-shapes.js';
import {retestDue} from '../../data/workouts.js';
import {formatRunDate} from '../dates.js';
import {diagnosticLog} from '../diagnostics.js';
import {getRunStore} from '../storage.js';
import {screenStyles} from '../styles.js';

type Summary = {next: string; goals: ReadonlyArray<string>};

type Runtime = {unsubscribe: (() => void) | undefined};

const recentCount = 10;

function exerciseOf({
    data,
    id,
}: Readonly<{data: Readonly<UserData>; id: string}>): Readonly<Exercise> | undefined {
    return allExercises(data).find((exercise) => exercise.id === id);
}

/** A typed count: positive numbers stay, anything else means "not done" (0). */
function doneValue(text: string): number {
    const parsed = parseNumber(text);
    return parsed != undefined && parsed > 0 ? parsed : 0;
}

type SetValueParams = Readonly<{workout: Readonly<ActiveWorkout>; index: number; value: number}>;

function renderActive({
    active,
    data,
    editingSet,
    confirmingCancel,
    setValue,
    finish,
    edit,
    askCancel,
    cancel,
}: Readonly<{
    active: Readonly<ActiveWorkout>;
    data: Readonly<UserData>;
    editingSet: number | undefined;
    confirmingCancel: boolean;
    setValue: (params: SetValueParams) => void;
    finish: (workout: Readonly<ActiveWorkout>) => void;
    edit: (index: number) => void;
    askCancel: (asking: boolean) => void;
    cancel: () => void;
}>): HtmlInterpolation {
    const doneCount = active.sets.filter((set) => set.value > 0).length;
    const exerciseIds = removeDuplicates(active.sets.map((set) => set.exerciseId));
    return html`
        <h2>${active.isTest ? 'Baseline test' : 'Workout'}</h2>
        ${exerciseIds.map((exerciseId) => {
            const exercise = exerciseOf({
                data,
                id: exerciseId,
            });
            const indexed = active.sets
                .map((set, index) => {
                    return {
                        set,
                        index,
                    };
                })
                .filter(({set}) => set.exerciseId === exerciseId);
            const variationName =
                exercise?.variations.find((variation) => {
                    return variation.id === indexed[0]?.set.variationId;
                })?.name ?? '';
            return html`
                <div class="card">
                    <h3>${exercise?.name ?? exerciseId}</h3>
                    <p class="variation">${variationName}</p>
                    ${exercise?.cues.length
                        ? html`
                              <details>
                                  <summary>Form</summary>
                                  <ul class="cues">
                                      ${exercise.cues.map((cue) => {
                                          return html`
                                              <li>${cue}</li>
                                          `;
                                      })}
                                  </ul>
                              </details>
                          `
                        : nothing}
                    ${active.isTest
                        ? html`
                              <label>
                                  As many as you can with good form
                                  <input
                                      type="number"
                                      min="0"
                                      .value=${String(indexed[0]?.set.value || '')}
                                      ${listen('input', (event) => {
                                          setValue({
                                              workout: active,
                                              index: indexed[0]?.index ?? 0,
                                              value: doneValue(
                                                  (event.target as HTMLInputElement).value,
                                              ),
                                          });
                                      })}
                                  />
                              </label>
                          `
                        : html`
                              <div class="sets">
                                  ${indexed.map(({set, index}) => {
                                      const done = set.value > 0;
                                      return editingSet === index && done
                                          ? html`
                                                <input
                                                    class="set-edit"
                                                    type="number"
                                                    min="0"
                                                    aria-label="Reps done"
                                                    .value=${String(set.value)}
                                                    ${listen('change', (event) => {
                                                        setValue({
                                                            workout: active,
                                                            index,
                                                            value: doneValue(
                                                                (event.target as HTMLInputElement)
                                                                    .value,
                                                            ),
                                                        });
                                                    })}
                                                />
                                            `
                                          : html`
                                                <button
                                                    type="button"
                                                    class="set-button"
                                                    aria-pressed=${done ? 'true' : 'false'}
                                                    ${listen('click', () => {
                                                        if (done) {
                                                            edit(index);
                                                        } else {
                                                            setValue({
                                                                workout: active,
                                                                index,
                                                                value: set.target,
                                                            });
                                                        }
                                                    })}
                                                >
                                                    ${done ? set.value : set.target}
                                                </button>
                                            `;
                                  })}
                              </div>
                          `}
                </div>
            `;
        })}
        ${confirmingCancel
            ? html`
                  <div class="card confirm">
                      <p>Discard this workout?</p>
                      <div class="actions">
                          <button type="button" ${listen('click', () => askCancel(false))}>
                              Keep going
                          </button>
                          <button type="button" class="danger" ${listen('click', cancel)}>
                              Discard
                          </button>
                      </div>
                  </div>
              `
            : html`
                  <div class="actions">
                      <button type="button" ${listen('click', () => askCancel(true))}>
                          Cancel
                      </button>
                      <button
                          type="button"
                          class="primary"
                          ?disabled=${doneCount === 0}
                          ${listen('click', () => finish(active))}
                      >
                          Finish
                      </button>
                  </div>
              `}
    `;
}

/** The Workout tab: start a workout, log sets with one tap each, and see recent ones. */
export const WorkoutScreen = defineElement()({
    tagName: 'workout-screen',
    styles: css`
        ${screenStyles}

        .card.muted-card {
            background: var(--run-go-bg);
        }

        h3 {
            margin: 0 0 4px;
            font-size: 18px;
        }

        .variation {
            margin: 0 0 8px;
            color: var(--run-muted);
        }

        details {
            margin: 0 0 10px;
            color: var(--run-muted);
            font-size: 15px;
        }

        summary {
            min-height: 32px;
            cursor: pointer;
        }

        .cues {
            padding-left: 20px;
            list-style: disc;
        }

        .sets {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .set-button {
            min-width: 64px;
            min-height: 56px;
            border-radius: 12px;
            font-size: 22px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
        }

        .set-button[aria-pressed='true'] {
            border-color: var(--run-accent);
            background: var(--run-selected);
            color: var(--run-text);
        }

        .set-edit {
            width: 72px;
            min-height: 56px;
            font-size: 22px;
            text-align: center;
        }

        .actions {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }

        .actions button {
            flex: 1;
        }

        .actions button.primary {
            flex: 2;
            margin-top: 0;
        }

        .recent {
            margin: 0;
            padding: 0;
            list-style: none;
        }

        .recent > li > button {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            width: 100%;
            margin-bottom: 8px;
            text-align: left;
        }

        .tag {
            margin-left: 6px;
            padding: 2px 8px;
            border: 1px solid var(--run-border);
            border-radius: 999px;
            color: var(--run-muted);
            font-size: 13px;
        }

        .confirm {
            border-color: var(--run-danger);
        }
    `,
    state() {
        return {
            data: getRunStore().getData() as Readonly<UserData>,
            summary: undefined as Summary | undefined,
            /** 'cancel', or the id of the workout asked to delete. */
            confirming: undefined as string | undefined,
            editingSet: undefined as number | undefined,
            runtime: {
                unsubscribe: undefined,
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
    },
    cleanup({state}) {
        state.runtime.unsubscribe?.();
    },
    render({state, updateState}) {
        const store = getRunStore();
        const data = state.data;
        const active = data.activeWorkout;

        function start(isTest: boolean) {
            store.startWorkout(
                planWorkout({
                    data,
                    isTest,
                    startedAt: getNowInIsoString(),
                }),
            );
            diagnosticLog.log('workout-start', {
                test: isTest ? 'yes' : 'no',
            });
            updateState({
                summary: undefined,
                editingSet: undefined,
            });
        }

        function setValue({workout, index, value}: SetValueParams) {
            store.updateActiveWorkout({
                ...workout,
                sets: workout.sets.map((set, setIndex) => {
                    return setIndex === index
                        ? {
                              ...set,
                              value,
                          }
                        : set;
                }),
            });
        }

        function finish(workout: Readonly<ActiveWorkout>) {
            const goalsBefore = store.getData().goals;
            const saved = finishedWorkout({
                active: workout,
                id: globalThis.crypto.randomUUID(),
            });
            store.finishWorkout(saved);
            const after = store.getData();
            diagnosticLog.log('workout-finish', {
                sets: saved.sets.length,
            });
            updateState({
                editingSet: undefined,
                summary: {
                    next: describeNextTime(after),
                    goals: goalsReachedBetween({
                        before: goalsBefore,
                        after: after.goals,
                    }).map((goal) => {
                        return describeGoal({
                            goal,
                            data: after,
                        });
                    }),
                },
            });
        }

        if (active) {
            return renderActive({
                active,
                data,
                editingSet: state.editingSet,
                confirmingCancel: state.confirming === 'cancel',
                setValue,
                finish,
                edit(index) {
                    updateState({
                        editingSet: index,
                    });
                },
                askCancel(asking) {
                    updateState({
                        confirming: asking ? 'cancel' : undefined,
                    });
                },
                cancel() {
                    store.cancelWorkout();
                    diagnosticLog.log('workout-cancel');
                    updateState({
                        confirming: undefined,
                        editingSet: undefined,
                    });
                },
            });
        }

        const baseline = needsBaseline(data);
        const recent = data.workouts
            .toSorted((first, second) => {
                if (first.startedAt === second.startedAt) {
                    return 0;
                }
                return first.startedAt < second.startedAt ? 1 : -1;
            })
            .slice(0, recentCount);
        return html`
            <h2>Workout</h2>
            ${state.summary
                ? html`
                      <div class="card summary" role="status">
                          <strong>Saved.</strong>
                          ${state.summary.goals.map((goal) => {
                              return html`
                                  <p>Goal reached: ${goal}</p>
                              `;
                          })}
                          ${state.summary.next
                              ? html`
                                    <p class="muted">Next time: ${state.summary.next}</p>
                                `
                              : nothing}
                      </div>
                  `
                : nothing}
            ${!baseline &&
            retestDue({
                workouts: data.workouts,
                nowMs: Date.now(),
            })
                ? html`
                      <div class="card muted-card">
                          <p>It's been a while. Retest to see how far you've come.</p>
                          <button type="button" ${listen('click', () => start(true))}>
                              Retest
                          </button>
                      </div>
                  `
                : nothing}
            <button type="button" class="primary" ${listen('click', () => start(baseline))}>
                ${baseline ? 'Start baseline test' : 'Start workout'}
            </button>
            <h2>Recent workouts</h2>
            ${recent.length
                ? html`
                      <ul class="recent">
                          ${recent.map((workout) => {
                              return state.confirming === workout.id
                                  ? html`
                                        <li class="card confirm">
                                            <p>Delete this workout?</p>
                                            <div class="actions">
                                                <button
                                                    type="button"
                                                    ${listen('click', () => {
                                                        updateState({
                                                            confirming: undefined,
                                                        });
                                                    })}
                                                >
                                                    Keep
                                                </button>
                                                <button
                                                    type="button"
                                                    class="danger"
                                                    ${listen('click', () => {
                                                        store.deleteWorkout(workout.id);
                                                        updateState({
                                                            confirming: undefined,
                                                        });
                                                    })}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </li>
                                    `
                                  : html`
                                        <li>
                                            <button
                                                type="button"
                                                ${listen('click', () => {
                                                    updateState({
                                                        confirming: workout.id,
                                                    });
                                                })}
                                            >
                                                <span>
                                                    ${formatRunDate(workout.startedAt)}
                                                    ${workout.isTest
                                                        ? html`
                                                              <span class="tag">Test</span>
                                                          `
                                                        : nothing}
                                                </span>
                                                <span class="muted">
                                                    ${totalSets(workout)} sets
                                                </span>
                                            </button>
                                        </li>
                                    `;
                          })}
                      </ul>
                  `
                : html`
                      <p class="muted">No workouts yet.</p>
                  `}
        `;
    },
});
