/** What is falling. Ids are stored: never rename. */
export const precipitationKinds = {
    none: 'none',
    drizzle: 'drizzle',
    rain: 'rain',
    snow: 'snow',
    /** Freezing rain, ice pellets, snow grains. */
    sleet: 'sleet',
    thunderstorm: 'thunderstorm',
} as const;

export type PrecipitationKind = (typeof precipitationKinds)[keyof typeof precipitationKinds];

export const intensities = {
    light: 'light',
    moderate: 'moderate',
    heavy: 'heavy',
} as const;

export type Intensity = (typeof intensities)[keyof typeof intensities];

/** `none` always has the intensity `light`, which is ignored. */
export type Precipitation = {kind: PrecipitationKind; intensity: Intensity};

/** Display order in the form. */
export const precipitationKindOrder: ReadonlyArray<PrecipitationKind> = [
    precipitationKinds.none,
    precipitationKinds.drizzle,
    precipitationKinds.rain,
    precipitationKinds.snow,
    precipitationKinds.sleet,
    precipitationKinds.thunderstorm,
];

export const intensityOrder: ReadonlyArray<Intensity> = [
    intensities.light,
    intensities.moderate,
    intensities.heavy,
];

export const precipitationKindLabels: Readonly<Record<PrecipitationKind, string>> = {
    [precipitationKinds.none]: 'Dry',
    [precipitationKinds.drizzle]: 'Drizzle',
    [precipitationKinds.rain]: 'Rain',
    [precipitationKinds.snow]: 'Snow',
    [precipitationKinds.sleet]: 'Sleet',
    [precipitationKinds.thunderstorm]: 'Storm',
};

export const intensityLabels: Readonly<Record<Intensity, string>> = {
    [intensities.light]: 'Light',
    [intensities.moderate]: 'Moderate',
    [intensities.heavy]: 'Heavy',
};

function precipitation(kind: PrecipitationKind, intensity: Intensity): Precipitation {
    return {
        kind,
        intensity: kind === precipitationKinds.none ? intensities.light : intensity,
    };
}

/** WMO weather codes with precipitation (showers count as rain or snow). 0 to 48 are dry. */
const wmoPrecipitation: Readonly<Record<number, Readonly<Precipitation>>> = {
    51: precipitation(precipitationKinds.drizzle, intensities.light),
    53: precipitation(precipitationKinds.drizzle, intensities.moderate),
    55: precipitation(precipitationKinds.drizzle, intensities.heavy),
    56: precipitation(precipitationKinds.sleet, intensities.light),
    57: precipitation(precipitationKinds.sleet, intensities.heavy),
    61: precipitation(precipitationKinds.rain, intensities.light),
    63: precipitation(precipitationKinds.rain, intensities.moderate),
    65: precipitation(precipitationKinds.rain, intensities.heavy),
    66: precipitation(precipitationKinds.sleet, intensities.light),
    67: precipitation(precipitationKinds.sleet, intensities.heavy),
    71: precipitation(precipitationKinds.snow, intensities.light),
    73: precipitation(precipitationKinds.snow, intensities.moderate),
    75: precipitation(precipitationKinds.snow, intensities.heavy),
    77: precipitation(precipitationKinds.sleet, intensities.light),
    80: precipitation(precipitationKinds.rain, intensities.light),
    81: precipitation(precipitationKinds.rain, intensities.moderate),
    82: precipitation(precipitationKinds.rain, intensities.heavy),
    85: precipitation(precipitationKinds.snow, intensities.light),
    86: precipitation(precipitationKinds.snow, intensities.heavy),
    95: precipitation(precipitationKinds.thunderstorm, intensities.heavy),
    96: precipitation(precipitationKinds.thunderstorm, intensities.heavy),
    99: precipitation(precipitationKinds.thunderstorm, intensities.heavy),
};

/**
 * Open-Meteo's WMO weather code, which gives both type and intensity. Gives `null` for a code that
 * is not known.
 */
export function precipitationFromWmo(code: number): Precipitation | null {
    if (code >= 0 && code <= 48) {
        return precipitation(precipitationKinds.none, intensities.light);
    }
    const found = wmoPrecipitation[code];
    return found
        ? {
              ...found,
          }
        : null;
}

