import {AboutPage, BottomNav, FeedbackPage, SlideDrawer} from '@bdemann/app-kit/ui';
import {css, defineElement, html, listen, type HtmlInterpolation} from 'element-vir';
import {appName, repoUrl} from '../../data/app-info.js';
import {
    goTo,
    router,
    runIdOf,
    screenForRoute,
    workoutIdOf,
    type RunRoute,
    type Screen,
} from '../../router.js';
import {buildInfo} from '../build-info.js';
import {diagnosticLog} from '../diagnostics.js';
import {syncGpsRecorder} from '../gps-recorder.js';
import {
    feedbackContactStorageKey,
    feedbackDraftStorageKey,
    fetchLatestCommit,
    rememberPageBeforeFeedback,
    sendFeedback,
} from '../send-feedback.js';
import {getRunStore} from '../storage.js';
import {GoalsScreen} from './goals-screen.element.js';
import {HistoryScreen} from './history-screen.element.js';
import {RunDetailsScreen} from './run-details-screen.element.js';
import {RunFormScreen} from './run-form-screen.element.js';
import {SettingsScreen} from './settings-screen.element.js';
import {TodayScreen} from './today-screen.element.js';
import {WorkoutDetailsScreen} from './workout-details-screen.element.js';
import {WorkoutScreen} from './workout-screen.element.js';

diagnosticLog.captureErrors();

