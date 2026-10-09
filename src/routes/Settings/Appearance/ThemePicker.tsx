// Saga: colour theme picker. Themes are served by weebio-agent (/weebio/themes/), and the choice is
// stored under the same key the agent's boot and Wi-Fi pages read, so every screen follows it.

import React, { useCallback, useEffect, useState } from 'react';
import classNames from 'classnames';
import { Button } from 'stremio/components';
import styles from './ThemePicker.less';

type Theme = {
    id: string,
    name: string,
    description: string,
    swatch: [string, string],
};

const STORAGE_KEY = 'weebio.theme';

const storedTheme = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) || 'saga';
    } catch (_) {
        return 'saga';
    }
};

const applyTheme = (id: string) => {
    try {
        localStorage.setItem(STORAGE_KEY, id);
    } catch (_) { /* not persisted, but still applied for this session */ }
    document.documentElement.dataset.theme = id;
    const link = document.getElementById('saga-theme') as HTMLLinkElement | null;
    if (link) {
        link.href = `/weebio/themes/${encodeURIComponent(id)}.css`;
    }
};

const ThemePicker = () => {
    const [themes, setThemes] = useState<Theme[]>([]);
    const [selected, setSelected] = useState(storedTheme);

    useEffect(() => {
        // Bypass WebKit's cache: the list changes when a release adds themes.
        fetch('/weebio/themes/themes.json', { cache: 'no-store' })
            .then((response) => response.json())
            .then(setThemes)
            .catch(() => setThemes([]));
    }, []);

    const onSelect = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        const id = event.currentTarget.dataset.theme;
        if (id) {
            applyTheme(id);
            setSelected(id);
        }
    }, []);

    return (
        <div className={styles['themes']}>
            {
                themes.map((theme) => (
                    <Button
                        key={theme.id}
                        className={classNames(styles['theme'], { [styles['selected']]: theme.id === selected })}
                        title={theme.description}
                        data-theme={theme.id}
                        onClick={onSelect}
                    >
                        <div
                            className={styles['swatch']}
                            style={{ background: `linear-gradient(135deg, ${theme.swatch[0]} 50%, ${theme.swatch[1]} 50%)` }}
                        />
                        <div className={styles['name']}>{theme.name}</div>
                    </Button>
                ))
            }
        </div>
    );
};

export default ThemePicker;
