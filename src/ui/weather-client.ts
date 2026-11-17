import {type RunLocation} from '../data/shapes.js';
import {
    forecastUrl,
    geocodingUrl,
    locationFromCoordinates,
    parseForecast,
    parseGeocoding,
    parseProxyWeather,
    type Weather,
    weatherProxyUrl,
} from '../data/weather.js';
import {diagnosticLog} from './diagnostics.js';

/** Weather older than this is fetched again before a run starts. */
export const weatherMaxAgeMs = 15 * 60_000;

type CachedWeather = {weather: Weather; fetchedAtMs: number; key: string};

let cached: CachedWeather | undefined;

function locationKey(location: Readonly<RunLocation>): string {
    return `${location.latitude},${location.longitude}`;
}

/** The last fetched weather for this location, if any, however old. */
export function getCachedWeather(location: Readonly<RunLocation>): CachedWeather | undefined {
    return cached?.key === locationKey(location) ? cached : undefined;
}

/** A short, private reason for a failed fetch: never the URL, which holds coordinates. */
function failureReason(error: unknown): string {
    return error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'network';
}

/** Open-Meteo straight from the browser. Gives up after 6 s: it is sometimes unreachable. */
async function fetchDirect(location: Readonly<RunLocation>): Promise<Weather | undefined> {
    const startMs = Date.now();
    try {
        const response = await fetch(forecastUrl(location), {
            signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) {
            diagnosticLog.log('error', {
                step: 'direct',
                reason: `status-${response.status}`,
            });
            return undefined;
        }
        const weather = parseForecast(await response.json());
        if (weather) {
            diagnosticLog.log('weather-ok', {
                source: 'direct',
                ms: Date.now() - startMs,
            });
        } else {
            diagnosticLog.log('error', {
                step: 'direct',
                reason: 'shape',
            });
        }
        return weather;
    } catch (error) {
        diagnosticLog.log('error', {
            step: 'direct',
            reason: failureReason(error),
        });
        return undefined;
    }
}

/** Our Worker, which tries Open-Meteo then the National Weather Service. May take a while. */
async function fetchViaWorker(location: Readonly<RunLocation>): Promise<Weather | undefined> {
    const startMs = Date.now();
    try {
        const response = await fetch(weatherProxyUrl(location), {
            signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) {
            diagnosticLog.log('error', {
                step: 'proxy',
                reason: `status-${response.status}`,
            });
            return undefined;
        }
        const body: unknown = await response.json();
        const weather =
            body && typeof body === 'object' && 'weather' in body
                ? parseProxyWeather(body.weather)
                : undefined;
        if (weather) {
            const source =
                body && typeof body === 'object' && 'source' in body ? String(body.source) : '';
            diagnosticLog.log('weather-ok', {
                source: /^[a-z-]{1,20}$/.test(source) ? source : 'proxy',
                ms: Date.now() - startMs,
            });
        } else {
            diagnosticLog.log('error', {
                step: 'proxy',
                reason: 'shape',
            });
        }
        return weather;
    } catch (error) {
        diagnosticLog.log('error', {
            step: 'proxy',
            reason: failureReason(error),
        });
        return undefined;
    }
}

/** Current conditions: Open-Meteo directly, else via the Worker. Throws a readable error. */
export async function fetchWeather(location: Readonly<RunLocation>): Promise<Weather> {
    const weather = (await fetchDirect(location)) ?? (await fetchViaWorker(location));
    if (!weather) {
        throw new Error("Couldn't get the weather right now. Tap Retry, or type the temperature.");
    }
    cached = {
        weather,
        fetchedAtMs: Date.now(),
        key: locationKey(location),
    };
    return weather;
}

/** Cached weather when fresh enough, otherwise a new fetch. */
export async function freshWeather(location: Readonly<RunLocation>): Promise<Weather> {
    const existing = getCachedWeather(location);
    if (existing && Date.now() - existing.fetchedAtMs < weatherMaxAgeMs) {
        return existing.weather;
    }
    return await fetchWeather(location);
}

export async function searchPlaces(query: string): Promise<RunLocation[]> {
    const response = await fetch(geocodingUrl(query));
    if (!response.ok) {
        throw new Error(`The place search answered ${response.status}.`);
    }
    return parseGeocoding(await response.json());
}

/** The device's location (asks permission the first time). */
export function locateDevice(): Promise<RunLocation> {
    return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) {
            reject(new Error('This browser cannot share its location.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve(locationFromCoordinates(position.coords));
            },
            (error) => {
                diagnosticLog.log('error', {
                    step: 'geolocation',
                    code: error.code,
                });
                reject(new Error(error.message || 'Location was not shared.'));
            },
            {
                timeout: 15_000,
                maximumAge: 10 * 60_000,
            },
        );
    });
}
