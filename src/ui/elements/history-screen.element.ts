import {css, defineElement, html, listen, nothing} from 'element-vir';
import {activities, type Activity} from '../../data/activities.js';
import {sortNewestFirst} from '../../data/advice.js';
import {describeClothing} from '../../data/clothing.js';
import {feelings, feelingShortLabels} from '../../data/feelings.js';
import {formatMiles, paceText} from '../../data/gps.js';
import {describePrecipitation, precipitationKinds} from '../../data/precipitation.js';
import {type Run, type UserData} from '../../data/shapes.js';
import {goTo} from '../../router.js';
import {formatRunDate} from '../dates.js';
import {getRunStore} from '../storage.js';
import {screenStyles} from '../styles.js';

type SortOrder = 'temperature' | 'date';

type Filter = 'all' | Activity;

const filters: ReadonlyArray<{filter: Filter; label: string}> = [
    {
        filter: 'all',
        label: 'All',
    },
    {
        filter: activities.run,
        label: 'Runs',
    },
    {
        filter: activities.walk,
        label: 'Walks',
    },
];

/** Coldest first (newest first within a temperature), or newest first. */
function sortRuns({
    runs,
    order,
}: Readonly<{runs: ReadonlyArray<Readonly<Run>>; order: SortOrder}>): Readonly<Run>[] {
    const newest = sortNewestFirst(runs);
    return order === 'date'
        ? newest
        : newest.toSorted((a, b) => Math.round(a.temperatureF) - Math.round(b.temperatureF));
}

/** "· 3.10 mi · 9:32 /mi", else "· 45 min", or nothing when neither is known. */
function describeEffort(run: Readonly<Run>): string {
    if (run.distanceMiles) {
        const pace = paceText({
            distanceMiles: run.distanceMiles,
            durationMinutes: run.durationMinutes,
        });
        return pace
            ? `· ${formatMiles(run.distanceMiles)} · ${pace}`
            : `· ${formatMiles(run.distanceMiles)}`;
    }
    return run.durationMinutes ? `· ${run.durationMinutes} min` : '';
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Every run, coldest first by default, so you can see what worked at each temperature. */
export const HistoryScreen = defineElement()({
    tagName: 'history-screen',
    styles: css`
        ${screenStyles}

        .sort,
        .filter {
            display: flex;
            gap: 6px;
            margin: 8px 0 12px;
        }

        .sort button,
        .filter button {
            border-radius: 999px;
        }

        .sort button[aria-pressed='true'],
        .filter button[aria-pressed='true'] {
            border-color: var(--run-accent);
            background: var(--run-selected);
            font-weight: 600;
        }

        ul {
            margin: 0;
            padding: 0;
            list-style: none;
        }

        li > button {
            display: grid;
            grid-template-columns: 64px 1fr;
            gap: 10px;
            width: 100%;
            margin-bottom: 8px;
            padding: 12px;
            border-radius: 12px;
            text-align: left;
        }

        .temperature {
            font-size: 24px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
        }

        .tag {
            margin-left: 6px;
            padding: 1px 8px;
            border: 1px solid var(--run-border);
            border-radius: 999px;
            color: var(--run-muted);
            font-size: 12px;
            font-weight: 400;
        }

        .feeling {
            font-weight: 600;
        }

        .feeling.miserable {
            color: var(--run-danger);
        }

        .details {
            min-width: 0;
            overflow-wrap: anywhere;
        }
    `,
    state() {
        return {
            data: getRunStore().getData() as Readonly<UserData>,
            order: 'temperature' as SortOrder,
            filter: 'all' as Filter,
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
    render({state, updateState}) {
        const runs = sortRuns({
            runs: state.data.runs.filter(
                (run) => state.filter === 'all' || run.activity === state.filter,
            ),
            order: state.order,
        });
        const orders: ReadonlyArray<{order: SortOrder; label: string}> = [
            {
                order: 'temperature',
                label: 'By temperature',
            },
            {
                order: 'date',
                label: 'Newest first',
            },
        ];
        return html`
            <h2>Runs</h2>
            <div class="sort">
                ${orders.map(({order, label}) => {
                    return html`
                        <button
                            aria-pressed=${state.order === order ? 'true' : 'false'}
                            ${listen('click', () => {
                                return updateState({
                                    order,
                                });
                            })}
                        >
                            ${label}
                        </button>
                    `;
                })}
            </div>
            <div class="filter" role="group" aria-label="Show">
                ${filters.map(({filter, label}) => {
                    return html`
                        <button
                            aria-pressed=${state.filter === filter ? 'true' : 'false'}
                            ${listen('click', () => {
                                return updateState({
                                    filter,
                                });
                            })}
                        >
                            ${label}
                        </button>
                    `;
                })}
            </div>
            ${runs.length
                ? html`
                      <ul>
                          ${runs.map((run) => {
                              return html`
                                  <li>
                                      <button
                                          ${listen('click', () => {
                                              return goTo([
                                                  'runs',
                                                  run.id,
                                              ]);
                                          })}
                                      >
                                          <span class="temperature">
                                              ${Math.round(run.temperatureF)}°
                                          </span>
                                          <span class="details">
                                              <span
                                                  class="feeling ${run.feeling ===
                                                  feelings.miserable
                                                      ? 'miserable'
                                                      : ''}"
                                              >
                                                  ${capitalize(feelingShortLabels[run.feeling])}
                                              </span>
                                              ${run.precipitation &&
                                              run.precipitation.kind !== precipitationKinds.none
                                                  ? html`
                                                        <span class="tag">
                                                            ${describePrecipitation(
                                                                run.precipitation,
                                                            )}
                                                        </span>
                                                    `
                                                  : nothing}
                                              ${run.activity === activities.walk
                                                  ? html`
                                                        <span class="tag">Walk</span>
                                                    `
                                                  : nothing}
                                              <br />
                                              ${capitalize(describeClothing(run.clothing))}
                                              <br />
                                              <span class="muted">
                                                  ${formatRunDate(run.startedAt)}
                                                  ${describeEffort(run)}
                                              </span>
                                          </span>
                                      </button>
                                  </li>
                              `;
                          })}
                      </ul>
                  `
                : html`
                      <p class="muted">No runs yet.</p>
                  `}
        `;
    },
});
