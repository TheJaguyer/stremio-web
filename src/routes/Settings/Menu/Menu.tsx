import React from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Button } from 'stremio/components';
import { SECTIONS } from '../constants';
import styles from './Menu.less';

type Props = {
    selected: string,
    onSelect: (event: React.MouseEvent<HTMLDivElement>) => void,
};

// Saga: one entry per section; versions and credits live in the About section.
const ENTRIES = [
    { id: SECTIONS.APPEARANCE, label: 'SAGA_APPEARANCE' },
    { id: SECTIONS.PLAYBACK, label: 'SAGA_PLAYBACK' },
    { id: SECTIONS.NETWORK, label: 'SAGA_NETWORK' },
    { id: SECTIONS.ABOUT, label: 'SAGA_ABOUT' },
];

const Menu = ({ selected, onSelect }: Props) => {
    const { t } = useTranslation();

    return (
        <div className={styles['menu']}>
            {
                ENTRIES.map(({ id, label }) => (
                    <Button key={id} className={classNames(styles['button'], { [styles['selected']]: selected === id })} title={t(label)} data-section={id} onClick={onSelect}>
                        { t(label) }
                    </Button>
                ))
            }
        </div>
    );
};

export default Menu;
