import {Value} from '@sinclair/typebox/value';
import {defineShape, ShapeMismatchError, type Shape} from 'object-shape-tester';

/** Options for {@link checkShape} and {@link assertShape}. */
export type ShapeCheckOptions = {
    /** Defaults to `false`: extra keys on objects are rejected. */
    allowExtraKeys?: boolean | undefined;
};

/**
 * Picks the interpreted (non-compiled) TypeBox schema for a shape. These are `object-shape-tester`
 * internals; the unit tests for this file guard against them changing.
 */
function getSchema(shape: unknown, allowExtraKeys: boolean) {
    const fullShape = defineShape(shape as any);
    return allowExtraKeys ? fullShape.$_schemaExtraKeys : fullShape.$_schemaNoExtraKeys;
}

/**
 * Type guard that checks a value against a shape using TypeBox's interpreted `Value.Check`. Unlike
 * object-shape-tester's `checkValidShape`, this never uses `new Function`, so it is safe inside
 * Worker requests and under a strict CSP.
 */
export function checkShape<const Init>(
    value: unknown,
    shape: Init,
    {allowExtraKeys = false}: ShapeCheckOptions = {},
): value is Shape<Init>['runtimeType'] {
    return Value.Check(getSchema(shape, allowExtraKeys), value);
}

/** Throws a `ShapeMismatchError` if the value does not match the shape. Never uses `new Function`. */
export function assertShape<const Init>(
    value: unknown,
    shape: Init,
    {allowExtraKeys = false}: ShapeCheckOptions = {},
): asserts value is Shape<Init>['runtimeType'] {
    const schema = getSchema(shape, allowExtraKeys);
    if (!Value.Check(schema, value)) {
        throw new ShapeMismatchError([...Value.Errors(schema, value)]);
    }
}
