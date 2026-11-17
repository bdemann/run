import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {parseUrl} from 'url-vir';
import {
    celsiusToF,
    forecastUrl,
    geocodingUrl,
    kmhToMph,
    locationFromCoordinates,
    nwsLatestObservationUrl,
    nwsPointUrl,
    parseForecast,
    parseGeocoding,
    parseNwsObservation,
    parseNwsPoint,
    parseNwsStations,
    parseProxyWeather,
    weatherProxyUrl,
} from './weather.js';

describe(forecastUrl.name, () => {
    it('asks for current conditions in °F and mph', () => {
        const url = parseUrl(
            forecastUrl({
                latitude: 40.23,
                longitude: -111.66,
            }),
        );
        assert.strictEquals(url.origin, 'https://api.open-meteo.com');
        assert.deepEquals(url.searchParams['latitude'], ['40.23']);
        assert.deepEquals(url.searchParams['temperature_unit'], ['fahrenheit']);
        assert.deepEquals(url.searchParams['wind_speed_unit'], ['mph']);
    });
});

describe(parseForecast.name, () => {
    it('reads the current block', () => {
        assert.deepEquals(
            parseForecast({
                latitude: 40,
                current: {
                    time: '2026-11-17T06:30',
                    temperature_2m: 51.2,
                    apparent_temperature: 47.9,
                    wind_speed_10m: 4.1,
                },
            }),
            {
                temperatureF: 51.2,
                feelsLikeF: 47.9,
                windMph: 4.1,
            },
        );
    });

    it('rejects anything else', () => {
        assert.isUndefined(
            parseForecast({
                error: true,
            }),
        );
        assert.isUndefined(parseForecast(undefined));
    });
});

describe(geocodingUrl.name, () => {
    it('trims the query', () => {
        assert.deepEquals(parseUrl(geocodingUrl('  Provo ')).searchParams['name'], ['Provo']);
    });
});

describe(parseGeocoding.name, () => {
    it('names places and skips bad entries', () => {
        assert.deepEquals(
            parseGeocoding({
                results: [
                    {
                        name: 'Provo',
                        latitude: 40.23,
                        longitude: -111.66,
                        admin1: 'Utah',
                        country_code: 'US',
                    },
                    {
                        name: 'Nowhere',
                        admin1: '',
                        latitude: 1,
                        longitude: 2,
                    },
                    {
                        name: 'Broken',
                    },
                ],
            }),
            [
                {
                    latitude: 40.23,
                    longitude: -111.66,
                    name: 'Provo, Utah, US',
                },
                {
                    latitude: 1,
                    longitude: 2,
                    name: 'Nowhere',
                },
            ],
        );
    });

    it('treats a missing result list as nothing found', () => {
        assert.deepEquals(
            parseGeocoding({
                generationtime_ms: 1,
            }),
            [],
        );
        assert.deepEquals(parseGeocoding(null), []);
    });
});

describe(locationFromCoordinates.name, () => {
    it('rounds to two decimals', () => {
        assert.deepEquals(
            locationFromCoordinates({
                latitude: 40.23456,
                longitude: -111.65789,
            }),
            {
                latitude: 40.23,
                longitude: -111.66,
                name: 'your location (40.23, -111.66)',
            },
        );
    });
});

const nowMs = Date.parse('2026-11-17T16:30:00+00:00');

function observation(overrides: Record<string, unknown> = {}) {
    return {
        properties: {
            timestamp: '2026-11-17T15:56:00+00:00',
            temperature: {
                unitCode: 'wmoUnit:degC',
                value: 1.1,
            },
            windSpeed: {
                unitCode: 'wmoUnit:km_h-1',
                value: 11.16,
            },
            windChill: {
                unitCode: 'wmoUnit:degC',
                value: -2.6,
            },
            heatIndex: {
                unitCode: 'wmoUnit:degC',
                value: null,
            },
            ...overrides,
        },
    };
}

describe('unit conversions', () => {
    it('converts', () => {
        assert.strictEquals(celsiusToF(100), 212);
        assert.strictEquals(celsiusToF(-40), -40);
        assert.strictEquals(kmhToMph(1.609344), 1);
    });
});

describe(weatherProxyUrl.name, () => {
    it('rounds coordinates to two decimals', () => {
        assert.strictEquals(
            weatherProxyUrl({
                latitude: 40.23384,
                longitude: -111.65851,
            }),
            '/api/weather?latitude=40.23&longitude=-111.66',
        );
    });
});

