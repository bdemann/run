import {css, defineElement, html, listen, nothing} from 'element-vir';
import {feelings, feelingShortLabels} from '../../data/feelings.js';
import {formatMiles, paceText} from '../../data/gps.js';
import {type Run, type UserData} from '../../data/shapes.js';
import {goTo} from '../../router.js';
import {formatClockTime, formatRunDate} from '../dates.js';
import {renderRoutePreview} from '../route-preview.js';
import {getRunStore} from '../storage.js';
import {screenStyles} from '../styles.js';

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The stats that are known for a run, in display order (pace first). */
function runStats(run: Readonly<Run>): ReadonlyArray<{label: string; value: string}> {
    const pace = paceText({
        distanceMiles: run.distanceMiles,
        durationMinutes: run.durationMinutes,
    });
    return [
        {
            label: 'Pace',
            value: pace,
        },
        {
            label: 'Distance',
            value: run.distanceMiles ? formatMiles(run.distanceMiles) : '',
        },
        {
            label: 'Time',
            value: run.durationMinutes ? `${run.durationMinutes} min` : '',
        },
        {
            label: 'Feels like',
            value: run.feelsLikeF == undefined ? '' : `${Math.round(run.feelsLikeF)}°F`,
        },
        {
            label: 'Wind',
            value: run.windMph == undefined ? '' : `${Math.round(run.windMph)} mph`,
        },
    ].filter((stat) => stat.value);
}

/** One run in detail, with an Edit button. */
export const RunDetailsScreen = defineElement<{runId: string}>()({
    tagName: 'run-details-screen',
    styles: css`
        ${screenStyles}

        .temperature {
            font-size: 40px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
        }

        .feeling {
            font-size: 18px;
            font-weight: 600;
        }

        .feeling.miserable {
            color: var(--run-danger);
        }

        .stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin: 0;
        }

        .stats dt {
            color: var(--run-muted);
            font-size: 13px;
        }

        .stats dd {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            font-variant-numeric: tabular-nums;
        }

        h3 {
            margin: 0 0 8px;
            font-size: 14px;
            color: var(--run-muted);
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }

        .chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .chip {
            padding: 6px 12px;
            border: 1px solid var(--run-border);
            border-radius: 999px;
            background: var(--run-selected);
        }

        .notes {
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        .route-name {
            margin-bottom: 8px;
        }
    `,
    state() {
        return {
            data: getRunStore().getData() as Readonly<UserData>,
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
    render({inputs, state}) {
        const back = html`
            <button
                class="link"
                ${listen('click', () => {
                    goTo(['runs']);
                })}
            >
                ‹ Runs
            </button>
        `;
        const run = state.data.runs.find((candidate) => candidate.id === inputs.runId);
        if (!run) {
            return html`
                ${back}
                <p>Run not found.</p>
            `;
        }
        const route = run.routeId
            ? state.data.routes.find((candidate) => candidate.id === run.routeId)
            : undefined;
        const stats = runStats(run);
        return html`
            ${back}
            <h2>${formatRunDate(run.startedAt)} · ${formatClockTime(run.startedAt)}</h2>
            <div class="card">
                <div class="temperature">${Math.round(run.temperatureF)}°F</div>
                <div class="feeling ${run.feeling === feelings.miserable ? 'miserable' : ''}">
                    ${capitalize(feelingShortLabels[run.feeling])}
                </div>
            </div>
            ${stats.length
                ? html`
                      <dl class="card stats">
                          ${stats.map((stat) => {
                              return html`
                                  <div>
                                      <dt>${stat.label}</dt>
                                      <dd>${stat.value}</dd>
                                  </div>
                              `;
                          })}
                      </dl>
                  `
                : nothing}
            ${route
                ? html`
                      <div class="card">
                          <h3>Route</h3>
                          <div class="route-name">${route.name}</div>
                          ${renderRoutePreview({
                              points: route.points,
                              size: 120,
                          })}
                      </div>
                  `
                : nothing}
            <div class="card">
                <h3>Clothing</h3>
                ${run.clothing.length
                    ? html`
                          <div class="chips">
                              ${run.clothing.map((item) => {
                                  return html`
                                      <span class="chip">${item}</span>
                                  `;
                              })}
                          </div>
                      `
                    : html`
                          <span class="muted">Nothing logged</span>
                      `}
            </div>
            ${run.notes
                ? html`
                      <div class="card">
                          <h3>Notes</h3>
                          <div class="notes">${run.notes}</div>
                      </div>
                  `
                : nothing}
            <button
                class="primary"
                ${listen('click', () => {
                    goTo([
                        'runs',
                        run.id,
                        'edit',
                    ]);
                })}
            >
                Edit
            </button>
        `;
    },
});
