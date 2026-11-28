/** What kind of outing a record is. Ids are stored: never rename. */
export const activities = {
    run: 'run',
    walk: 'walk',
} as const;

export type Activity = (typeof activities)[keyof typeof activities];

export const activityLabels: Readonly<Record<Activity, string>> = {
    [activities.run]: 'Run',
    [activities.walk]: 'Walk',
};
