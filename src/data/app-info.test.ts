import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {apiPaths, repoUrl} from './app-info.js';

describe('app-info', () => {
    it('points at the GitHub repo', () => {
        assert.strictEquals(repoUrl, 'https://github.com/bdemann/run');
    });

    it('keeps the API under /api', () => {
        assert.isTrue(Object.values(apiPaths).every((path) => path.startsWith('/api/')));
    });
});
