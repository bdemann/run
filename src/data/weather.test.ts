import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {parseUrl} from 'url-vir';
import {
    forecastUrl,
    geocodingUrl,
    locationFromCoordinates,
    parseForecast,
    parseGeocoding,
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
