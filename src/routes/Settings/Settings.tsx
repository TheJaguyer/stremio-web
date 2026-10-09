// Copyright (C) 2017-2023 Smart code 203358507

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import throttle from 'lodash.throttle';
import { useProfile, useRouteFocused, withCoreSuspender } from 'stremio/common';
import { MainNavBars } from 'stremio/components';
import { SECTIONS } from './constants';
import Menu from './Menu';
import Appearance from './Appearance';
import Playback from './Playback';
import Network from './Network';
import About from './About';
import styles from './Settings.less';

// Saga: four sections for a TV box (Stremio's account, streaming-server and shortcut settings removed).
const Settings = () => {
    const routeFocused = useRouteFocused();
    const profile = useProfile();

    const sectionsContainerRef = useRef<HTMLDivElement>(null);
    const appearanceSectionRef = useRef<HTMLDivElement>(null);
    const playbackSectionRef = useRef<HTMLDivElement>(null);
    const networkSectionRef = useRef<HTMLDivElement>(null);
    const aboutSectionRef = useRef<HTMLDivElement>(null);

    const sections = useMemo(() => ([
        { ref: appearanceSectionRef, id: SECTIONS.APPEARANCE },
        { ref: playbackSectionRef, id: SECTIONS.PLAYBACK },
        { ref: networkSectionRef, id: SECTIONS.NETWORK },
        { ref: aboutSectionRef, id: SECTIONS.ABOUT },
    ]), []);

    const [selectedSectionId, setSelectedSectionId] = useState(SECTIONS.APPEARANCE);

    const updateSelectedSectionId = useCallback(() => {
        const container = sectionsContainerRef.current;
        if (!container) return;

        const availableSections = sections.filter((section) => section.ref.current);
        if (!availableSections.length) return;

        const { scrollTop, clientHeight, scrollHeight, offsetTop } = container;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;

        if (isAtBottom) {
            setSelectedSectionId(availableSections[availableSections.length - 1].id);
            return;
        }

        const marker = scrollTop + 50;
        const activeSection = availableSections.reduce((current, section) => {
            const sectionTop = section.ref.current!.offsetTop + offsetTop;
            return sectionTop <= marker ? section : current;
        }, availableSections[0]);

        setSelectedSectionId(activeSection.id);
    }, [sections]);

    const onMenuSelect = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        const section = sections.find((section) => {
            return section.id === event.currentTarget.dataset.section;
        });

        const container = sectionsContainerRef.current;
        section && container?.scrollTo({
            top: section.ref.current!.offsetTop - container!.offsetTop,
            behavior: 'smooth'
        });
    }, [sections]);

    const onContainerScroll = useCallback(throttle(() => {
        updateSelectedSectionId();
    }, 50), []);

    useLayoutEffect(() => {
        if (routeFocused) {
            updateSelectedSectionId();
        }
    }, [routeFocused]);

    return (
        <MainNavBars className={styles['settings-container']} route={'settings'}>
            <div className={classnames(styles['settings-content'], 'animation-fade-in')}>
                <Menu
                    selected={selectedSectionId}
                    onSelect={onMenuSelect}
                />

                <div ref={sectionsContainerRef} className={styles['sections-container']} onScroll={onContainerScroll}>
                    <Appearance ref={appearanceSectionRef} profile={profile} />
                    <Playback ref={playbackSectionRef} profile={profile} />
                    <Network ref={networkSectionRef} />
                    <About ref={aboutSectionRef} />
                </div>
            </div>
        </MainNavBars>
    );
};

const SettingsFallback = () => (
    <MainNavBars className={styles['settings-container']} route={'settings'} />
);

export default withCoreSuspender(Settings, SettingsFallback);
