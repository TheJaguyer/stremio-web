// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const { useHover } = require('react-aria/useHover');
const filterInvalidDOMProps = require('filter-invalid-dom-props').default;
const { useNavigateWithOrigin } = require('stremio-router');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { default: Button } = require('stremio/components/Button');
const { default: Image } = require('stremio/components/Image');
const { useCore } = require('stremio/core');
const { isInLibrary, addToLibrary, removeFromLibrary } = require('stremio/saga/library');
const { default: ItemMenu } = require('./ItemMenu');
const useBinaryState = require('stremio/common/useBinaryState');
const { default: getMetaDetailsHref } = require('stremio/common/getMetaDetailsHref');
const { ICON_FOR_TYPE } = require('stremio/common/CONSTANTS');
const styles = require('./styles');

// Saga: the poster after/before this one, to keep focus nearby when this one disappears (e.g. removed
// from Continue Watching).
const neighbourOf = (container) => {
    const sibling = container?.nextElementSibling ?? container?.previousElementSibling;
    return sibling?.querySelector('[tabindex]') ?? null;
};

// Saga: actionMenu / onDismissClick are taken out of props (not passed to the DOM) but unused: no mouse buttons.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MetaItem = React.memo(({ className, type, name, poster, posterShape, posterChangeCursor, progress, newVideos, options, actionMenu, deepLinks, href: customHref, dataset, optionOnSelect, onDismissClick, onPlayClick, watched, live, ...props }) => {
    const { t } = useTranslation();
    const artwork = poster && typeof poster === 'object' ? poster : { src: poster, shape: posterShape, changeCursor: posterChangeCursor };
    const { navigateWithOrigin } = useNavigateWithOrigin();
    const core = useCore();
    const [menuOpen, onMenuOpen, onMenuClose] = useBinaryState(false);
    const [menuOptions, setMenuOptions] = React.useState([]);
    const containerRef = React.useRef(null);
    const linkRef = React.useRef(null);
    const { hoverProps, isHovered } = useHover({});
    const href = React.useMemo(() => {
        return typeof customHref === 'string' ? customHref : getMetaDetailsHref(deepLinks);
    }, [customHref, deepLinks]);
    const metaItemOnClick = React.useCallback((event) => {
        if (typeof props.onClick === 'function') {
            props.onClick(event);
        }

        if (
            !event.defaultPrevented &&
            event.button === 0 &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            (!event.currentTarget.target || event.currentTarget.target === '_self') &&
            typeof href === 'string'
        ) {
            event.preventDefault();
            navigateWithOrigin(href);
        }
    }, [href, navigateWithOrigin, props.onClick]);
    const playOnClick = React.useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        onPlayClick(event);
    }, [onPlayClick]);
    // Saga: `options` may be a function, evaluated when the menu opens (LibItem). Catalog posters (anything
    // with a meta id and no options of its own) get "Add to / Remove from library".
    const catalogId = typeof props.id === 'string' && typeof type === 'string' ? props.id : null;
    const hasOptions = typeof options === 'function' || (Array.isArray(options) && options.length > 0) || catalogId !== null;
    const resolveOptions = React.useCallback(() => {
        if (typeof options === 'function') return options();
        if (Array.isArray(options) && options.length > 0) return options;
        if (catalogId === null) return [];
        return isInLibrary(catalogId) ?
            [{ label: t('REMOVE_FROM_LIB'), value: 'saga-remove-from-library' }]
            :
            [{ label: t('ADD_TO_LIB'), value: 'saga-add-to-library' }];
    }, [options, catalogId, t]);
    // Saga: no mouse-only buttons on posters (the X on Continue Watching, the ⋮ menu); gamepad Y (sent here
    // as a 'saga-item-menu' event on the focused poster) opens the options as a focused menu instead.
    React.useEffect(() => {
        const container = containerRef.current;
        if (!container || !hasOptions) return;
        const onItemMenu = (event) => {
            event.stopPropagation();
            const resolved = resolveOptions();
            if (resolved.length === 0) return;
            setMenuOptions(resolved);
            onMenuOpen();
        };
        container.addEventListener('saga-item-menu', onItemMenu);
        return () => container.removeEventListener('saga-item-menu', onItemMenu);
    }, [hasOptions, resolveOptions, onMenuOpen]);
    const menuOnCancel = React.useCallback(() => {
        onMenuClose();
        linkRef.current?.focus();
    }, [onMenuClose]);
    const menuOnSelect = React.useCallback((value, reactEvent) => {
        const container = containerRef.current;
        const neighbour = neighbourOf(container);
        onMenuClose();
        linkRef.current?.focus();
        if (value === 'saga-add-to-library') {
            addToLibrary(core, { id: catalogId, type, name, poster: artwork.src, posterShape: artwork.shape });
            return;
        }
        if (value === 'saga-remove-from-library') {
            removeFromLibrary(core, catalogId);
            return;
        }
        if (typeof optionOnSelect === 'function') {
            optionOnSelect({
                type: 'select-option',
                value,
                dataset: dataset,
                reactEvent,
                nativeEvent: reactEvent.nativeEvent
            });
        }
        // If the poster goes away (removed / dismissed), move focus to the one beside it.
        const deadline = Date.now() + 2000;
        const followUp = () => {
            if (container && !container.isConnected) {
                const active = document.activeElement;
                if ((!active || active === document.body) && neighbour?.isConnected) neighbour.focus();
            } else if (Date.now() < deadline) {
                setTimeout(followUp, 100);
            }
        };
        setTimeout(followUp, 100);
    }, [dataset, optionOnSelect, onMenuClose, core, catalogId, type, name, artwork.src, artwork.shape]);
    const renderPosterFallback = React.useCallback(() => (
        <Icon
            className={styles['placeholder-icon']}
            name={ICON_FOR_TYPE.has(type) ? ICON_FOR_TYPE.get(type) : ICON_FOR_TYPE.get('other')}
        />
    ), [type]);
    return (
        <div ref={containerRef} {...hoverProps} className={classnames(className, styles['meta-item-container'], styles['poster-shape-poster'], styles[`poster-shape-${artwork.shape}`], { 'active': menuOpen, 'hovered': isHovered })}>
            <Button ref={linkRef} title={name} href={href} {...filterInvalidDOMProps(props)} className={styles['meta-item-link']} onClick={metaItemOnClick}>
                <div className={classnames(styles['poster-container'], { 'poster-change-cursor': artwork.changeCursor })}>
                    {
                        watched ?
                            <div className={styles['watched-icon-layer']}>
                                <Icon className={styles['watched-icon']} name={'checkmark'} />
                            </div>
                            :
                            null
                    }
                    <div className={styles['poster-image-layer']}>
                        <Image
                            className={styles['poster-image']}
                            src={artwork.src}
                            alt={' '}
                            renderFallback={renderPosterFallback}
                        />
                        {
                            live ?
                                <div className={styles['live-badge-layer']}>
                                    <div className={styles['live-badge-label']}>{t('PLAYER_LIVE', { defaultValue: 'Live' })}</div>
                                </div>
                                :
                                null
                        }
                    </div>
                    {artwork.overlay}
                    {
                        onPlayClick ?
                            <div title={t('CONTINUE_WATCHING')} className={styles['play-icon-layer']} onClick={playOnClick}>
                                <Icon className={styles['play-icon']} name={'play'} />
                                <div className={styles['play-icon-outer']} />
                                <div className={styles['play-icon-background']} />
                            </div>
                            :
                            null
                    }
                    {
                        progress > 0 ?
                            <div className={styles['progress-bar-layer']}>
                                <div className={styles['progress-bar']} style={{ width: `${progress}%` }} />
                                <div className={styles['progress-bar-background']} />
                            </div>
                            :
                            null
                    }
                    {
                        newVideos > 0 ?
                            <div className={styles['new-videos']}>
                                <div className={styles['layer']} />
                                <div className={styles['layer']} />
                                <div className={styles['layer']}>
                                    <Icon className={styles['icon']} name={'add'} />
                                    <div className={styles['label']}>
                                        {newVideos}
                                    </div>
                                </div>
                            </div>
                            :
                            null
                    }
                </div>
                {
                    typeof name === 'string' && name.length > 0 ?
                        <div className={styles['title-bar-container']}>
                            <div className={styles['title-label']}>
                                {typeof name === 'string' && name.length > 0 ? name : ''}
                            </div>
                        </div>
                        :
                        null
                }
            </Button>
            {
                menuOpen && menuOptions.length > 0 ?
                    <ItemMenu title={name} options={menuOptions} onSelect={menuOnSelect} onCancel={menuOnCancel} />
                    :
                    null
            }
        </div>
    );
});

MetaItem.displayName = 'MetaItem';

MetaItem.propTypes = {
    id: PropTypes.string,
    className: PropTypes.string,
    type: PropTypes.string,
    name: PropTypes.string,
    poster: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.shape({
            src: PropTypes.string,
            shape: PropTypes.oneOf(['poster', 'landscape', 'square']),
            changeCursor: PropTypes.bool,
            overlay: PropTypes.node,
        }),
    ]),
    posterShape: PropTypes.oneOf(['poster', 'landscape', 'square']),
    posterChangeCursor: PropTypes.bool,
    progress: PropTypes.number,
    newVideos: PropTypes.number,
    options: PropTypes.oneOfType([PropTypes.array, PropTypes.func]),
    actionMenu: PropTypes.bool,
    href: PropTypes.string,
    deepLinks: PropTypes.shape({
        metaDetailsVideos: PropTypes.string,
        metaDetailsStreams: PropTypes.string,
        player: PropTypes.string
    }),
    dataset: PropTypes.object,
    optionOnSelect: PropTypes.func,
    onDismissClick: PropTypes.func,
    onPlayClick: PropTypes.func,
    onClick: PropTypes.func,
    watched: PropTypes.bool,
    live: PropTypes.bool
};

module.exports = MetaItem;
