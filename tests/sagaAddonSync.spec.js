const { applyRemove, buildAddons } = require('../src/saga/addonSync');

// Shaped like Cinemeta's manifest: board catalogs with optional search, one search-only catalog,
// one that needs ids (last videos), in both the current (extra) and legacy (extraSupported) forms.
const cinemeta = {
    id: 'com.linvo.cinemeta',
    version: '3.0.13',
    name: 'Cinemeta',
    resources: ['catalog', 'meta', { name: 'addon_catalog' }],
    types: ['movie', 'series'],
    catalogs: [
        { type: 'movie', id: 'top', extra: [{ name: 'search' }, { name: 'genre' }, { name: 'skip' }] },
        { type: 'series', id: 'top', extraSupported: ['search', 'genre', 'skip'] },
        { type: 'movie', id: 'imdbRating', extra: [{ name: 'genre' }] },
        { type: 'movie', id: 'search-only', extra: [{ name: 'search', isRequired: true }] },
        { type: 'series', id: 'last-videos', extra: [{ name: 'lastVideosIds', isRequired: true }] },
    ],
};

describe('saga addon sync: applyRemove', () => {
    test('no remove leaves the manifest untouched', () => {
        expect(applyRemove(cinemeta, [])).toBe(cinemeta);
    });

    test('catalogs: board rows go, search keeps working', () => {
        const { catalogs } = applyRemove(cinemeta, ['catalogs']);
        expect(catalogs.map((catalog) => `${catalog.type}/${catalog.id}`)).toEqual(['movie/top', 'series/top', 'movie/search-only']);
        expect(catalogs[0].extra.find((extra) => extra.name === 'search').isRequired).toBe(true);
        expect(catalogs[1].extraRequired).toEqual(['search']);
    });

    test('search: drops search from catalogs, keeps the rows', () => {
        const { catalogs } = applyRemove(cinemeta, ['search']);
        expect(catalogs.map((catalog) => catalog.id)).toEqual(['top', 'top', 'imdbRating', 'last-videos']);
        expect(catalogs[0].extra.map((extra) => extra.name)).toEqual(['genre', 'skip']);
        expect(catalogs[1].extraSupported).toEqual(['genre', 'skip']);
    });

    test('catalogs + search + meta: nothing left but non-meta resources', () => {
        const manifest = applyRemove(cinemeta, ['catalogs', 'search', 'meta']);
        expect(manifest.catalogs).toEqual([]);
        expect(manifest.resources).toEqual(['catalog', { name: 'addon_catalog' }]);
        expect(manifest.id).toBe('com.linvo.cinemeta');
    });

    test('the original manifest is never modified', () => {
        const before = JSON.stringify(cinemeta);
        applyRemove(cinemeta, ['catalogs', 'search', 'meta']);
        expect(JSON.stringify(cinemeta)).toBe(before);
    });
});

describe('saga addon sync: buildAddons', () => {
    const local = { id: 'org.stremio.local', name: 'Local Files', version: '1.0.0', resources: [], types: [], catalogs: [] };
    const current = [
        { transportUrl: 'https://v3-cinemeta.strem.io/manifest.json', manifest: cinemeta, flags: { official: true, protected: true } },
        { transportUrl: 'http://127.0.0.1:11470/local-addon/manifest.json', manifest: local, flags: { official: true, protected: true } },
        { transportUrl: 'https://not-wanted.example/manifest.json', manifest: { id: 'x' }, flags: {} },
    ];
    const fresh = { id: 'debridio', name: 'Debridio', version: '1.0.0', resources: ['stream'], types: ['movie'], catalogs: [] };

    test('follows the wanted order, drops unwanted addons, keeps protected flags', () => {
        const addons = buildAddons([
            { url: 'https://addon.example/manifest.json' },
            { url: 'http://127.0.0.1:11470/local-addon/manifest.json' },
            { url: 'https://v3-cinemeta.strem.io/manifest.json', remove: ['catalogs', 'search', 'meta'] },
        ], current, { 'https://addon.example/manifest.json': fresh });
        expect(addons.map((addon) => addon.manifest.id)).toEqual(['debridio', 'org.stremio.local', 'com.linvo.cinemeta']);
        expect(addons[0].flags).toEqual({ official: false, protected: false });
        expect(addons[2].flags).toEqual({ official: true, protected: true });
        expect(addons[2].manifest.catalogs).toEqual([]);
    });

    test('an addon with no manifest anywhere is skipped, not stored broken', () => {
        expect(buildAddons([{ url: 'https://offline.example/manifest.json' }], current, {})).toEqual([]);
    });
});
