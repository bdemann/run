import {itCases} from '@augment-vir/test';
import {describe} from 'node:test';
import {parseNumber} from './parse-number.js';

describe(parseNumber.name, () => {
    itCases(parseNumber, [
        {
            it: 'parses an integer',
            input: '51',
            expect: 51,
        },
        {
            it: 'parses a negative decimal with spaces',
            input: ' -3.5 ',
            expect: -3.5,
        },
        {
            it: 'returns null for empty text',
            input: '  ',
            expect: null,
        },
        {
            it: 'returns null for words',
            input: 'abc',
            expect: null,
        },
        {
            it: 'returns null for infinity',
            input: 'Infinity',
            expect: null,
        },
    ]);
});
