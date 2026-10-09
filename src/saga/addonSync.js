// Saga: keeps each box's addons exactly as listed in addons.json (rendered with the box's secrets by
// weebio-agent at /weebio/api/addons): same addons, same order, with any "remove"d parts stripped.
//
// stremio-core loads its profile from localStorage ('profile') when it initialises, so the list is
// written there *before* the app starts, like Cinebye does for accounts. That also works for addons
// stremio-core protects from in-app changes (Cinemeta, Local Files). On a box's very first start there
// is no stored profile yet; completeFirstRun() then makes core save its default, rewrites it, and reloads.

const PROFILE_KEY = 'profile';
const CACHE_KEY = 'saga.addonManifests'; // original (unstripped) manifests by URL, for offline/fast starts
const MANIFEST_TIMEOUT = 5000;

const readJSON = (key) => {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch (_) {
        return null;
    }
};

const writeJSON = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (_) {
        return false;
    }
};

const fetchJSON = async (url, timeout) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
};

// Host only: addon URLs can carry keys, so logs never print them in full.
const host = (url) => {
    try {
        return new URL(url).host;
    } catch (_) {
        return '?';
    }
};

// ---- manifest editing (pure; covered by tests/sagaAddonSync.spec.js) ----

const isSearch = (extra) => extra === 'search' || (extra && extra.name === 'search');
const hasSearch = (catalog) => (catalog.extra || []).some(isSearch) || (catalog.extraSupported || []).includes('search');
const searchRequired = (catalog) =>
    (catalog.extra || []).some((extra) => isSearch(extra) && extra.isRequired) || (catalog.extraRequired || []).includes('search');

// A catalog that only answers searches: hidden from Board/Discover, still used by Search.
const searchOnly = (catalog) => ({
    ...catalog,
    ...(catalog.extra ? { extra: catalog.extra.map((extra) => isSearch(extra) ? { ...extra, isRequired: true } : extra) } : {}),
    ...((catalog.extraSupported || []).includes('search') ?
        { extraRequired: Array.from(new Set([...(catalog.extraRequired || []), 'search'])) } : {}),
});

const withoutSearch = (catalog) => ({
    ...catalog,
    ...(catalog.extra ? { extra: catalog.extra.filter((extra) => !isSearch(extra)) } : {}),
    ...(catalog.extraSupported ? { extraSupported: catalog.extraSupported.filter((name) => name !== 'search') } : {}),
    ...(catalog.extraRequired ? { extraRequired: catalog.extraRequired.filter((name) => name !== 'search') } : {}),
});

// remove: "catalogs" (Board/Discover rows), "search" (search results), or a resource name ("meta",
// "stream", "subtitles"...) to stop the addon answering that kind of request.
const applyRemove = (manifest, remove = []) => {
    if (remove.length === 0) return manifest;
    const removeCatalogs = remove.includes('catalogs');
    const removeSearch = remove.includes('search');
    const resources = remove.filter((name) => name !== 'catalogs' && name !== 'search');
    const catalogs = (manifest.catalogs || []).flatMap((catalog) => {
        const searchable = hasSearch(catalog);
        if (removeCatalogs && removeSearch) return [];
        if (removeCatalogs) return searchable ? [searchOnly(catalog)] : [];
        if (removeSearch && searchable) return searchRequired(catalog) ? [] : [withoutSearch(catalog)];
        return [catalog];
    });
    return {
        ...manifest,
        catalogs,
        resources: (manifest.resources || []).filter((resource) => !resources.includes(typeof resource === 'string' ? resource : resource.name)),
    };
};

// The descriptors to store, in addons.json order. Manifests come from a fresh fetch or the cache; failing
// both, an addon already in the profile keeps its stored manifest. Existing flags (official/protected) stay.
const buildAddons = (wanted, currentAddons, manifests) => wanted.flatMap(({ url, remove }) => {
    const current = currentAddons.find((addon) => addon.transportUrl === url);
    const manifest = manifests[url] || (current && current.manifest);
    if (!manifest || !manifest.id) {
        console.warn(`[saga] addon ${host(url)} unavailable, skipped`);
        return [];
    }
    return [{
        manifest: applyRemove(manifest, remove),
        transportUrl: url,
        flags: (current && current.flags) || { official: false, protected: false },
    }];
});

// ---- startup ----

let pending = null; // first-run state, finished by completeFirstRun()

const writeProfile = (profile, wanted, manifests) => {
    const addons = buildAddons(wanted, profile.addons || [], manifests);
    if (addons.length === 0) return false; // never leave a box with no addons
    // addonsLocked also makes stremio-core refuse installs/uninstalls from anywhere in the UI.
    return writeJSON(PROFILE_KEY, { ...profile, addons, addonsLocked: true });
};

// Call before the app renders. Never throws: without the agent (e.g. plain stremio-web dev) it does nothing.
const syncAddons = async () => {
    let list;
    try {
        list = await fetchJSON('/weebio/api/addons', 3000);
    } catch (_) {
        return;
    }
    (list.warnings || []).forEach((warning) => console.warn(`[saga] ${warning}`));
    const wanted = list.addons || [];
    if (wanted.length === 0) return;

    const cache = readJSON(CACHE_KEY) || {};
    const refresh = Promise.all(wanted.map(async ({ url }) => {
        try {
            cache[url] = await fetchJSON(url, MANIFEST_TIMEOUT);
        } catch (_) {
            console.warn(`[saga] could not refresh ${host(url)}; using cached manifest`);
        }
    })).then(() => {
        const keep = Object.fromEntries(wanted.filter(({ url }) => cache[url]).map(({ url }) => [url, cache[url]]));
        writeJSON(CACHE_KEY, keep);
    });
    // With every manifest cached, start straight away; the refresh applies on the next start.
    if (!wanted.every(({ url }) => cache[url])) await refresh;

    const profile = readJSON(PROFILE_KEY);
    if (profile && Array.isArray(profile.addons)) {
        writeProfile(profile, wanted, cache);
    } else {
        pending = { wanted, cache };
    }
};

// First start only: there was no stored profile to rewrite. Installing one addon the normal way makes
// stremio-core save its default profile; then the list is rewritten and the app reloads into it.
const completeFirstRun = async (core) => {
    if (!pending) return;
    const { wanted, cache } = pending;
    pending = null;
    const first = buildAddons(wanted, [], cache)[0];
    if (!first) return;
    core.transport.dispatch({ action: 'Ctx', args: { action: 'InstallAddon', args: first } });
    for (let waited = 0; waited < 10000; waited += 250) {
        const profile = readJSON(PROFILE_KEY);
        if (profile && Array.isArray(profile.addons)) {
            if (writeProfile(profile, wanted, cache)) window.location.reload();
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    console.warn('[saga] first-run addon sync timed out; it will apply on the next start');
};

module.exports = {
    syncAddons,
    completeFirstRun,
    applyRemove,
    buildAddons,
};
