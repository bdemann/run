import {getNowInIsoString} from 'date-vir';
import {css, defineElement, html, listen, nothing} from 'element-vir';
import {removeClothingItem} from '../../data/clothing.js';
import {type RunLocation, type UserData} from '../../data/shapes.js';
import {exportFilename} from '../../data/user-data.js';
import {getRunStore} from '../storage.js';
import {screenStyles} from '../styles.js';
import {locateDevice, searchPlaces} from '../weather-client.js';

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function downloadJson({filename, value}: {filename: string; value: unknown}) {
    const blob = new Blob([JSON.stringify(value, null, 2)], {
        type: 'application/json',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

/** Where to look up the temperature, and backing up the data. */
export const SettingsScreen = defineElement()({
    tagName: 'settings-screen',
    styles: css`
        ${screenStyles}

        .search {
            display: flex;
            gap: 6px;
            margin-top: 8px;
        }

        ul {
            margin: 8px 0;
            padding: 0;
            list-style: none;
        }

        li + li {
            margin-top: 6px;
        }

        li button {
            width: 100%;
            text-align: left;
        }

        .buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .custom-items li {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }

        .custom-items li button {
            width: auto;
            min-width: 44px;
            min-height: 44px;
        }

        .button-like {
            display: inline-flex;
            align-items: center;
        }

        input[type='file'] {
            display: none;
        }
    `,
    state() {
        return {
            data: getRunStore().getData() as Readonly<UserData>,
            query: '',
            places: [] as RunLocation[],
            status: '',
            busy: false,
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
        const store = getRunStore();
        const location = state.data.settings.location;

        async function useDevice() {
            updateState({
                busy: true,
                status: 'Finding you…',
            });
            try {
                store.setLocation(await locateDevice());
                updateState({
                    status: '',
                });
            } catch (error) {
                updateState({
                    status: `Couldn't get your location: ${errorText(error)}`,
                });
            }
            updateState({
                busy: false,
            });
        }

        async function search() {
            if (!state.query.trim()) {
                return;
            }
            updateState({
                busy: true,
                status: 'Searching…',
            });
            try {
                const places = await searchPlaces(state.query);
                updateState({
                    places,
                    status: places.length ? '' : 'Nothing found.',
                });
            } catch (error) {
                updateState({
                    status: `Search failed: ${errorText(error)}`,
                });
            }
            updateState({
                busy: false,
            });
        }

        async function importFile(file: File) {
            try {
                const {imported, dropped} = store.importData(JSON.parse(await file.text()));
                const skipped = dropped ? ` (${dropped} unreadable ones skipped)` : '';
                updateState({
                    status: `Imported ${imported} runs${skipped}.`,
                });
            } catch (error) {
                updateState({
                    status: `Import failed: ${errorText(error)}`,
                });
            }
        }

        return html`
            <h2>Location</h2>
            <p class="muted">
                ${location ? `Temperatures are for ${location.name}.` : 'No location set yet.'}
            </p>
            <button ?disabled=${state.busy} ${listen('click', () => void useDevice())}>
                Use my current location
            </button>
            <form
                class="search"
                ${listen('submit', (event) => {
                    event.preventDefault();
                    void search();
                })}
            >
                <input
                    type="search"
                    aria-label="Search for a city"
                    placeholder="…or search for a city"
                    .value=${state.query}
                    ${listen('input', (event) => {
                        updateState({
                            query: (event.target as HTMLInputElement).value,
                        });
                    })}
                />
                <button type="submit" ?disabled=${state.busy}>Search</button>
            </form>
            ${state.places.length
                ? html`
                      <ul>
                          ${state.places.map((place) => {
                              return html`
                                  <li>
                                      <button
                                          ${listen('click', () => {
                                              store.setLocation(place);
                                              updateState({
                                                  places: [],
                                                  query: '',
                                              });
                                          })}
                                      >
                                          ${place.name}
                                      </button>
                                  </li>
                              `;
                          })}
                      </ul>
                  `
                : nothing}

            <h2>Your clothing items</h2>
            ${state.data.settings.customClothing.length
                ? html`
                      <ul class="custom-items">
                          ${state.data.settings.customClothing.map((item) => {
                              return html`
                                  <li>
                                      <span>${item}</span>
                                      <button
                                          aria-label="Remove ${item}"
                                          ${listen('click', () => {
                                              store.setCustomClothing(
                                                  removeClothingItem({
                                                      customClothing:
                                                          state.data.settings.customClothing,
                                                      item,
                                                  }),
                                              );
                                          })}
                                      >
                                          Remove
                                      </button>
                                  </li>
                              `;
                          })}
                      </ul>
                      <p class="muted">Removing an item does not change past runs.</p>
                  `
                : html`
                      <p class="muted">Items you add in the run form show up here.</p>
                  `}

            <h2>Your data</h2>
            <p class="muted">
                Runs are saved on this device only. Install the app (Add to Home screen) so the
                browser keeps them, and export now and then so you never lose them.
            </p>
            <div class="buttons">
                <button
                    ${listen('click', () => {
                        downloadJson({
                            filename: exportFilename(getNowInIsoString()),
                            value: store.getData(),
                        });
                    })}
                >
                    Export runs
                </button>
                <label class="button-like">
                    Import runs
                    <input
                        type="file"
                        accept="application/json,.json"
                        ${listen('change', (event) => {
                            const input = event.target as HTMLInputElement;
                            const file = input.files?.[0];
                            input.value = '';
                            if (file) {
                                void importFile(file);
                            }
                        })}
                    />
                </label>
            </div>
            ${state.status
                ? html`
                      <p role="status">${state.status}</p>
                  `
                : nothing}
        `;
    },
});
