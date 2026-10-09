// Saga: product credits, the installed release version (from weebio-agent) and where the source lives.

import React, { forwardRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SagaMark from 'stremio/components/SagaMark';
import { Section } from '../components';
import styles from './About.less';

type Brand = {
    name: string,
    tagline: string,
    credits: string,
};

const brand: Brand = JSON.parse(process.env.BRAND ?? '{}');

const About = forwardRef<HTMLDivElement>((_, ref) => {
    const { t } = useTranslation();
    const [version, setVersion] = useState<string | null>(null);
    const [boxId, setBoxId] = useState<string | null>(null);

    useEffect(() => {
        fetch('/weebio/api/version')
            .then((response) => response.json())
            .then((body) => setVersion(body.version || null))
            .catch(() => setVersion(null));
        // The box's rune name (also its hostname), so a friend can read it out for troubleshooting.
        fetch('/weebio/api/box')
            .then((response) => response.json())
            .then((body) => setBoxId(body.rune || body.hostname || null))
            .catch(() => setBoxId(null));
    }, []);

    return (
        <Section ref={ref} label={'SAGA_ABOUT'}>
            <div className={styles['about']}>
                <SagaMark className={styles['mark']} />
                <div className={styles['tagline']}>{brand.tagline}</div>
                <div className={styles['credits']}>{brand.credits}</div>
                <div className={styles['details']}>
                    {boxId && <div>{t('SAGA_BOX_ID')}: {boxId}</div>}
                    <div>{t('SAGA_VERSION')}: {version ?? process.env.VERSION}</div>
                    <div title={process.env.COMMIT_HASH}>{t('SAGA_BUILD')}: {process.env.COMMIT_HASH?.slice(0, 7)}</div>
                </div>
            </div>
        </Section>
    );
});

export default About;
