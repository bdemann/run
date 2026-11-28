import {type RunLocation} from '../data/shapes.js';
import {
    forecastUrl,
    geocodingUrl,
    locationFromCoordinates,
    parseForecast,
    parseGeocoding,
    parseProxyReading,
    weatherProxyUrl,
    type WeatherReading,
} from '../data/weather.js';
import {diagnosticLog} from './diagnostics.js';

/** Weather older than this is fetched again before a run starts. */
export const weatherMaxAgeMs = 15 * 60_000;

type CachedWeather = {reading: WeatherReading; fetchedAtMs: number; key: string};

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
async function fetchDirect(location: Readonly<RunLocation>): Promise<WeatherReading | undefined> {
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
        return weather
            ? {
                  weather,
                  source: 'open-meteo',
                  observedAt: null,
                  station: null,
              }
            : undefined;
    } catch (error) {
        diagnosticLog.log('error', {
            step: 'direct',
            reason: failureReason(error),
        });
        return undefined;
    }
}

/** Our Worker, which prefers an NWS station measurement over Open-Meteo. May take a while. */
async function fetchViaWorker(
    location: Readonly<RunLocation>,
): Promise<WeatherReading | undefined> {
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
        const reading = parseProxyReading(await response.json());
        if (reading) {
            diagnosticLog.log('weather-ok', {
                source: reading.source,
                ms: Date.now() - startMs,
                precipitation: reading.weather.precipitation?.kind ?? 'unknown',
            });
        } else {
            diagnosticLog.log('error', {
                step: 'proxy',
                reason: 'shape',
            });
        }
        return reading;
    } catch (error) {
        diagnosticLog.log('error', {
            step: 'proxy',
            reason: failureReason(error),
        });
        return undefined;
    }
}

/** Current conditions: our Worker (NWS first), else Open-Meteo directly. Throws a readable error. */
export async function fetchWeather(location: Readonly<RunLocation>): Promise<WeatherReading> {
    const reading = (await fetchViaWorker(location)) ?? (await fetchDirect(location));
    if (!reading) {
        throw new Error("Couldn't get the weather right now. Tap Retry, or type the temperature.");
    }
    cached = {
        reading,
        fetchedAtMs: Date.now(),
        key: locationKey(location),
    };
    return reading;
}

/** Cached weather when fresh enough, otherwise a new fetch. */
export async function freshWeather(location: Readonly<RunLocation>): Promise<WeatherReading> {
    const existing = getCachedWeather(location);
    if (existing && Date.now() - existing.fetchedAtMs < weatherMaxAgeMs) {
        return existing.reading;
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
