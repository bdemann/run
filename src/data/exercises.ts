import {measures, type Exercise} from './workout-shapes.js';

function builtIn({
    id,
    name,
    variations,
    cues,
}: Readonly<{
    id: string;
    name: string;
    variations: ReadonlyArray<Readonly<{id: string; name: string}>>;
    cues: ReadonlyArray<string>;
}>): Exercise {
    return {
        id,
        name,
        measure: measures.reps,
        variations: variations.map((variation) => {
            return {
                ...variation,
            };
        }),
        cues: [...cues],
        unlockedAt: null,
    };
}

/** The starter exercises, in circuit order. Ids are stable; never rename them. */
export const builtInExercises: ReadonlyArray<Exercise> = [
    builtIn({
        id: 'pushup',
        name: 'Pushup',
        variations: [
            {
                id: 'wall',
                name: 'Wall pushup',
            },
            {
                id: 'incline',
                name: 'Incline pushup (counter)',
            },
            {
                id: 'knee',
                name: 'Knee pushup',
            },
            {
                id: 'full',
                name: 'Pushup',
            },
            {
                id: 'decline',
                name: 'Decline pushup',
            },
        ],
        cues: [
            'Body in one straight line',
            'Elbows about 45° from your sides',
            'Chest all the way down',
        ],
    }),
    builtIn({
        id: 'situp',
        name: 'Sit-up',
        variations: [
            {
                id: 'crunch',
                name: 'Crunch',
            },
            {
                id: 'full',
                name: 'Sit-up',
            },
            {
                id: 'slow',
                name: 'Slow sit-up (3 s down)',
            },
        ],
        cues: [
            'Lower back stays on the floor for crunches',
            "Don't pull on your neck",
            'Exhale on the way up',
        ],
    }),
    builtIn({
        id: 'squat',
        name: 'Squat',
        variations: [
            {
                id: 'chair',
                name: 'Chair squat (sit and stand)',
            },
            {
                id: 'full',
                name: 'Squat',
            },
            {
                id: 'pause',
                name: 'Pause squat (3 s at the bottom)',
            },
            {
                id: 'jump',
                name: 'Jump squat',
            },
        ],
        cues: [
            'Weight in your heels',
            'Knees track over your toes',
            'Chest up',
        ],
    }),
    builtIn({
        id: 'lunge',
        name: 'Lunge (per leg)',
        variations: [
            {
                id: 'assisted',
                name: 'Assisted lunge (hold a counter)',
            },
            {
                id: 'reverse',
                name: 'Reverse lunge',
            },
            {
                id: 'forward',
                name: 'Forward lunge',
            },
            {
                id: 'walking',
                name: 'Walking lunge',
            },
        ],
        cues: [
            'Front knee over the ankle, not past the toes',
            'Back knee nearly touches the floor',
            'Count each leg once',
        ],
    }),
    builtIn({
        id: 'row',
        name: 'Row',
        variations: [
            {
                id: 'doorframe',
                name: 'Door-frame row',
            },
            {
                id: 'bent-knee',
                name: 'Bent-knee table row',
            },
            {
                id: 'straight',
                name: 'Straight-leg table row',
            },
        ],
        cues: [
            'Body stays straight',
            'Squeeze shoulder blades together',
            'Lower slowly',
        ],
    }),
];

/** Built-in exercises plus any stored ones, de-duplicated by id (the built-in wins). */
export function allExercises(
    data: Readonly<{exercises: ReadonlyArray<Exercise>}>,
): ReadonlyArray<Exercise> {
    const seen = new Set<string>();
    return [
        ...builtInExercises,
        ...data.exercises,
    ].filter((exercise) => {
        if (seen.has(exercise.id)) {
            return false;
        }
        seen.add(exercise.id);
        return true;
    });
}
