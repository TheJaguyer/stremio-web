// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useTranslation } = require('react-i18next');
const { HorizontalNavBar } = require('stremio/components');
const styles = require('./styles');

const NotFound = () => {
    const { t } = useTranslation();
    return (
        <div className={styles['not-found-container']}>
            <HorizontalNavBar
                className={styles['nav-bar']}
                title={t('PAGE_NOT_FOUND')}
                backButton={true}
            />
            <div className={styles['not-found-content']}>
                <div className={styles['not-found-label']}>{t('PAGE_NOT_FOUND')}</div>
            </div>
        </div>
    );
};

module.exports = NotFound;
