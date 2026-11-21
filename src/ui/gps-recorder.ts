import {acceptPoint, trackDistanceMiles} from '../data/gps.js';
import {type RecordedPoint} from '../data/shapes.js';
import {diagnosticLog} from './diagnostics.js';
import {getRunStore} from './storage.js';

/** Points are written to the store at least this often... */
const flushEveryMs = 5000;
/** ...or after this many accepted points. */
const flushEveryPoints = 10;

type WakeLockSentinelLike = {release: () => Promise<void>};

/**
 * Records a route with screen-on GPS while a run is in progress. There is one recorder for the
 * whole app, so it keeps going while the person looks at other tabs. PRIVACY: points go only into
 * the run store (the device); the diagnostic log gets counts and error codes, never coordinates.
 */
class GpsRecorder {
    protected points: RecordedPoint[] = [];
    protected runtime: {
        watchId: number | undefined;
        wakeLock: WakeLockSentinelLike | undefined;
        lastFlushMs: number;
        unflushed: number;
    } = {
        watchId: undefined,
        wakeLock: undefined,
        lastFlushMs: 0,
        unflushed: 0,
    };
    /** A short muted explanation when GPS or the wake lock is not working. */
    public note = '';

    public get running(): boolean {
        return this.runtime.watchId != undefined;
    }

    public getPoints(): ReadonlyArray<Readonly<RecordedPoint>> {
        return this.points;
    }

    public getDistanceMiles(): number {
        return trackDistanceMiles(this.points);
    }

    /** Starts watching, keeping the earlier points (after a reload). Does nothing if running. */
    public start(earlierPoints: ReadonlyArray<Readonly<RecordedPoint>>): void {
        if (this.running) {
            return;
        }
        this.points = earlierPoints.map((point) => {
            return {
                ...point,
            };
        });
        this.note = '';
        diagnosticLog.log('route-record-start');
        void this.acquireWakeLock();
        document.addEventListener('visibilitychange', this.onVisibility);
        if (!('geolocation' in navigator)) {
            this.note = 'GPS is not available here, so the route is not being recorded.';
            diagnosticLog.log('error', {
                step: 'gps',
                reason: 'unsupported',
            });
            /** Marks the recorder as started so `start` is not retried every change. */
            this.runtime.watchId = -1;
            return;
        }
        this.runtime.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.onPosition(position);
            },
            (error) => {
                this.note = 'GPS was not available, so the route is not being recorded.';
                diagnosticLog.log('error', {
                    step: 'gps',
                    reason: error.code,
                });
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
            },
        );
    }

    /** Writes any points not yet in the store. */
    public flush(): void {
        if (!this.runtime.unflushed) {
            return;
        }
        this.runtime.unflushed = 0;
        this.runtime.lastFlushMs = Date.now();
        getRunStore().updateActiveRun({
            recording: {
                points: this.points,
            },
        });
    }

    /** Stops watching and releases the wake lock. Does not touch the store. */
    public stop(): void {
        const {watchId, wakeLock} = this.runtime;
        if (watchId != undefined && watchId >= 0) {
            navigator.geolocation.clearWatch(watchId);
        }
        this.runtime.watchId = undefined;
        this.runtime.wakeLock = undefined;
        this.runtime.unflushed = 0;
        document.removeEventListener('visibilitychange', this.onVisibility);
        wakeLock?.release().catch(() => {});
        this.points = [];
        this.note = '';
    }

    protected onPosition(position: GeolocationPosition): void {
        const point: RecordedPoint = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyM: position.coords.accuracy,
            atMs: Date.now(),
        };
        if (
            !acceptPoint({
                previous: this.points.at(-1),
                point,
            })
        ) {
            return;
        }
        this.points.push(point);
        this.runtime.unflushed++;
        if (
            this.runtime.unflushed >= flushEveryPoints ||
            Date.now() - this.runtime.lastFlushMs >= flushEveryMs
        ) {
            this.flush();
        }
    }

    protected readonly onVisibility = (): void => {
        if (document.visibilityState === 'visible') {
            void this.acquireWakeLock();
        }
    };

    protected async acquireWakeLock(): Promise<void> {
        try {
            if (!('wakeLock' in navigator)) {
                throw new Error('unsupported');
            }
            const sentinel = await navigator.wakeLock.request('screen');
            if (!this.running) {
                await sentinel.release();
                return;
            }
            this.runtime.wakeLock?.release().catch(() => {});
            this.runtime.wakeLock = sentinel;
        } catch (error) {
            this.note = 'Could not keep the screen on. Keep it on yourself so GPS keeps working.';
            diagnosticLog.log('error', {
                step: 'gps',
                reason:
                    error instanceof Error && error.message === 'unsupported'
                        ? 'no-wake-lock'
                        : 'wake-lock',
            });
        }
    }
}

export const gpsRecorder = new GpsRecorder();

/** Starts or stops the recorder to match the run in progress. Call on every store change. */
export function syncGpsRecorder(): void {
    const recording = getRunStore().getData().activeRun?.recording;
    if (recording && !gpsRecorder.running) {
        gpsRecorder.start(recording.points);
    } else if (!recording && gpsRecorder.running) {
        gpsRecorder.stop();
    }
}
