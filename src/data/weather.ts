import {defineShape, nullableShape} from 'object-shape-tester';
import {apiPaths} from './app-info.js';
import {precipitationFromNws, precipitationFromWmo, type Precipitation} from './precipitation.js';
import {checkShape} from './shape-check.js';
import {precipitationShape, type RunLocation} from './shapes.js';

/** Current conditions, as recorded on a run. */
export type Weather = {
    temperatureF: number;
    feelsLikeF: number;
    windMph: number;
    /** `null` when the source did not say. */
    precipitation: Precipitation | null;
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
        current: 'temperature_2m,apparent_temperature,wind_speed_10m,weather_code',
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
    });
    return `${forecastOrigin}/v1/forecast?${params.toString()}`;
}

/** The Worker's weather endpoint. Coordinates are rounded to 2 decimals (about 1 km) on purpose. */
export function weatherProxyUrl(
    location: Readonly<Pick<RunLocation, 'latitude' | 'longitude'>>,
): string {
    const params = new URLSearchParams({
        latitude: String(Math.round(location.latitude * 100) / 100),
        longitude: String(Math.round(location.longitude * 100) / 100),
    });
    return `${apiPaths.weather}?${params.toString()}`;
}

/** Where a reading came from: a measuring station (`nws`) or a weather model (`open-meteo`). */
export type WeatherSource = 'nws' | 'open-meteo';

/** `Weather` plus where and when it was measured. */
export type WeatherReading = {
    weather: Weather;
    source: WeatherSource;
    /** UTC ISO time of the observation; `null` for a model estimate. */
    observedAt: string | null;
    /** NWS station identifier like `KPVU`; `null` for a model estimate. */
    station: string | null;
};

const proxyReadingShape = defineShape({
    weather: {
        temperatureF: 0,
        feelsLikeF: 0,
        windMph: 0,
    },
    source: '',
    observedAt: nullableShape(''),
    station: nullableShape(''),
});

/** A stored-shape precipitation, or `null` for anything else (an older Worker omits it). */
function readPrecipitation(value: unknown): Precipitation | null {
    return checkShape(value, precipitationShape) ? value : null;
}

/** Reads the Worker's whole `/api/weather` answer, or `undefined` when it is not that shape. */
export function parseProxyReading(json: unknown): WeatherReading | undefined {
    if (
        !checkShape(json, proxyReadingShape, {
            allowExtraKeys: true,
        })
    ) {
        return undefined;
    } else if (json.source !== 'nws' && json.source !== 'open-meteo') {
        return undefined;
    } else {
        return {
            weather: {
                temperatureF: json.weather.temperatureF,
                feelsLikeF: json.weather.feelsLikeF,
                windMph: json.weather.windMph,
                precipitation: readPrecipitation(
                    (json.weather as {precipitation?: unknown}).precipitation,
                ),
            },
            source: json.source,
            observedAt: json.observedAt ?? null,
            station: json.station ?? null,
        };
    }
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
    const weatherCode = (json.current as {weather_code?: unknown}).weather_code;
    return {
        temperatureF: json.current.temperature_2m,
        feelsLikeF: json.current.apparent_temperature,
        windMph: json.current.wind_speed_10m,
        precipitation: typeof weatherCode === 'number' ? precipitationFromWmo(weatherCode) : null,
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

export function celsiusToF(celsius: number): number {
    return (celsius * 9) / 5 + 32;
}

export function kmhToMph(kmh: number): number {
    return kmh / 1.609344;
}

/** The US National Weather Service API: free, no key, needs a descriptive `User-Agent`. */
export const nwsOrigin = 'https://api.weather.gov';

/** An NWS observation older than this is not "current" and is ignored. */
export const nwsMaxObservationAgeMs = 90 * 60_000;

/** The NWS "point" lookup, which says where the nearby observation stations are listed. */
export function nwsPointUrl(
    location: Readonly<Pick<RunLocation, 'latitude' | 'longitude'>>,
): string {
    return `${nwsOrigin}/points/${location.latitude},${location.longitude}`;
}

export function nwsLatestObservationUrl(stationId: string): string {
    return `${nwsOrigin}/stations/${encodeURIComponent(stationId)}/observations/latest`;
}

const nwsPointShape = defineShape({
    properties: {
        observationStations: '',
    },
});

/** The station list URL from an NWS point response, or `undefined` for anything else. */
export function parseNwsPoint(json: unknown): string | undefined {
    if (
        !checkShape(json, nwsPointShape, {
            allowExtraKeys: true,
        })
    ) {
        return undefined;
    }
    return json.properties.observationStations;
}

const nwsStationShape = defineShape({
    properties: {
        stationIdentifier: '',
    },
});

/** Up to three station identifiers from an NWS station list, nearest first. */
export function parseNwsStations(json: unknown): string[] {
    const features =
        json && typeof json === 'object' && 'features' in json && Array.isArray(json.features)
            ? (json.features as unknown[])
            : [];
    return features
        .flatMap((feature) => {
            return checkShape(feature, nwsStationShape, {
                allowExtraKeys: true,
            })
                ? [feature.properties.stationIdentifier]
                : [];
        })
        .slice(0, 3);
}

const nwsObservationShape = defineShape({
    properties: {
        timestamp: '',
    },
});

/** NWS measurements look like `{unitCode, value}` where `value` may be `null`. */
function readNwsValue(properties: object, key: string): number | undefined {
    const measurement = (properties as Record<string, unknown>)[key];
    if (measurement && typeof measurement === 'object' && 'value' in measurement) {
        const value = measurement.value;
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
    }
    return undefined;
}

/**
 * Reads an NWS latest-observation response. Gives `undefined` when there is no temperature or the
 * observation is more than 90 minutes older than `nowMs`. Also gives the observation time.
 */
export function parseNwsObservation({
    json,
    nowMs,
}: Readonly<{json: unknown; nowMs: number}>): {weather: Weather; observedAt: string} | undefined {
    if (
        !checkShape(json, nwsObservationShape, {
            allowExtraKeys: true,
        })
    ) {
        return undefined;
    }
    const {properties} = json;
    const observedMs = Date.parse(properties.timestamp);
    if (Number.isNaN(observedMs) || nowMs - observedMs > nwsMaxObservationAgeMs) {
        return undefined;
    }
    const temperatureC = readNwsValue(properties, 'temperature');
    if (temperatureC == undefined) {
        return undefined;
    }
    const feelsLikeC =
        readNwsValue(properties, 'windChill') ??
        readNwsValue(properties, 'heatIndex') ??
        temperatureC;
    return {
        weather: {
            temperatureF: celsiusToF(temperatureC),
            feelsLikeF: celsiusToF(feelsLikeC),
            windMph: kmhToMph(readNwsValue(properties, 'windSpeed') ?? 0),
            precipitation: precipitationFromNws(
                (properties as {presentWeather?: unknown}).presentWeather,
            ),
        },
        observedAt: properties.timestamp,
    };
}
