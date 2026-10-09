// Saga: a poster's options menu for remotes and gamepads, opened with gamepad Y (or the keyboard's menu
// key). Focus starts on the first option; Cancel, Back, Escape or B close it and return to the poster.

import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from 'stremio-router';
import Button from 'stremio/components/Button';
import { useGamepad } from 'stremio/services/GamepadContext';
import styles from './ItemMenu.less';

const GAMEPAD_ID = 'saga-item-menu';

type Option = { label: string, value: string };

type Props = {
    title?: string,
    options: Option[],
    onSelect: (value: string, event: React.MouseEvent<HTMLDivElement>) => void,
    onCancel: () => void,
};

const ItemMenu = ({ title, options, onSelect, onCancel }: Props) => {
    const { t } = useTranslation();
    const gamepad = useGamepad();
    const listRef = useRef<HTMLDivElement>(null);
    const cancelRef = useRef(onCancel);
    cancelRef.current = onCancel;

    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>('[tabindex]')?.focus();
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' || event.key === 'Backspace') {
                event.preventDefault();
                event.stopImmediatePropagation();
                cancelRef.current();
            }
        };
        window.addEventListener('keydown', onKeyDown, { capture: true });
        gamepad?.on('buttonB', GAMEPAD_ID, () => cancelRef.current());
        gamepad?.on('buttonY', GAMEPAD_ID, () => cancelRef.current()); // Y again toggles it shut
        return () => {
            window.removeEventListener('keydown', onKeyDown, { capture: true });
            gamepad?.off('buttonB', GAMEPAD_ID);
            gamepad?.off('buttonY', GAMEPAD_ID);
        };
    }, [gamepad]);

    return (
        <Modal className={styles['item-menu-modal']}>
            <div className={styles['item-menu']}>
                {
                    typeof title === 'string' && title.length > 0 ?
                        <div className={styles['title']}>{title}</div>
                        :
                        null
                }
                <div ref={listRef} className={styles['options']}>
                    {
                        options.map(({ label, value }) => (
                            <Button key={value} className={styles['option']} title={label} onClick={(event) => onSelect(value, event)}>
                                {label}
                            </Button>
                        ))
                    }
                    <Button className={styles['option']} title={t('BUTTON_CANCEL')} onClick={() => cancelRef.current()}>
                        {t('BUTTON_CANCEL')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ItemMenu;