const kindStrength: Readonly<Record<PrecipitationKind, number>> = {
    [precipitationKinds.none]: 0,
    [precipitationKinds.drizzle]: 1,
    [precipitationKinds.rain]: 2,
    [precipitationKinds.snow]: 3,
    [precipitationKinds.sleet]: 4,
    [precipitationKinds.thunderstorm]: 5,
};

const intensityStrength: Readonly<Record<Intensity, number>> = {
    [intensities.light]: 0,
    [intensities.moderate]: 1,
    [intensities.heavy]: 2,
};

function kindFromNwsWeather(weather: string): PrecipitationKind {
    const text = weather.toLowerCase();
    if (text.includes('thunder')) {
        return precipitationKinds.thunderstorm;
    } else if (
        text.includes('ice') ||
        text.includes('freezing') ||
        text.includes('sleet') ||
        text.includes('hail') ||
        text.includes('pellets') ||
        text.includes('grains')
    ) {
        return precipitationKinds.sleet;
    } else if (text.includes('snow')) {
        return precipitationKinds.snow;
    } else if (text.includes('drizzle')) {
        return precipitationKinds.drizzle;
    } else if (text.includes('rain')) {
        return precipitationKinds.rain;
    } else {
        return precipitationKinds.none;
    }
}

function nwsIntensity(intensity: unknown): Intensity {
    return intensity === 'light'
        ? intensities.light
        : intensity === 'heavy'
          ? intensities.heavy
          : intensities.moderate;
}

function readKey(entry: unknown, key: string): unknown {
    return entry && typeof entry === 'object' ? (entry as Record<string, unknown>)[key] : undefined;
}

/**
 * NWS `presentWeather`: the strongest entry wins (thunderstorm, sleet, snow, rain, drizzle). Fog,
 * haze and mist count as dry; an empty list means nothing is falling. Gives `null` when it is not a
 * list.
 */
export function precipitationFromNws(presentWeather: unknown): Precipitation | null {
    if (!Array.isArray(presentWeather)) {
        return null;
    }
    let best = precipitation(precipitationKinds.none, intensities.light);
    for (const entry of presentWeather as unknown[]) {
        const weather = readKey(entry, 'weather');
        const candidate = precipitation(
            typeof weather === 'string' ? kindFromNwsWeather(weather) : precipitationKinds.none,
            nwsIntensity(readKey(entry, 'intensity')),
        );
        if (
            kindStrength[candidate.kind] > kindStrength[best.kind] ||
            (candidate.kind === best.kind &&
                intensityStrength[candidate.intensity] > intensityStrength[best.intensity])
        ) {
            best = candidate;
        }
    }
    return best;
}

/** `Light drizzle`, `Heavy snow`, `Rain`, `Thunderstorm` or `Dry`. */
export function describePrecipitation(value: Readonly<Precipitation>): string {
    if (value.kind === precipitationKinds.none) {
        return 'Dry';
    }
    const text =
        value.intensity === intensities.moderate || value.kind === precipitationKinds.thunderstorm
            ? value.kind
            : `${value.intensity} ${value.kind}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
}

const progressive: Readonly<Record<PrecipitationKind, string>> = {
    [precipitationKinds.none]: 'dry',
    [precipitationKinds.drizzle]: 'drizzling',
    [precipitationKinds.rain]: 'raining',
    [precipitationKinds.snow]: 'snowing',
    [precipitationKinds.sleet]: 'sleeting',
    [precipitationKinds.thunderstorm]: 'storming',
};

/**
 * `It's raining (moderate) right now.` for rain, snow, sleet or a storm at moderate or heavy
 * intensity; otherwise `undefined` (nothing worth a note).
 */
export function describeWetNote(value: Readonly<Precipitation> | null): string | undefined {
    if (
        !value ||
        value.kind === precipitationKinds.none ||
        value.kind === precipitationKinds.drizzle ||
        value.intensity === intensities.light
    ) {
        return undefined;
    }
    return `It's ${progressive[value.kind]} (${value.intensity}) right now.`;
}
