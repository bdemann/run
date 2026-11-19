import {
    calculateRelativeDate,
    createFullDateInUserTimezone,
    DateUnit,
    DayOfWeekName,
    FullDatePart,
    getDayOfWeek,
    getEndDate,
    getNowInUserTimezone,
    getStartDate,
    toHtmlInputString,
    toLocaleString,
    toUtcIsoString,
} from 'date-vir';

/** A UTC ISO time as a `datetime-local` input value in the person's timezone. */
export function isoToInputValue(iso: string): string {
    return toHtmlInputString(createFullDateInUserTimezone(iso), FullDatePart.DateTime);
}

/** A `datetime-local` value (the person's timezone) as a UTC ISO time, or `undefined` if invalid. */
export function inputValueToIso(value: string): string | undefined {
    if (!value) {
        return undefined;
    }
    try {
        return toUtcIsoString(createFullDateInUserTimezone(value));
    } catch {
        return undefined;
    }
}

/** "Nov 17, 2026". */
export function formatRunDate(iso: string): string {
    return toLocaleString(createFullDateInUserTimezone(iso), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

/** "Dec 31". */
export function formatShortDate(iso: string): string {
    return toLocaleString(createFullDateInUserTimezone(iso), {
        month: 'short',
        day: 'numeric',
    });
}

/** A `date` input value ("2026-12-31") as the UTC ISO time of the end of that local day. */
export function dateInputToEndOfDayIso(value: string): string | undefined {
    if (!value) {
        return undefined;
    }
    try {
        return toUtcIsoString(getEndDate(createFullDateInUserTimezone(value), DateUnit.Day));
    } catch {
        return undefined;
    }
}

const daysSinceMonday: Readonly<Record<DayOfWeekName, number>> = {
    [DayOfWeekName.Monday]: 0,
    [DayOfWeekName.Tuesday]: 1,
    [DayOfWeekName.Wednesday]: 2,
    [DayOfWeekName.Thursday]: 3,
    [DayOfWeekName.Friday]: 4,
    [DayOfWeekName.Saturday]: 5,
    [DayOfWeekName.Sunday]: 6,
};

/** The local Monday-to-Monday week containing now, as `[startMs, endMs)`. */
export function currentWeekRangeMs(): {startMs: number; endMs: number} {
    const today = getStartDate(getNowInUserTimezone(), DateUnit.Day);
    const monday = calculateRelativeDate(today, {
        days: -daysSinceMonday[getDayOfWeek(today)],
    });
    const nextMonday = calculateRelativeDate(monday, {
        days: 7,
    });
    return {
        startMs: Date.parse(toUtcIsoString(monday)),
        endMs: Date.parse(toUtcIsoString(nextMonday)),
    };
}

/** "6:30 AM". */
export function formatClockTime(iso: string): string {
    return toLocaleString(createFullDateInUserTimezone(iso), {
        hour: 'numeric',
        minute: '2-digit',
    });
}
