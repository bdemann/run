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
    summarizeWorkout,
} from '../../data/workout-plan.js';
import {
    measures,
    type ActiveWorkout,
    type Exercise,
    type Workout,
} from '../../data/workout-shapes.js';
import {retestDue} from '../../data/workouts.js';
import {goTo} from '../../router.js';
import {formatRunDate} from '../dates.js';
import {diagnosticLog} from '../diagnostics.js';
import {getRunStore} from '../storage.js';
import {screenStyles} from '../styles.js';
import {RetestCard} from './retest-card.element.js';

type Summary = {next: string; goals: ReadonlyArray<string>};

type Runtime = {unsubscribe: (() => void) | undefined};

const recentCount = 10;

function exerciseOf({
    data,
    id,
}: Readonly<{data: Readonly<UserData>; id: string}>): Readonly<Exercise> | undefined {
    return allExercises(data).find((exercise) => exercise.id === id);
}

/** "23 reps · 3 exercises" for a recent-workouts row. */
function describeWorkoutRow({
    workout,
    data,
}: Readonly<{workout: Readonly<Workout>; data: Readonly<UserData>}>): string {
    const summaries = summarizeWorkout({
        workout,
        data,
    });
    const reps = summaries
        .filter((summary) => summary.measure === measures.reps)
        .reduce((sum, summary) => sum + summary.total, 0);
    const exercises = `${summaries.length} ${summaries.length === 1 ? 'exercise' : 'exercises'}`;
    return reps ? `${reps} reps · ${exercises}` : exercises;
}

/** A typed count: positive numbers stay, anything else means "not done" (0). */
function doneValue(text: string): number {
    const parsed = parseNumber(text);
    return parsed != undefined && parsed > 0 ? parsed : 0;
}

type SetValueParams = Readonly<{workout: Readonly<ActiveWorkout>; index: number; value: number}>;

type SetVariationParams = Readonly<{
    workout: Readonly<ActiveWorkout>;
    index: number;
    variationId: string;
}>;

