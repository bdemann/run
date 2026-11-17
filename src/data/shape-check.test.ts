import {assert} from '@augment-vir/assert';
import {itCases} from '@augment-vir/test';
import {describe, it} from 'node:test';
import {
    defineShape,
    enumShape,
    nullableShape,
    ShapeMismatchError,
    uuidShape,
} from 'object-shape-tester';
import {assertShape, checkShape} from './shape-check.js';

enum Color {
    Red = 'red',
    Blue = 'blue',
}

const testShape = defineShape({
    id: uuidShape(),
    color: enumShape(Color),
    note: nullableShape(''),
    count: 0,
});

const validUuid = '123e4567-e89b-42d3-a456-426614174000';
const validValue = {
    id: validUuid,
    color: 'red',
    note: null,
    count: 1,
};

describe(checkShape.name, () => {
    itCases(
        (input: {value: unknown; allowExtraKeys?: boolean}) => {
            return checkShape(input.value, testShape, {
                allowExtraKeys: input.allowExtraKeys,
            });
        },
        [
            {
                it: 'accepts a valid value',
                input: {
                    value: validValue,
                },
                expect: true,
            },
            {
                it: 'accepts a nullable value that is a string',
                input: {
                    value: {
                        ...validValue,
                        note: 'hi',
                    },
                },
                expect: true,
            },
            {
                it: 'accepts an omitted nullable value',
                input: {
                    value: {
                        id: validUuid,
                        color: 'blue',
                        count: 2,
                    },
                },
                expect: true,
            },
            {
                it: 'rejects a bad uuid',
                input: {
                    value: {
                        ...validValue,
                        id: 'nope',
                    },
                },
                expect: false,
            },
            {
                it: 'rejects a value outside the enum',
                input: {
                    value: {
                        ...validValue,
                        color: 'green',
                    },
                },
                expect: false,
            },
            {
                it: 'rejects a wrong-typed nullable value',
                input: {
                    value: {
                        ...validValue,
                        note: 4,
                    },
                },
                expect: false,
            },
            {
                it: 'rejects a missing key',
                input: {
                    value: {
                        id: validUuid,
                    },
                },
                expect: false,
            },
            {
                it: 'rejects non-objects',
                input: {
                    value: 'text',
                },
                expect: false,
            },
            {
                it: 'rejects extra keys by default',
                input: {
                    value: {
                        ...validValue,
                        extra: 1,
                    },
                },
                expect: false,
            },
            {
                it: 'rejects extra keys when explicitly disallowed',
                input: {
                    value: {
                        ...validValue,
                        extra: 1,
                    },
                    allowExtraKeys: false,
                },
                expect: false,
            },
            {
                it: 'accepts extra keys when allowed',
                input: {
                    value: {
                        ...validValue,
                        extra: 1,
                    },
                    allowExtraKeys: true,
                },
                expect: true,
            },
        ],
    );

    it('accepts a plain init object as a shape', () => {
        assert.isTrue(
            checkShape(
                {
                    a: 'x',
                },
                {
                    a: '',
                },
            ),
        );
        assert.isFalse(
            checkShape(
                {
                    a: 1,
                },
                {
                    a: '',
                },
            ),
        );
    });
});

describe(assertShape.name, () => {
    it('does not throw for a valid value', () => {
        assertShape(validValue, testShape);
        assert.isTrue(checkShape(validValue, testShape));
    });

    it('throws a ShapeMismatchError for an invalid value', () => {
        assert.throws(
            () => {
                return assertShape(
                    {
                        ...validValue,
                        id: 'nope',
                    },
                    testShape,
                );
            },
            {
                matchConstructor: ShapeMismatchError,
            },
        );
    });

    it('throws for extra keys unless allowed', () => {
        assert.throws(() => {
            return assertShape(
                {
                    ...validValue,
                    extra: 1,
                },
                testShape,
            );
        });
        assertShape(
            {
                ...validValue,
                extra: 1,
            },
            testShape,
            {
                allowExtraKeys: true,
            },
        );
    });
});
