import {defineEslintConfig} from '@virmator/lint/configs/eslint.config.base.js';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
    ...defineEslintConfig(__dirname),
    {
        ignores: [
            /** Add file globs that should be ignored. */
            '.claude/**',
            '.not-committed/**',
            '.wrangler/**',
            'test-results/**',
            'playwright-report/**',
        ],
    },
    {
        files: ['src/worker/**/*.ts'],
        rules: {
            /** Url-vir's parseUrl compiles shapes with new Function, which Workers requests forbid. */
            '@virmator/prefer-parse-url': 'off',
        },
    },
    {
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: 'object-shape-tester',
                            importNames: [
                                'checkValidShape',
                                'assertValidShape',
                                'checkWrapValidShape',
                                'assertWrapValidShape',
                            ],
                            message:
                                'These compile shapes with new Function, which Workers requests forbid. Use checkShape / assertShape from src/data/shape-check.ts.',
                        },
                    ],
                },
            ],
        },
    },
];
