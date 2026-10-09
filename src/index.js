// Copyright (C) 2017-2023 Smart code 203358507

if (typeof process.env.SENTRY_DSN === 'string') {
    const Sentry = require('@sentry/browser');
    Sentry.init({ dsn: process.env.SENTRY_DSN });
}

const Bowser = require('bowser');
const browser = Bowser.parse(window.navigator?.userAgent || '');
if (browser?.platform?.type === 'desktop') {
    document.querySelector('meta[name="viewport"]')?.setAttribute('content', '');
}

const React = require('react');
const ReactDOM = require('react-dom/client');
const { HashRouter } = require('react-router-dom');
const i18n = require('i18next');
const { initReactI18next } = require('react-i18next');
const stremioTranslations = require('stremio-translations');
const App = require('./App');
const { default: WebUpdateScreen } = require('./App/WebUpdateScreen');
const { CoreProvider } = require('./core');
const { syncAddons } = require('./saga/addonSync');
require('./saga/scrollHover');
const { FileDropProvider, PlatformProvider } = require('./common');

const brand = require('../brand.json');

// Colour theme: served by weebio-agent (/weebio/themes/<id>.css) and chosen in Settings. The agent's own
// pages share this origin and key, so the boot and Wi-Fi screens always match the app.
(() => {
    let theme = 'saga';
    try {
        theme = localStorage.getItem('weebio.theme') || theme;
    } catch (_) { /* storage unavailable: keep the default */ }
    document.documentElement.dataset.theme = theme;
    const link = document.createElement('link');
    link.id = 'saga-theme'; // Settings > Appearance swaps this href to change theme live
    link.rel = 'stylesheet';
    link.href = `/weebio/themes/${encodeURIComponent(theme)}.css`;
    document.head.appendChild(link);
})();

// Every interface string, in every language, names the product from brand.json instead of "Stremio".
const rebrand = (strings) => Object.fromEntries(Object.entries(strings).map(([key, text]) => [
    key,
    typeof text === 'string' ? text.replace(/Stremio/g, brand.name) : text
]));

const translations = Object.fromEntries(Object.entries(stremioTranslations()).map(([key, value]) => [key, {
    translation: rebrand(value)
}]));

// Labels for Saga's own Settings sections. English only; other languages fall back to these.
translations['en-US'].translation = {
    ...translations['en-US'].translation,
    // Pasting links isn't practical on a TV box, so search is just search.
    SEARCH_OR_PASTE_LINK: 'Search',
    // The first side tab ("Board" upstream).
    Board: 'Home',
    SAGA_KB_DELETE: 'Delete',
    SAGA_KB_SPACE: 'Space',
    SAGA_KB_CLEAR: 'Clear',
    SAGA_KB_CLOSE: 'Close',
    SAGA_KB_SEARCH: 'Search',
    // Empty Library / Continue Watching: text only, no illustration.
    LIBRARY_EMPTY: 'Nothing here...',
    BOARD_CONTINUE_WATCHING_EMPTY: 'Nothing here...',
    SAGA_APPEARANCE: 'Appearance',
    SAGA_THEME: 'Theme',
    SAGA_PLAYBACK: 'Playback',
    SAGA_NETWORK: 'Network',
    SAGA_WIFI: 'Wi-Fi',
    SAGA_WIFI_CHANGE: 'Change network',
    SAGA_WIFI_NOT_CONNECTED: 'Not connected',
    SAGA_ETHERNET_CONNECTED: 'Connected to Ethernet',
    SAGA_ABOUT: `About ${brand.name}`,
    SAGA_BOX_ID: 'Box ID',
    SAGA_VERSION: 'Version',
    SAGA_BUILD: 'Build',
};

i18n
    .use(initReactI18next)
    .init({
        resources: translations,
        lng: 'en-US',
        fallbackLng: 'en-US',
        interpolation: {
            escapeValue: false
        }
    });

const appInfo = {
    appVersion: process.env.VERSION,
    shellVersion: null
};

const root = ReactDOM.createRoot(document.getElementById('app'));
// Saga: put the box's addon list in place before stremio-core starts and reads it.
syncAddons().catch((error) => console.error('[saga] addon sync failed', error)).finally(() => root.render(
    <React.StrictMode>
        <PlatformProvider>
            <CoreProvider appInfo={appInfo}>
                <FileDropProvider>
                    <HashRouter>
                        <>
                            <WebUpdateScreen />
                            <App />
                        </>
                    </HashRouter>
                </FileDropProvider>
            </CoreProvider>
        </PlatformProvider>
    </React.StrictMode>
));
