import {createDiagnosticLog} from '@bdemann/app-kit/ui';

/**
 * The app's diagnostic log, attached to feedback when the person agrees. PRIVACY: log events and
 * error kinds only. Never coordinates, place names, run notes or clothing.
 */
export const diagnosticLog = createDiagnosticLog({
    storageKey: 'run-log.diagnosticLog',
    now() {
        return Date.now();
    },
});
