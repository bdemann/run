import {getNowInIsoString} from 'date-vir';
import {css, defineElement, html, listen, nothing, type HtmlInterpolation} from 'element-vir';
import {allExercises} from '../../data/exercises.js';
import {deadlinePassed, sortGoals} from '../../data/goal-plan.js';
import {parseNumber} from '../../data/parse-number.js';
import {type UserData} from '../../data/shapes.js';
import {
    currentVariationId,
    describeGoal,
    needsBaseline,
    planWorkout,
} from '../../data/workout-plan.js';
import {type Goal} from '../../data/workout-shapes.js';
import {goalProgress, retestDue} from '../../data/workouts.js';
import {goTo} from '../../router.js';
import {dateInputToEndOfDayIso, formatRunDate, formatShortDate} from '../dates.js';
import {diagnosticLog} from '../diagnostics.js';
import {getRunStore} from '../storage.js';
import {screenStyles} from '../styles.js';
import {RetestCard} from './retest-card.element.js';

type Runtime = {unsubscribe: (() => void) | undefined};

/** The goals list and the add-goal form. Reached from the Workout screen and the weekly line. */
export const GoalsScreen = defineElement()({
    tagName: 'goals-screen',
    styles: css`
        ${screenStyles}

        .back {
            width: auto;
            margin-top: 8px;
        }

        .goal-title {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
        }

        /* A native <progress>: an inline style attribute would break the CSP. */
        .bar {
            appearance: none;
            display: block;
            width: 100%;
            height: 12px;
            margin: 10px 0 6px;
            border: none;
            border-radius: 6px;
            background: var(--run-selected);
            overflow: hidden;
        }

        .bar::-webkit-progress-bar {
            background: var(--run-selected);
        }

        .bar::-webkit-progress-value {
            border-radius: 6px;
            background: var(--run-accent);
        }

        .bar::-moz-progress-bar {
            border-radius: 6px;
            background: var(--run-accent);
        }

        .overdue {
            color: var(--run-danger);
        }

        .reached {
            color: var(--run-muted);
        }

        .reached .goal-title {
            font-weight: 400;
        }

        .field {
            margin-bottom: 12px;
        }

        .actions {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }

        .actions button {
            flex: 1;
        }

        .confirm {
            border-color: var(--run-danger);
        }
    `,
    state() {
        return {
            data: getRunStore().getData() as Readonly<UserData>,
            exerciseId: '',
            variationId: '',
            target: '',
            deadline: '',
            /** The id of the goal asked to delete. */
            confirming: undefined as string | undefined,
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
        const {data} = state;
        const exercises = allExercises(data);
        const exercise =
            exercises.find((candidate) => candidate.id === state.exerciseId) ?? exercises[0];
        const variationId =
            exercise?.variations.find((variation) => variation.id === state.variationId)?.id ??
            (exercise
                ? currentVariationId({
                      exercise,
                      workouts: data.workouts,
                  })
                : '');
        const targetNumber = parseNumber(state.target);
        const canSave = !!exercise && targetNumber != undefined && targetNumber > 0;
        const nowMs = Date.now();
        const {active, reached} = sortGoals(data.goals);

        function save() {
            if (!exercise || targetNumber == undefined || targetNumber <= 0) {
                return;
            }
            store.saveGoal({
                id: globalThis.crypto.randomUUID(),
                exerciseId: exercise.id,
                variationId,
                target: targetNumber,
                createdAt: getNowInIsoString(),
                deadline: dateInputToEndOfDayIso(state.deadline) ?? null,
                achievedAt: null,
            });
            diagnosticLog.log('goal-add');
            updateState({
                target: '',
                deadline: '',
            });
        }

        function renderDelete(goal: Readonly<Goal>): HtmlInterpolation {
            return state.confirming === goal.id
                ? html`
                      <p>Delete this goal?</p>
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
                                  store.deleteGoal(goal.id);
                                  updateState({
                                      confirming: undefined,
                                  });
                              })}
                          >
                              Delete
                          </button>
                      </div>
                  `
                : html`
                      <button
                          type="button"
                          class="link danger"
                          aria-label="Delete goal ${describeGoal({
                              goal,
                              data,
                          })}"
                          ${listen('click', () => {
                              updateState({
                                  confirming: goal.id,
                              });
                          })}
                      >
                          Delete
                      </button>
                  `;
        }

        return html`
            <button type="button" class="link back" ${listen('click', () => goTo(['workout']))}>
                ← Workout
            </button>
            <h2>Goals</h2>
            ${!needsBaseline(data) &&
            retestDue({
                workouts: data.workouts,
                nowMs,
            })
                ? html`
                      <${RetestCard.assign({
                          onRetest() {
                              store.startWorkout(
                                  planWorkout({
                                      data,
                                      isTest: true,
                                      startedAt: getNowInIsoString(),
                                  }),
                              );
                              diagnosticLog.log('workout-start', {
                                  test: 'yes',
                              });
                              goTo(['workout']);
                          },
                      })}></${RetestCard}>
                  `
                : nothing}
            ${active.length
                ? active.map((goal) => {
                      const goalExercise = exercises.find((candidate) => {
                          return candidate.id === goal.exerciseId;
                      });
                      const progress = goalExercise
                          ? goalProgress({
                                goal,
                                exercise: goalExercise,
                                workouts: data.workouts,
                            })
                          : undefined;
                      return html`
                          <div class="card goal">
                              <p class="goal-title">
                                  ${describeGoal({
                                      goal,
                                      data,
                                  })}
                              </p>
                              <progress
                                  class="bar"
                                  max=${goal.target}
                                  value=${progress?.best ?? 0}
                                  aria-label="Progress toward ${describeGoal({
                                      goal,
                                      data,
                                  })}"
                              ></progress>
                              <div class="muted">
                                  Best ${progress?.best ?? 0}
                                  ${goal.deadline
                                      ? html`
                                            ·
                                            <span
                                                class=${deadlinePassed({
                                                    goal,
                                                    nowMs,
                                                })
                                                    ? 'overdue'
                                                    : ''}
                                            >
                                                by ${formatShortDate(goal.deadline)}
                                            </span>
                                        `
                                      : nothing}
                              </div>
                              ${renderDelete(goal)}
                          </div>
                      `;
                  })
                : html`
                      <p class="muted">No goals yet. Add one below.</p>
                  `}
            <h2>Add a goal</h2>
            <div class="card">
                <label class="field">
                    Exercise
                    <select
                        ${listen('change', (event) => {
                            updateState({
                                exerciseId: (event.target as HTMLSelectElement).value,
                                variationId: '',
                            });
                        })}
                    >
                        ${exercises.map((option) => {
                            return html`
                                <option value=${option.id} ?selected=${option.id === exercise?.id}>
                                    ${option.name}
                                </option>
                            `;
                        })}
                    </select>
                </label>
                <label class="field">
                    Variation
                    <select
                        ${listen('change', (event) => {
                            updateState({
                                variationId: (event.target as HTMLSelectElement).value,
                            });
                        })}
                    >
                        ${(exercise?.variations ?? []).map((option) => {
                            return html`
                                <option value=${option.id} ?selected=${option.id === variationId}>
                                    ${option.name}
                                </option>
                            `;
                        })}
                    </select>
                </label>
                <label class="field">
                    Target (reps in one set)
                    <input
                        type="number"
                        min="1"
                        autocomplete="off"
                        .value=${state.target}
                        ${listen('input', (event) => {
                            updateState({
                                target: (event.target as HTMLInputElement).value,
                            });
                        })}
                    />
                </label>
                <label class="field">
                    Deadline (optional)
                    <input
                        type="date"
                        .value=${state.deadline}
                        ${listen('input', (event) => {
                            updateState({
                                deadline: (event.target as HTMLInputElement).value,
                            });
                        })}
                    />
                </label>
                <button
                    type="button"
                    class="primary"
                    ?disabled=${!canSave}
                    ${listen('click', save)}
                >
                    Add goal
                </button>
            </div>
            ${reached.length
                ? html`
                      <h2>Reached</h2>
                      ${reached.map((goal) => {
                          return html`
                              <div class="card reached">
                                  <p class="goal-title">
                                      ${describeGoal({
                                          goal,
                                          data,
                                      })}
                                  </p>
                                  <div class="muted">
                                      ${goal.achievedAt ? formatRunDate(goal.achievedAt) : ''}
                                  </div>
                                  ${renderDelete(goal)}
                              </div>
                          `;
                      })}
                  `
                : nothing}
        `;
    },
});
