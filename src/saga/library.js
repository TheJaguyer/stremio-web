// Saga: library membership for the poster menus. stremio-core keeps the library in localStorage
// ('library', plus the newest changes in 'library_recent'); catalog posters on the Board and in Search
// don't carry an "in library" flag, so the menu reads it from there when it opens.
// An item that was only watched (Continue Watching) exists there too, flagged removed/temp.

const bucketItems = (key) => {
    try {
        return JSON.parse(localStorage.getItem(key) ?? 'null')?.items ?? {};
    } catch (_) {
        return {};
    }
};

const isInLibrary = (id) => {
    if (typeof id !== 'string') return false;
    const item = bucketItems('library_recent')[id] ?? bucketItems('library')[id];
    return !!item && !item.removed;
};

const addToLibrary = (core, { id, type, name, poster, posterShape }) => {
    core.transport.dispatch({
        action: 'Ctx',
        args: {
            action: 'AddToLibrary',
            args: { id, type, name, poster: typeof poster === 'string' ? poster : null, posterShape: posterShape ?? 'poster' },
        },
    });
};

const removeFromLibrary = (core, id) => {
    core.transport.dispatch({
        action: 'Ctx',
        args: { action: 'RemoveFromLibrary', args: id },
    });
};

module.exports = { isInLibrary, addToLibrary, removeFromLibrary };
