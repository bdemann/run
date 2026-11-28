import {css, defineElement, html, listen, nothing} from 'element-vir';
import {type UserData} from '../../data/shapes.js';
import {summarizeWorkout, type ExerciseSummary} from '../../data/workout-plan.js';
import {measures} from '../../data/workout-shapes.js';
import {goTo} from '../../router.js';
import {formatClockTime, formatRunDate} from '../dates.js';
import {getRunStore} from '../storage.js';
import {screenStyles} from '../styles.js';

function unitLabel(summary: Readonly<ExerciseSummary>): string {
    return summary.measure === measures.seconds ? 's' : 'reps';
}

/** One workout in detail: every exercise with each set's value, and Delete. */
export const WorkoutDetailsScreen = defineElement<{workoutId: string}>()({
    tagName: 'workout-details-screen',
    styles: css`
        ${screenStyles}

        h3 {
            margin: 0;
            font-size: 18px;
        }

        .sets {
            margin: 8px 0;
            font-size: 28px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            overflow-wrap: anywhere;
        }

        .tag {
            margin-left: 6px;
            padding: 2px 8px;
            border: 1px solid var(--run-border);
            border-radius: 999px;
            color: var(--run-muted);
            font-size: 13px;
            font-weight: 400;
        }

        .actions {
            display: flex;
            gap: 8px;
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
            confirming: false,
            runtime: {
                unsubscribe: undefined as (() => void) | undefined,
            },
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
    render({inputs, state, updateState}) {
        const back = html`
            <button
                class="link"
                ${listen('click', () => {
                    goTo(['workout']);
                })}
            >
                ‹ Workout
            </button>
        `;
        const workout = state.data.workouts.find((candidate) => candidate.id === inputs.workoutId);
        if (!workout) {
            return html`
                ${back}
                <p>Workout not found.</p>
            `;
        }
        const summaries = summarizeWorkout({
            workout,
            data: state.data,
        });
        return html`
            ${back}
            <h2>
                ${formatRunDate(workout.startedAt)} · ${formatClockTime(workout.startedAt)}
                ${workout.isTest
                    ? html`
                          <span class="tag">Test</span>
                      `
                    : nothing}
            </h2>
            ${summaries.map((summary) => {
                const unit = unitLabel(summary);
                return html`
                    <div class="card">
                        <h3>${summary.name}</h3>
                        ${summary.variationName
                            ? html`
                                  <div class="muted">${summary.variationName}</div>
                              `
                            : nothing}
                        <div class="sets">
                            ${summary.values
                                .map((value) => (unit === 's' ? `${value} s` : String(value)))
                                .join(' · ')}
                        </div>
                        <div class="muted">Total ${summary.total} ${unit}</div>
                    </div>
                `;
            })}
            ${state.confirming
                ? html`
                      <div class="card confirm">
                          <p>Delete this workout?</p>
                          <div class="actions">
                              <button
                                  type="button"
                                  ${listen('click', () => {
                                      updateState({
                                          confirming: false,
                                      });
                                  })}
                              >
                                  Keep
                              </button>
                              <button
                                  type="button"
                                  class="danger"
                                  ${listen('click', () => {
                                      getRunStore().deleteWorkout(workout.id);
                                      goTo(['workout']);
                                  })}
                              >
                                  Delete
                              </button>
                          </div>
                      </div>
                  `
                : html`
                      <button
                          type="button"
                          class="danger"
                          ${listen('click', () => {
                              updateState({
                                  confirming: true,
                              });
                          })}
                      >
                          Delete workout
                      </button>
                  `}
        `;
    },
});