function renderActive({
    active,
    data,
    editingSet,
    confirmingCancel,
    setValue,
    setVariation,
    finish,
    edit,
    closeEdit,
    askCancel,
    cancel,
}: Readonly<{
    active: Readonly<ActiveWorkout>;
    data: Readonly<UserData>;
    editingSet: number | undefined;
    confirmingCancel: boolean;
    setValue: (params: SetValueParams) => void;
    setVariation: (params: SetVariationParams) => void;
    finish: (workout: Readonly<ActiveWorkout>) => void;
    edit: (index: number) => void;
    closeEdit: () => void;
    askCancel: (asking: boolean) => void;
    cancel: () => void;
}>): HtmlInterpolation {
    const doneCount = active.sets.filter((set) => set.value > 0).length;
    const exerciseIds = removeDuplicates(active.sets.map((set) => set.exerciseId));
    return html`
        <h2>${active.isTest ? 'Baseline test' : 'Workout'}</h2>
        ${active.isTest
            ? nothing
            : html`
                  <p class="muted">
                      Tap a set when you finish it. Tap it again to change the count.
                  </p>
              `}
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
            const editorIndexed = indexed.find(({index}) => index === editingSet);
            const editor =
                editorIndexed && editorIndexed.set.value > 0
                    ? {
                          ...editorIndexed,
                          number: indexed.indexOf(editorIndexed) + 1,
                      }
                    : undefined;
            const variationName =
                exercise?.variations.find((variation) => {
                    return variation.id === indexed[0]?.set.variationId;
                })?.name ?? '';
            return html`
                <div class="card">
                    <h3>${exercise?.name ?? exerciseId}</h3>
                    ${active.isTest && exercise
                        ? html`
                              <label class="variation">
                                  Variation
                                  <select
                                      ${listen('change', (event) => {
                                          setVariation({
                                              workout: active,
                                              index: indexed[0]?.index ?? 0,
                                              variationId: (event.target as HTMLSelectElement)
                                                  .value,
                                          });
                                      })}
                                  >
                                      ${exercise.variations.map((variation) => {
                                          return html`
                                              <option
                                                  value=${variation.id}
                                                  ?selected=${variation.id ===
                                                  indexed[0]?.set.variationId}
                                              >
                                                  ${variation.name}
                                              </option>
                                          `;
                                      })}
                                  </select>
                              </label>
                          `
                        : html`
                              <p class="variation">${variationName}</p>
                          `}
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
                                      return html`
                                          <button
                                              type="button"
                                              class="set-button"
                                              aria-pressed=${done ? 'true' : 'false'}
                                              ?data-editing=${editingSet === index && done}
                                              ${listen('click', () => {
                                                  if (!done) {
                                                      setValue({
                                                          workout: active,
                                                          index,
                                                          value: set.target,
                                                      });
                                                      closeEdit();
                                                  } else if (editingSet === index) {
                                                      closeEdit();
                                                  } else {
                                                      edit(index);
                                                  }
                                              })}
                                          >
                                              ${done ? set.value : set.target}
                                          </button>
                                      `;
                                  })}
                              </div>
                              ${editor
                                  ? html`
                                        <div class="set-editor">
                                            <span class="set-editor-label">
                                                Set ${editor.number} ·
                                                ${exercise?.measure === 'seconds'
                                                    ? 'seconds'
                                                    : 'reps'}
                                            </span>
                                            <button
                                                type="button"
                                                class="step"
                                                aria-label="Fewer"
                                                ?disabled=${editor.set.value <= 1}
                                                ${listen('click', () => {
                                                    setValue({
                                                        workout: active,
                                                        index: editor.index,
                                                        value: Math.max(1, editor.set.value - 1),
                                                    });
                                                })}
                                            >
                                                −
                                            </button>
                                            <span class="set-editor-value">
                                                ${editor.set.value}
                                            </span>
                                            <button
                                                type="button"
                                                class="step"
                                                aria-label="More"
                                                ${listen('click', () => {
                                                    setValue({
                                                        workout: active,
                                                        index: editor.index,
                                                        value: editor.set.value + 1,
                                                    });
                                                })}
                                            >
                                                +
                                            </button>
                                            <button
                                                type="button"
                                                ${listen('click', () => {
                                                    setValue({
                                                        workout: active,
                                                        index: editor.index,
                                                        value: 0,
                                                    });
                                                    closeEdit();
                                                })}
                                            >
                                                Not done
                                            </button>
                                            <button
                                                type="button"
                                                class="primary"
                                                ${listen('click', closeEdit)}
                                            >
                                                OK
                                            </button>
                                        </div>
                                    `
                                  : nothing}
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

        .set-button[data-editing] {
            outline: 3px solid var(--run-focus);
            outline-offset: 2px;
        }

        .set-editor {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            margin-top: 12px;
        }

        .set-editor-label {
            flex: 1 1 100%;
            color: var(--run-muted);
        }

        .set-editor button {
            min-width: 44px;
            min-height: 44px;
        }

        .set-editor-value {
            min-width: 48px;
            font-size: 22px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
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
            /** 'cancel' while asking to discard the workout in progress. */
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

        function setVariation({workout, index, variationId}: SetVariationParams) {
            store.updateActiveWorkout({
                ...workout,
                sets: workout.sets.map((set, setIndex) => {
                    return setIndex === index
                        ? {
                              ...set,
                              variationId,
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
                setVariation,
                finish,
                edit(index) {
                    updateState({
                        editingSet: index,
                    });
                },
                closeEdit() {
                    updateState({
                        editingSet: undefined,
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
            <button type="button" class="link goals-link" ${listen('click', () => goTo(['goals']))}>
                Goals
            </button>
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
                      <${RetestCard.assign({
                          onRetest() {
                              return start(true);
                          },
                      })}></${RetestCard}>
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
                              return html`
                                  <li>
                                      <button
                                          type="button"
                                          ${listen('click', () => {
                                              goTo([
                                                  'workout',
                                                  workout.id,
                                              ]);
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
                                              ${describeWorkoutRow({
                                                  workout,
                                                  data,
                                              })}
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
