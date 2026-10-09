// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useNavigate } = require('react-router');
const { useNavigateWithOrigin } = require('stremio-router');
const { default: toPath } = require('stremio-router/toPath');
const PropTypes = require('prop-types');
const { useCore } = require('stremio/core');
const { default: getMetaDetailsHref } = require('stremio/common/getMetaDetailsHref');
const MetaItem = require('stremio/components/MetaItem');
const { t } = require('i18next');
const { isInLibrary, addToLibrary, removeFromLibrary } = require('stremio/saga/library');

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Saga: `removable` no longer matters (the menu offers add/remove by library state)
const LibItem = ({ _id, removable, notifications, watched, detailsVideosFirst, ...props }) => {
    const navigate = useNavigate();
    const { navigateWithOrigin } = useNavigateWithOrigin();
    const core = useCore();
    const detailsHref = React.useMemo(() => getMetaDetailsHref(props.deepLinks, detailsVideosFirst), [props.deepLinks, detailsVideosFirst]);
    const playerHref = props.deepLinks && typeof props.deepLinks.player === 'string' ? props.deepLinks.player : null;

    const newVideos = React.useMemo(() => {
        const count = notifications.items?.[_id]?.length ?? 0;
        return Math.min(Math.max(count, 0), 99);
    }, [_id, notifications]);

    // Saga: built when the menu opens (gamepad Y), so "Add to / Remove from library" reflects the library now.
    const options = React.useCallback(() => {
        const inLibrary = isInLibrary(_id);
        return [
            { label: 'LIBRARY_PLAY', value: 'play' },
            { label: 'LIBRARY_DETAILS', value: 'details' },
            { label: 'LIBRARY_RESUME_DISMISS', value: 'dismiss' },
            { label: watched ? 'CTX_MARK_UNWATCHED' : 'CTX_MARK_WATCHED', value: 'watched' },
            { label: inLibrary ? 'REMOVE_FROM_LIB' : 'ADD_TO_LIB', value: inLibrary ? 'remove' : 'add' },
        ].filter(({ value }) => {
            switch (value) {
                case 'play':
                    return typeof playerHref === 'string';
                case 'details':
                    return typeof detailsHref === 'string';
                case 'watched':
                    return typeof watched !== 'undefined' && typeof detailsHref === 'string';
                case 'dismiss':
                    return typeof _id === 'string' && (typeof props.onDismissClick === 'function' || props.progress !== null && !isNaN(props.progress) && props.progress > 0);
                case 'remove':
                case 'add':
                    return typeof _id === 'string';
            }
        }).map((option) => ({
            ...option,
            label: t(option.label)
        }));
    }, [_id, props.progress, props.onDismissClick, playerHref, detailsHref, watched]);

    const optionOnSelect = React.useCallback((event) => {
        if (typeof props.optionOnSelect === 'function') {
            props.optionOnSelect(event);
        }

        if (!event.nativeEvent.optionSelectPrevented) {
            switch (event.value) {
                case 'play': {
                    if (typeof playerHref === 'string') {
                        navigate(toPath(playerHref));
                    }

                    break;
                }
                case 'details': {
                    if (typeof detailsHref === 'string') {
                        navigateWithOrigin(detailsHref);
                    }

                    break;
                }
                case 'watched': {
                    if (typeof _id === 'string') {
                        core.transport.dispatch({
                            action: 'Ctx',
                            args: {
                                action: 'LibraryItemMarkAsWatched',
                                args: {
                                    id: _id,
                                    is_watched: !watched
                                }
                            }
                        });
                    }

                    break;
                }
                case 'dismiss': {
                    if (typeof _id === 'string') {
                        core.transport.dispatch({
                            action: 'Ctx',
                            args: {
                                action: 'RewindLibraryItem',
                                args: _id
                            }
                        });
                        core.transport.dispatch({
                            action: 'Ctx',
                            args: {
                                action: 'DismissNotificationItem',
                                args: _id
                            }
                        });
                    }

                    break;
                }
                case 'remove': {
                    if (typeof _id === 'string') {
                        removeFromLibrary(core, _id);
                    }

                    break;
                }
                case 'add': {
                    if (typeof _id === 'string') {
                        addToLibrary(core, { id: _id, type: props.type, name: props.name, poster: props.poster, posterShape: props.posterShape });
                    }

                    break;
                }
            }
        }
    }, [_id, detailsHref, navigate, navigateWithOrigin, playerHref, props.optionOnSelect, props.type, props.name, props.poster, props.posterShape, watched]);

    const onPlayClick = React.useCallback((event) => {
        event.preventDefault();
        if (typeof playerHref === 'string') {
            navigate(toPath(playerHref));
        }
    }, [navigate, playerHref]);

    return (
        <MetaItem
            {...props}
            href={detailsHref}
            watched={watched}
            newVideos={newVideos}
            options={options}
            optionOnSelect={optionOnSelect}
            onPlayClick={typeof playerHref === 'string' && props.progress > 0 ? onPlayClick : null}
        />
    );
};

LibItem.propTypes = {
    _id: PropTypes.string,
    removable: PropTypes.bool,
    type: PropTypes.string,
    name: PropTypes.string,
    poster: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    posterShape: PropTypes.string,
    progress: PropTypes.number,
    notifications: PropTypes.object,
    watched: PropTypes.bool,
    detailsVideosFirst: PropTypes.bool,
    actionMenu: PropTypes.bool,
    deepLinks: PropTypes.shape({
        metaDetailsVideos: PropTypes.string,
        metaDetailsStreams: PropTypes.string,
        player: PropTypes.string
    }),
    optionOnSelect: PropTypes.func,
    onDismissClick: PropTypes.func
};

module.exports = LibItem;