/** Add a tab here (id, label, href, icon path, route) and it shows up in the bottom nav. */
const navTabs = [
    {
        id: 'today',
        label: 'Today',
        href: '/',
        paths: [] as const,
        /** Material "directions_run". */
        iconPath:
            'M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9 1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z',
    },
    {
        id: 'workout',
        label: 'Workout',
        href: '/workout',
        paths: ['workout'] as const,
        /** Material "fitness_center". */
        iconPath:
            'M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z',
    },
    {
        id: 'history',
        label: 'Runs',
        href: '/runs',
        paths: ['runs'] as const,
        /** Material "history". */
        iconPath:
            'M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
    },
    {
        id: 'settings',
        label: 'Settings',
        href: '/settings',
        paths: ['settings'] as const,
        /** Material "settings". */
        iconPath:
            'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    },
];

/** Which tab a screen highlights. About and Feedback (from the menu) have none. */
function tabIdForScreen(screen: Screen): string | undefined {
    if (screen === 'workout' || screen === 'workout-details' || screen === 'goals') {
        return 'workout';
    } else if (screen === 'history' || screen === 'run-details' || screen === 'edit') {
        return 'history';
    } else if (screen === 'settings') {
        return 'settings';
    } else if (screen === 'about' || screen === 'feedback') {
        return undefined;
    } else {
        return 'today';
    }
}

function renderScreen(route: Readonly<RunRoute>): HtmlInterpolation {
    const screen = screenForRoute(route);
    if (screen === 'finish' || screen === 'log') {
        return html`
            <${RunFormScreen.assign({
                mode: screen,
            })}></${RunFormScreen}>
        `;
    } else if (screen === 'run-details') {
        return html`
            <${RunDetailsScreen.assign({
                runId: runIdOf(route) ?? '',
            })}></${RunDetailsScreen}>
        `;
    } else if (screen === 'edit') {
        return html`
            <${RunFormScreen.assign({
                mode: 'edit',
                runId: runIdOf(route),
            })}></${RunFormScreen}>
        `;
    } else if (screen === 'workout-details') {
        return html`
            <${WorkoutDetailsScreen.assign({
                workoutId: workoutIdOf(route) ?? '',
            })}></${WorkoutDetailsScreen}>
        `;
    } else if (screen === 'workout') {
        return html`
            <${WorkoutScreen}></${WorkoutScreen}>
        `;
    } else if (screen === 'goals') {
        return html`
            <${GoalsScreen}></${GoalsScreen}>
        `;
    } else if (screen === 'history') {
        return html`
            <${HistoryScreen}></${HistoryScreen}>
        `;
    } else if (screen === 'settings') {
        return html`
            <${SettingsScreen}></${SettingsScreen}>
        `;
    } else if (screen === 'about') {
        return html`
            <${AboutPage.assign({
                appName,
                logoUrl: '/icon-192.png',
                repoUrl,
                buildInfo,
                fetchLatestCommit,
                links: [
                    {
                        label: 'Feedback',
                        href: '/feedback',
                    },
                ],
            })}></${AboutPage}>
        `;
    } else if (screen === 'feedback') {
        return html`
            <${FeedbackPage.assign({
                send: sendFeedback,
                draftStorageKey: feedbackDraftStorageKey,
                contactFields: true,
                contactStorageKey: feedbackContactStorageKey,
                honeypot: true,
                diagnostics: diagnosticLog.feedbackDiagnostics({
                    info() {
                        const data = getRunStore().getData();
                        return {
                            runs: data.runs.length,
                            locationSet: !!data.settings.location,
                            activeRun: !!data.activeRun,
                        };
                    },
                    note: 'App events and errors only. No locations or run notes.',
                }),
            })}></${FeedbackPage}>
        `;
    } else {
        return html`
            <${TodayScreen}></${TodayScreen}>
        `;
    }
}

export const RunApp = defineElement()({
    tagName: 'run-app',
    styles: css`
        :host {
            display: block;
            box-sizing: border-box;
            max-width: 560px;
            margin: 0 auto;
            padding: 8px 16px 32px;
            padding-left: max(16px, env(safe-area-inset-left));
            padding-right: max(16px, env(safe-area-inset-right));
            /* Room for the fixed bottom nav (56px bar plus the home indicator). */
            padding-bottom: calc(80px + env(safe-area-inset-bottom));
            color: var(--run-text);
        }

        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-height: 52px;
            padding-top: env(safe-area-inset-top);
        }

        h1 {
            margin: 0;
            font-size: 22px;
        }

        .menu-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 44px;
            min-height: 44px;
            padding: 0;
            border: 1px solid var(--run-border);
            border-radius: 10px;
            background: var(--run-surface);
            color: var(--run-text);
            cursor: pointer;
        }

        .menu-button svg {
            width: 24px;
            height: 24px;
            fill: currentColor;
        }

        .drawer-content {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .drawer-content button {
            min-height: 44px;
            border: 1px solid var(--run-border);
            border-radius: 8px;
            background: var(--run-surface);
            color: var(--run-text);
            font: inherit;
            text-align: left;
            cursor: pointer;
        }

        :is(button, a):focus-visible {
            outline: 3px solid var(--run-focus);
            outline-offset: 2px;
        }
    `,
    state() {
        return {
            route: router.readCurrentRoute() as RunRoute,
            menuOpen: false,
            runtime: {
                removeRouteListener: undefined as (() => void) | undefined,
                unsubscribeStore: undefined as (() => void) | undefined,
            },
        };
    },
    init({state, updateState}) {
        /** Resumes a route recording after a reload and stops it when the run ends. */
        syncGpsRecorder();
        state.runtime.unsubscribeStore = getRunStore().subscribe(syncGpsRecorder);
        state.runtime.removeRouteListener = router.listen(false, (route) => {
            if (screenForRoute(route) !== 'feedback') {
                rememberPageBeforeFeedback(globalThis.location.pathname);
            }
            updateState({
                route,
                menuOpen: false,
            });
            globalThis.scrollTo(0, 0);
        });
    },
    cleanup({state}) {
        state.runtime.removeRouteListener?.();
        state.runtime.unsubscribeStore?.();
    },
    render({state, updateState}) {
        const screen = screenForRoute(state.route);
        return html`
            <header>
                <h1>${appName}</h1>
                <button
                    type="button"
                    class="menu-button"
                    aria-label="Menu"
                    aria-expanded=${state.menuOpen ? 'true' : 'false'}
                    aria-haspopup="dialog"
                    ${listen('click', () => {
                        updateState({
                            menuOpen: true,
                        });
                    })}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                    </svg>
                </button>
            </header>
            <main>${renderScreen(state.route)}</main>
            <${BottomNav.assign({
                tabs: navTabs,
                currentId: tabIdForScreen(screen),
            })}
                ${listen(BottomNav.events.tabSelected, (event) => {
                    const tab = navTabs.find((candidate) => candidate.id === event.detail);
                    if (tab) {
                        goTo([...tab.paths]);
                    }
                })}
            ></${BottomNav}>
            <${SlideDrawer.assign({
                open: state.menuOpen,
                label: 'Menu',
            })}
                ${listen(SlideDrawer.events.closeRequested, () => {
                    updateState({
                        menuOpen: false,
                    });
                })}
            >
                <div class="drawer-content">
                    <button data-drawer-close ${listen('click', () => goTo(['about']))}>
                        About
                    </button>
                    <button data-drawer-close ${listen('click', () => goTo(['feedback']))}>
                        Send feedback
                    </button>
                </div>
            </${SlideDrawer}>
        `;
    },
});
