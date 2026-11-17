/** "4:05" or "1:02:09" for a stopwatch. Negative input shows as zero. */
export function formatElapsed(milliseconds: number): string {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return hours
        ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
        : `${minutes}:${seconds}`;
}

/** Whole minutes from a UTC ISO start time to `nowMs`, never negative. */
export function minutesSince({
    startedAt,
    nowMs,
}: Readonly<{startedAt: string; nowMs: number}>): number {
    return Math.max(0, Math.round((nowMs - Date.parse(startedAt)) / 60_000));
}
