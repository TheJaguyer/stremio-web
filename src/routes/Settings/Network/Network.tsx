// Saga: shows the current Wi-Fi network (from weebio-agent) and opens the agent's setup page to change it.

import React, { forwardRef, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'stremio/components';
import { Option, Section } from '../components';
import styles from './Network.less';

type WifiNetwork = {
    ssid: string,
    active: boolean,
};

const Network = forwardRef<HTMLDivElement>((_, ref) => {
    const { t } = useTranslation();
    // undefined while loading, null when not on Wi-Fi
    const [ssid, setSsid] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        fetch('/weebio/api/wifi/networks')
            .then((response) => response.ok ? response.json() : [])
            .then((networks: WifiNetwork[]) => setSsid(networks.find((network) => network.active)?.ssid ?? null))
            .catch(() => setSsid(null));
    }, []);

    const openSetup = useCallback(() => {
        window.location.assign('/weebio/setup');
    }, []);

    return (
        <Section ref={ref} label={'SAGA_NETWORK'}>
            <Option label={'SAGA_WIFI'}>
                <div className={styles['wifi']}>
                    <div className={styles['ssid']}>
                        {ssid === undefined ? '…' : ssid ?? t('SAGA_WIFI_NOT_CONNECTED')}
                    </div>
                    <Button className={styles['button']} title={t('SAGA_WIFI_CHANGE')} onClick={openSetup}>
                        {t('SAGA_WIFI_CHANGE')}
                    </Button>
                </div>
            </Option>
        </Section>
    );
});

export default Network;
