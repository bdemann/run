import {
    createFullDateInUserTimezone,
    FullDatePart,
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

/** "6:30 AM". */
export function formatClockTime(iso: string): string {
    return toLocaleString(createFullDateInUserTimezone(iso), {
        hour: 'numeric',
        minute: '2-digit',
    });
}
