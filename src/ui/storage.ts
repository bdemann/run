import {LocalStorageClient} from '@electrovir/local-storage-client';
import {unknownShape} from 'object-shape-tester';
import {createMemoryBackend, RunStore, type DocumentBackend} from '../data/run-store.js';

/**
 * Everything is one small JSON document in localStorage. The shape is deliberately raw here:
 * `parseUserData` validates each run on load, so one bad record never loses the rest.
 */
const localStorageClient = new LocalStorageClient(
    {
        userData: unknownShape(),
    },
    {
        storeName: 'run-log',
    },
);

function createLocalStorageBackend(): DocumentBackend {
    return {
        load() {
            return localStorageClient.get.userData();
        },
        save(data) {
            localStorageClient.set.userData(data);
        },
    };
}

/** Falls back to memory (lost on reload) when localStorage is blocked, e.g. some private modes. */
function createBrowserBackend(): DocumentBackend {
    try {
        const backend = createLocalStorageBackend();
        backend.load();
        return backend;
    } catch {
        return createMemoryBackend();
    }
}

let sharedStore: RunStore | undefined;

/** The app's one store. */
export function getRunStore(): RunStore {
    sharedStore ??= new RunStore(createBrowserBackend());
    return sharedStore;
}
