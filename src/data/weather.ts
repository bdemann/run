import {defineShape} from 'object-shape-tester';
import {checkShape} from './shape-check.js';
import {type RunLocation} from './shapes.js';

/** Current conditions, as recorded on a run. */
export type Weather = {
    temperatureF: number;
    feelsLikeF: number;
    windMph: number;
};

/**
 * Open-Meteo's forecast API: free, no key, CORS enabled. Only the "current" block is used.
 * https://open-meteo.com/en/docs
 */
export const forecastOrigin = 'https://api.open-meteo.com';
export const geocodingOrigin = 'https://geocoding-api.open-meteo.com';

export function forecastUrl(
    location: Readonly<Pick<RunLocation, 'latitude' | 'longitude'>>,
): string {
    const params = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        current: 'temperature_2m,apparent_temperature,wind_speed_10m',
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
    });
    return `${forecastOrigin}/v1/forecast?${params.toString()}`;
}

const forecastShape = defineShape({
    current: {
        temperature_2m: 0,
        apparent_temperature: 0,
        wind_speed_10m: 0,
    },
});

/** Reads a forecast response, or `undefined` when it is not the expected shape. */
export function parseForecast(json: unknown): Weather | undefined {
    if (
        !checkShape(json, forecastShape, {
            allowExtraKeys: true,
        })
    ) {
        return undefined;
    }
    return {
        temperatureF: json.current.temperature_2m,
        feelsLikeF: json.current.apparent_temperature,
        windMph: json.current.wind_speed_10m,
    };
}

export function geocodingUrl(query: string): string {
    const params = new URLSearchParams({
        name: query.trim(),
        count: '6',
        language: 'en',
        format: 'json',
    });
    return `${geocodingOrigin}/v1/search?${params.toString()}`;
}

const placeShape = defineShape({
    name: '',
    latitude: 0,
    longitude: 0,
});

/**
 * Reads a geocoding response into locations named like "Provo, Utah, US". Bad entries are skipped;
 * a response with no `results` (nothing found) gives an empty list.
 */
export function parseGeocoding(json: unknown): RunLocation[] {
    const results =
        json && typeof json === 'object' && 'results' in json && Array.isArray(json.results)
            ? (json.results as unknown[])
            : [];
    return results.flatMap((result) => {
        if (
            !checkShape(result, placeShape, {
                allowExtraKeys: true,
            })
        ) {
            return [];
        }
        const extra = result as {admin1?: unknown; country_code?: unknown};
        const parts = [
            result.name,
            extra.admin1,
            extra.country_code,
        ].filter((part): part is string => typeof part === 'string' && part !== '');
        return [
            {
                latitude: result.latitude,
                longitude: result.longitude,
                name: parts.join(', '),
            },
        ];
    });
}

/** A location from the device's GPS, rounded to about a kilometer (plenty for weather). */
export function locationFromCoordinates({
    latitude,
    longitude,
}: Readonly<{latitude: number; longitude: number}>): RunLocation {
    const roundedLatitude = Math.round(latitude * 100) / 100;
    const roundedLongitude = Math.round(longitude * 100) / 100;
    return {
        latitude: roundedLatitude,
        longitude: roundedLongitude,
        name: `your location (${roundedLatitude}, ${roundedLongitude})`,
    };
}
