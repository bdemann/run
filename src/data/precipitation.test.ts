import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {
    describePrecipitation,
    describeWetNote,
    precipitationFromNws,
    precipitationFromWmo,
    type Precipitation,
} from './precipitation.js';

function wmo(code: number): string | null {
    const result = precipitationFromWmo(code);
    return result ? `${result.kind}/${result.intensity}` : null;
}

describe(precipitationFromWmo.name, () => {
    it('maps each group of codes', () => {
        const expected: Record<number, string> = {
            0: 'none/light',
            3: 'none/light',
            45: 'none/light',
            48: 'none/light',
            51: 'drizzle/light',
            53: 'drizzle/moderate',
            55: 'drizzle/heavy',
            56: 'sleet/light',
            57: 'sleet/heavy',
            61: 'rain/light',
            63: 'rain/moderate',
            65: 'rain/heavy',
            66: 'sleet/light',
            67: 'sleet/heavy',
            71: 'snow/light',
            73: 'snow/moderate',
            75: 'snow/heavy',
            77: 'sleet/light',
            80: 'rain/light',
            81: 'rain/moderate',
            82: 'rain/heavy',
            85: 'snow/light',
            86: 'snow/heavy',
            95: 'thunderstorm/heavy',
            96: 'thunderstorm/heavy',
            99: 'thunderstorm/heavy',
        };
        for (const [
            code,
            text,
        ] of Object.entries(expected)) {
            assert.strictEquals(wmo(Number(code)), text, `code ${code}`);
        }
    });

    it('gives null for unknown codes', () => {
        assert.isNull(precipitationFromWmo(-1));
        assert.isNull(precipitationFromWmo(60));
        assert.isNull(precipitationFromWmo(100));
    });
});

function entry(weather: string, intensity: string | null) {
    return {
        weather,
        intensity,
    };
}

function nws(...entries: unknown[]): string | null {
    const result = precipitationFromNws(entries);
    return result ? `${result.kind}/${result.intensity}` : null;
}

describe(precipitationFromNws.name, () => {
    it('gives null when presentWeather is not a list', () => {
        assert.isNull(precipitationFromNws(undefined));
        assert.isNull(precipitationFromNws('rain'));
    });

    it('gives none for an empty list and for fog only', () => {
        assert.strictEquals(nws(), 'none/light');
        assert.strictEquals(
            nws(
                entry('fog_mist', null),
                {
                    weather: 'haze',
                },
                'junk',
                null,
                {
                    weather: 3,
                },
            ),
            'none/light',
        );
    });

    it('reads each kind and intensity', () => {
        assert.strictEquals(nws(entry('rain', 'light')), 'rain/light');
        assert.strictEquals(nws(entry('rain', null)), 'rain/moderate');
        assert.strictEquals(nws(entry('rain', 'heavy')), 'rain/heavy');
        assert.strictEquals(nws(entry('drizzle', 'light')), 'drizzle/light');
        assert.strictEquals(nws(entry('snow', null)), 'snow/moderate');
        assert.strictEquals(nws(entry('ice_pellets', 'heavy')), 'sleet/heavy');
        assert.strictEquals(nws(entry('freezing_rain', 'light')), 'sleet/light');
        assert.strictEquals(nws(entry('hail', null)), 'sleet/moderate');
        assert.strictEquals(nws(entry('snow_grains', null)), 'sleet/moderate');
        assert.strictEquals(nws(entry('thunderstorms', null)), 'thunderstorm/moderate');
    });

    it('picks the strongest of several entries', () => {
        assert.strictEquals(
            nws(entry('drizzle', 'heavy'), entry('rain', 'light'), entry('fog_mist', null)),
            'rain/light',
        );
        assert.strictEquals(nws(entry('rain', 'heavy'), entry('snow', 'light')), 'snow/light');
        assert.strictEquals(
            nws(entry('snow', 'heavy'), entry('ice_pellets', 'light')),
            'sleet/light',
        );
        assert.strictEquals(
            nws(entry('ice_pellets', 'heavy'), entry('thunderstorms', 'light')),
            'thunderstorm/light',
        );
        assert.strictEquals(nws(entry('rain', 'light'), entry('rain', 'heavy')), 'rain/heavy');
        assert.strictEquals(nws(entry('rain', 'heavy'), entry('rain', 'light')), 'rain/heavy');
    });
});

function precipitation(
    kind: Precipitation['kind'],
    intensity: Precipitation['intensity'],
): Precipitation {
    return {
        kind,
        intensity,
    };
}

describe(describePrecipitation.name, () => {
    it('describes each case', () => {
        assert.strictEquals(
            describePrecipitation(precipitation('drizzle', 'light')),
            'Light drizzle',
        );
        assert.strictEquals(describePrecipitation(precipitation('snow', 'heavy')), 'Heavy snow');
        assert.strictEquals(describePrecipitation(precipitation('rain', 'moderate')), 'Rain');
        assert.strictEquals(
            describePrecipitation(precipitation('thunderstorm', 'heavy')),
            'Thunderstorm',
        );
        assert.strictEquals(describePrecipitation(precipitation('none', 'light')), 'Dry');
    });
});

describe(describeWetNote.name, () => {
    it('notes moderate and heavy rain, snow, sleet and storms', () => {
        assert.strictEquals(
            describeWetNote(precipitation('rain', 'moderate')),
            "It's raining (moderate) right now.",
        );
        assert.strictEquals(
            describeWetNote(precipitation('snow', 'heavy')),
            "It's snowing (heavy) right now.",
        );
        assert.strictEquals(
            describeWetNote(precipitation('sleet', 'moderate')),
            "It's sleeting (moderate) right now.",
        );
        assert.strictEquals(
            describeWetNote(precipitation('thunderstorm', 'heavy')),
            "It's storming (heavy) right now.",
        );
    });

    it('has no note for dry, light, drizzle or unknown', () => {
        assert.isUndefined(describeWetNote(null));
        assert.isUndefined(describeWetNote(precipitation('none', 'light')));
        assert.isUndefined(describeWetNote(precipitation('rain', 'light')));
        assert.isUndefined(describeWetNote(precipitation('drizzle', 'heavy')));
    });
});