describe(parseProxyWeather.name, () => {
    it('reads the three numbers or nothing', () => {
        const weather = {
            temperatureF: 1,
            feelsLikeF: 2,
            windMph: 3,
        };
        assert.deepEquals(parseProxyWeather(weather), weather);
        assert.isUndefined(
            parseProxyWeather({
                temperatureF: 1,
            }),
        );
    });
});

describe('NWS urls', () => {
    it('builds them', () => {
        assert.strictEquals(
            nwsPointUrl({
                latitude: 40.23,
                longitude: -111.66,
            }),
            'https://api.weather.gov/points/40.23,-111.66',
        );
        assert.strictEquals(
            nwsLatestObservationUrl('KPVU'),
            'https://api.weather.gov/stations/KPVU/observations/latest',
        );
    });
});

describe(parseNwsPoint.name, () => {
    it('reads the stations url', () => {
        assert.strictEquals(
            parseNwsPoint({
                properties: {
                    observationStations: 'https://api.weather.gov/gridpoints/SLC/105,151/stations',
                    gridId: 'SLC',
                },
            }),
            'https://api.weather.gov/gridpoints/SLC/105,151/stations',
        );
    });

    it('rejects anything else', () => {
        assert.isUndefined(
            parseNwsPoint({
                properties: {},
            }),
        );
        assert.isUndefined(parseNwsPoint(undefined));
    });
});

describe(parseNwsStations.name, () => {
    it('keeps the first three, skipping bad entries', () => {
        assert.deepEquals(
            parseNwsStations({
                features: [
                    {
                        properties: {
                            stationIdentifier: 'KPVU',
                        },
                    },
                    {
                        properties: {},
                    },
                    {
                        properties: {
                            stationIdentifier: 'KHCR',
                        },
                    },
                    {
                        properties: {
                            stationIdentifier: 'A',
                        },
                    },
                    {
                        properties: {
                            stationIdentifier: 'B',
                        },
                    },
                ],
            }),
            [
                'KPVU',
                'KHCR',
                'A',
            ],
        );
    });

    it('gives nothing for the wrong shape', () => {
        assert.deepEquals(
            parseNwsStations({
                features: 'no',
            }),
            [],
        );
        assert.deepEquals(parseNwsStations(undefined), []);
    });
});

describe(parseNwsObservation.name, () => {
    it('reads a good observation, using wind chill', () => {
        const weather = parseNwsObservation({
            json: observation(),
            nowMs,
        });
        assert.isDefined(weather);
        assert.isTrue(Math.abs(weather.temperatureF - 34) < 0.1);
        assert.isTrue(Math.abs(weather.feelsLikeF - 27.3) < 0.1);
        assert.isTrue(Math.abs(weather.windMph - 6.93) < 0.01);
    });

    it('falls back to heat index, then to the temperature', () => {
        const heat = parseNwsObservation({
            json: observation({
                windChill: {
                    value: null,
                },
                heatIndex: {
                    value: 40,
                },
            }),
            nowMs,
        });
        assert.strictEquals(heat?.feelsLikeF, 104);
        const plain = parseNwsObservation({
            json: observation({
                windChill: {
                    value: null,
                },
                windSpeed: {
                    value: null,
                },
            }),
            nowMs,
        });
        assert.strictEquals(plain?.feelsLikeF, plain?.temperatureF);
        assert.strictEquals(plain?.windMph, 0);
    });

    it('copes with a missing wind chill entirely', () => {
        const weather = parseNwsObservation({
            json: {
                properties: {
                    timestamp: '2026-11-17T16:00:00+00:00',
                    temperature: {
                        value: 0,
                    },
                },
            },
            nowMs,
        });
        assert.strictEquals(weather?.feelsLikeF, 32);
    });

    it('rejects null temperature, stale or bad timestamps and wrong shapes', () => {
        assert.isUndefined(
            parseNwsObservation({
                json: observation({
                    temperature: {
                        value: null,
                    },
                }),
                nowMs,
            }),
        );
        assert.isUndefined(
            parseNwsObservation({
                json: observation({
                    timestamp: '2026-11-17T14:00:00+00:00',
                }),
                nowMs,
            }),
        );
        assert.isUndefined(
            parseNwsObservation({
                json: observation({
                    timestamp: 'nope',
                }),
                nowMs,
            }),
        );
        assert.isUndefined(
            parseNwsObservation({
                json: {},
                nowMs,
            }),
        );
    });
});
