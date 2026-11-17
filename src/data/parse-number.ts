/** Parses typed text into a finite number, or `null` when it is empty or not a number. */
export function parseNumber(text: string): number | null {
    const trimmed = text.trim();
    if (!trimmed) {
        return null;
    }
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : null;
}
