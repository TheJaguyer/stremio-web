// Saga: on-screen keyboard for Search, for TV remotes and gamepads (a box usually has no keyboard).
// Opens as a modal, so the existing spatial navigation keeps focus inside it. Recent searches (empty
// query) or title suggestions (while typing) sit above the keys and search in one press.
//
// Ways out: Search key, a recent search/suggestion, or physical Enter after typing commit; Back / Escape /
// gamepad B / Close leave without searching. Gamepad X deletes, Y types a space. A physical keyboard
// types straight in.

import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from 'stremio-router';
import Button from 'stremio/components/Button';
import { useGamepad } from 'stremio/services/GamepadContext';
import styles from './SearchKeyboard.less';

// QWERTY, 10 keys per row so every row lines up in columns (D-pad up/down stays in the same column).
const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl\'', 'zxcvbnm&.-'];
const GAMEPAD_ID = 'saga-search-keyboard';
const MAX_LENGTH = 80;

type Item = { query: string };

type Props = {
    query: string,
    history: Item[],
    suggestions: Item[],
    onChange: (query: string) => void,
    onSubmit: (query: string) => void,
    onClose: () => void,
};

const SearchKeyboard = ({ query, history, suggestions, onChange, onSubmit, onClose }: Props) => {
    const { t } = useTranslation();
    const gamepad = useGamepad();
    const panelRef = useRef<HTMLDivElement>(null);
    const searchKeyRef = useRef<HTMLDivElement>(null);
    // Latest values for the long-lived key/gamepad listeners.
    const latest = useRef({ query, onChange, onSubmit, onClose });
    latest.current = { query, onChange, onSubmit, onClose };

    const type = useCallback((text: string) => {
        const { query, onChange } = latest.current;
        if (text === ' ' && (query.length === 0 || query.endsWith(' '))) return;
        if (query.length >= MAX_LENGTH) return;
        onChange(query + text);
    }, []);
    const erase = useCallback(() => {
        latest.current.onChange(latest.current.query.slice(0, -1));
    }, []);
    const submit = useCallback(() => {
        const text = latest.current.query.trim();
        if (text.length > 0) latest.current.onSubmit(text);
    }, []);

    // Start on the first key.
    useEffect(() => {
        panelRef.current?.querySelector<HTMLElement>(`.${styles['key']}`)?.focus();
    }, []);

    // Physical keyboard, and Back/Escape (the remote's Back arrives as Escape).
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.altKey || event.metaKey) return;
            const consume = () => {
                event.preventDefault();
                event.stopImmediatePropagation();
            };
            if (event.key === 'Escape') {
                consume();
                latest.current.onClose();
            } else if (event.key === 'Backspace') {
                consume(); // delete, rather than Stremio's "Backspace = go back"
                erase();
            } else if (event.key.length === 1) {
                consume();
                type(event.key.toLowerCase());
                searchKeyRef.current?.focus(); // so a physical Enter submits
            }
        };
        window.addEventListener('keydown', onKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
    }, [type, erase]);

    // Gamepad: B closes, X deletes, Y types a space (A presses the focused key via spatial navigation).
    useEffect(() => {
        gamepad?.on('buttonB', GAMEPAD_ID, () => latest.current.onClose());
        gamepad?.on('buttonX', GAMEPAD_ID, erase);
        gamepad?.on('buttonY', GAMEPAD_ID, () => type(' '));
        return () => {
            gamepad?.off('buttonB', GAMEPAD_ID);
            gamepad?.off('buttonX', GAMEPAD_ID);
            gamepad?.off('buttonY', GAMEPAD_ID);
        };
    }, [gamepad, type, erase]);

    const quickPicks = (query.length > 0 ? suggestions : history).slice(0, 5);

    return (
        <Modal className={styles['search-keyboard-modal']}>
            <div ref={panelRef} className={styles['search-keyboard']}>
                <div className={styles['query']}>
                    {query}<span className={styles['caret']} />
                </div>
                {/* Always rendered at a fixed height, so the keys don't jump as suggestions come and go. */}
                <div className={styles['quick-picks']}>
                    {
                        quickPicks.length > 0 ?
                            <div className={styles['quick-picks-label']}>
                                {query.length > 0 ? t('SEARCH_SUGGESTIONS') : t('STREMIO_TV_SEARCH_HISTORY_TITLE')}
                            </div>
                            :
                            null
                    }
                    {
                        quickPicks.map((item, index) => (
                            <Button key={index} className={styles['quick-pick']} title={item.query} onClick={() => latest.current.onSubmit(item.query)}>
                                {item.query}
                            </Button>
                        ))
                    }
                </div>
                {
                    ROWS.map((row) => (
                        <div key={row} className={styles['row']}>
                            {
                                row.split('').map((char) => (
                                    <Button key={char} className={styles['key']} onClick={() => type(char)}>
                                        {char}
                                    </Button>
                                ))
                            }
                        </div>
                    ))
                }
                <div className={styles['row']}>
                    <Button className={styles['key']} title={t('SAGA_KB_DELETE')} onClick={erase}>⌫</Button>
                    <Button className={styles['space-key']} title={t('SAGA_KB_SPACE')} onClick={() => type(' ')}>{t('SAGA_KB_SPACE')}</Button>
                    <Button className={styles['wide-key']} title={t('SAGA_KB_CLEAR')} onClick={() => latest.current.onChange('')}>{t('SAGA_KB_CLEAR')}</Button>
                    <Button className={styles['wide-key']} title={t('SAGA_KB_CLOSE')} onClick={() => latest.current.onClose()}>{t('SAGA_KB_CLOSE')}</Button>
                    <Button ref={searchKeyRef} className={styles['search-key']} title={t('SAGA_KB_SEARCH')} onClick={submit}>{t('SAGA_KB_SEARCH')}</Button>
                </div>
            </div>
        </Modal>
    );
};

export default SearchKeyboard;
