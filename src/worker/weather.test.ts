import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {handleWeatherRequest} from './weather.js';

const nowMs = Date.parse('2026-11-17T16:30:00+00:00');
const stationsUrl = 'https://api.weather.gov/gridpoints/SLC/105,151/stations';

const openMeteoBody = {
    current: {
        temperature_2m: 50,
        apparent_temperature: 46,
        wind_speed_10m: 3,
    },
};
const pointBody = {
    properties: {
        observationStations: stationsUrl,
    },
};
const stationsBody = {
    features: [
        {
            properties: {
                stationIdentifier: 'KPVU',
            },
        },
        {
            properties: {
                stationIdentifier: 'KHCR',
            },
        },
    ],
};
const goodObservation = {
    properties: {
        timestamp: '2026-11-17T15:56:00+00:00',
        temperature: {
            value: 0,
        },
        windSpeed: {
            value: null,
        },
        windChill: {
            value: null,
        },
        heatIndex: {
            value: null,
        },
    },
};
const nullObservation = {
    properties: {
        timestamp: '2026-11-17T15:56:00+00:00',
        temperature: {
            value: null,
        },
    },
};

type Reply = object | 'throw' | number;

/** Replies per URL, consumed in order (the last one repeats). Records every request. */
function makeFetch(replies: Record<string, Reply[]>) {
    const calls: string[] = [];
    const seenHeaders: HeadersInit[] = [];
    function fetchFunction(url: string, init?: RequestInit): Promise<Response> {
        calls.push(url);
        seenHeaders.push(init?.headers ?? {});
        assert.isDefined(init?.signal);
        const key = Object.keys(replies).find((candidate) => url.startsWith(candidate));
        const queue = key ? (replies[key] as Reply[]) : [];
        const reply: Reply | undefined = queue.length > 1 ? queue.shift() : queue[0];
        if (reply === 'throw' || reply == undefined) {
            return Promise.reject(new Error('network'));
        } else if (typeof reply === 'number') {
            return Promise.resolve(
                new Response('nope', {
                    status: reply,
                }),
            );
        } else {
            return Promise.resolve(
                new Response(JSON.stringify(reply), {
                    status: 200,
                }),
            );
        }
    }
    return {
        fetchFunction,
        calls,
        seenHeaders,
    };
}

async function run(replies: Record<string, Reply[]>, query = 'latitude=40.23&longitude=-111.66') {
    const fake = makeFetch(replies);
    const response = await handleWeatherRequest({
        request: new Request(`https://run.example/api/weather?${query}`),
        fetchFunction: fake.fetchFunction,
        nowMs,
    });
    return {
        response,
        body: (await response.json()) as Record<string, unknown>,
        ...fake,
    };
}

describe(handleWeatherRequest.name, () => {
    it('answers from Open-Meteo first', async () => {
        const {response, body, calls, seenHeaders} = await run({
            'https://api.open-meteo.com': [openMeteoBody],
        });
        assert.strictEquals(response.status, 200);
        assert.strictEquals(response.headers.get('cache-control'), 'no-store');
        assert.deepEquals(body, {
            ok: true,
            weather: {
                temperatureF: 50,
                feelsLikeF: 46,
                windMph: 3,
            },
            source: 'open-meteo',
        });
        assert.strictEquals(calls.length, 1);
        assert.deepEquals(seenHeaders[0], {
            'User-Agent': 'run-log (github.com/bdemann/run)',
        });
    });

    it('falls back to the NWS, retrying a 503 once and trying the next station', async () => {
        const {response, body, calls} = await run({
            'https://api.open-meteo.com': ['throw'],
            'https://api.weather.gov/points': [
                503,
                pointBody,
            ],
            [stationsUrl]: [stationsBody],
            'https://api.weather.gov/stations/KPVU': [nullObservation],
            'https://api.weather.gov/stations/KHCR': [goodObservation],
        });
        assert.strictEquals(response.status, 200);
        assert.deepEquals(body, {
            ok: true,
            weather: {
                temperatureF: 32,
                feelsLikeF: 32,
                windMph: 0,
            },
            source: 'nws',
        });
        assert.strictEquals(calls.filter((url) => url.includes('/points/')).length, 2);
    });

    it('gives up with a 502 when every source fails', async () => {
        const {response, body} = await run({
            'https://api.open-meteo.com': [500],
            'https://api.weather.gov/points': [503],
        });
        assert.strictEquals(response.status, 502);
        assert.deepEquals(body, {
            ok: false,
            error: 'No weather source answered.',
        });
    });

    it('does not retry a 4xx, and fails on a bad point or empty station list', async () => {
        const notFound = await run({
            'https://api.open-meteo.com': [
                {
                    bad: true,
                },
            ],
            'https://api.weather.gov/points': [404],
        });
        assert.strictEquals(notFound.response.status, 502);
        assert.strictEquals(notFound.calls.length, 2);

        const noStations = await run({
            'https://api.open-meteo.com': [404],
            'https://api.weather.gov/points': [pointBody],
            [stationsUrl]: [
                {
                    features: [],
                },
            ],
        });
        assert.strictEquals(noStations.response.status, 502);
    });

    it('fails when every station has no usable observation', async () => {
        const {response} = await run({
            'https://api.open-meteo.com': ['throw'],
            'https://api.weather.gov/points': [pointBody],
            [stationsUrl]: [stationsBody],
            'https://api.weather.gov/stations': [nullObservation],
        });
        assert.strictEquals(response.status, 502);
    });

    it('rejects bad coordinates with a 400 and calls nothing', async () => {
        for (const query of [
            '',
            'latitude=40',
            'latitude=abc&longitude=1',
            'latitude=91&longitude=1',
            'latitude=1&longitude=181',
            'latitude=Infinity&longitude=1',
        ]) {
            const {response, body, calls} = await run({}, query);
            assert.strictEquals(response.status, 400, query);
            assert.strictEquals(body['ok'], false);
            assert.strictEquals(calls.length, 0);
        }
    });
});
