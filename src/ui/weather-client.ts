import {type RunLocation} from '../data/shapes.js';
import {
    forecastUrl,
    geocodingUrl,
    locationFromCoordinates,
    parseForecast,
    parseGeocoding,
    type Weather,
} from '../data/weather.js';

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

/** Current conditions from Open-Meteo. Throws a readable error on failure. */
export async function fetchWeather(location: Readonly<RunLocation>): Promise<Weather> {
    let response: Response;
    try {
        response = await fetch(forecastUrl(location));
    } catch {
        throw new Error('No connection to the weather service.');
    }
    const weather = response.ok ? parseForecast(await response.json()) : undefined;
    if (!weather) {
        throw new Error(`The weather service answered ${response.status}.`);
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
                reject(new Error(error.message || 'Location was not shared.'));
            },
            {
                timeout: 15_000,
                maximumAge: 10 * 60_000,
            },
        );
    });
}
