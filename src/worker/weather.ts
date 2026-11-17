import {
    forecastUrl,
    nwsLatestObservationUrl,
    nwsPointUrl,
    parseForecast,
    parseNwsObservation,
    parseNwsPoint,
    parseNwsStations,
    type Weather,
} from '../data/weather.js';

/** NWS rejects requests without a descriptive `User-Agent`. */
const userAgent = 'run-log (github.com/bdemann/run)';
const requestTimeoutMs = 6000;

type FetchFunction = (url: string, init?: RequestInit) => Promise<Response>;

type Coordinates = {latitude: number; longitude: number};

function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
        },
    });
}

function readCoordinates(url: URL): Coordinates | undefined {
    const latitudeText = url.searchParams.get('latitude');
    const longitudeText = url.searchParams.get('longitude');
    if (!latitudeText || !longitudeText) {
        return undefined;
    }
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
    ) {
        return undefined;
    }
    return {
        latitude,
        longitude,
    };
}

/** Fetches JSON, retrying once on a 5xx when asked. Gives `undefined` on any failure. */
async function fetchJson({
    fetchFunction,
    url,
    retryOnServerError,
}: Readonly<{
    fetchFunction: FetchFunction;
    url: string;
    retryOnServerError: boolean;
}>): Promise<unknown> {
    for (let attempt = 0; attempt < (retryOnServerError ? 2 : 1); attempt++) {
        try {
            const response = await fetchFunction(url, {
                /**
                 * No `Accept` header: on 2026-11-17 api.weather.gov answered 503 to every request
                 * with `Accept: application/json` or `application/geo+json` and 200 without one.
                 */
                headers: {
                    'User-Agent': userAgent,
                },
                signal: AbortSignal.timeout(requestTimeoutMs),
            });
            if (response.ok) {
                return await response.json();
            } else if (response.status < 500) {
                return undefined;
            }
        } catch {
            return undefined;
        }
    }
    return undefined;
}

async function nwsWeather({
    coordinates,
    fetchFunction,
    nowMs,
}: Readonly<{
    coordinates: Coordinates;
    fetchFunction: FetchFunction;
    nowMs: number;
}>): Promise<Weather | undefined> {
    const stationsUrl = parseNwsPoint(
        await fetchJson({
            fetchFunction,
            url: nwsPointUrl(coordinates),
            retryOnServerError: true,
        }),
    );
    if (!stationsUrl) {
        return undefined;
    }
    const stations = parseNwsStations(
        await fetchJson({
            fetchFunction,
            url: stationsUrl,
            retryOnServerError: true,
        }),
    );
    for (const station of stations) {
        const weather = parseNwsObservation({
            json: await fetchJson({
                fetchFunction,
                url: nwsLatestObservationUrl(station),
                retryOnServerError: true,
            }),
            nowMs,
        });
        if (weather) {
            return weather;
        }
    }
    return undefined;
}

/**
 * `GET /api/weather?latitude=&longitude=`: Open-Meteo first, then the National Weather Service. The
 * coordinates are only forwarded to those two services. They are never logged or stored.
 */
export async function handleWeatherRequest({
    request,
    fetchFunction,
    nowMs,
}: Readonly<{
    request: Request;
    fetchFunction: FetchFunction;
    nowMs: number;
}>): Promise<Response> {
    const coordinates = readCoordinates(new URL(request.url));
    if (!coordinates) {
        return jsonResponse(
            {
                ok: false,
                error: 'latitude and longitude are required numbers in range.',
            },
            400,
        );
    }
    const openMeteo = parseForecast(
        await fetchJson({
            fetchFunction,
            url: forecastUrl(coordinates),
            retryOnServerError: false,
        }),
    );
    if (openMeteo) {
        return jsonResponse(
            {
                ok: true,
                weather: openMeteo,
                source: 'open-meteo',
            },
            200,
        );
    }
    const nws = await nwsWeather({
        coordinates,
        fetchFunction,
        nowMs,
    });
    if (nws) {
        return jsonResponse(
            {
                ok: true,
                weather: nws,
                source: 'nws',
            },
            200,
        );
    }
    return jsonResponse(
        {
            ok: false,
            error: 'No weather source answered.',
        },
        502,
    );
}
