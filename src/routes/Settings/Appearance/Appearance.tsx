// Saga: theme, interface language/size and spoiler blurring (from Stremio's Interface section,
// minus the desktop-only options).

import React, { forwardRef } from 'react';
import { Scale, MultiselectMenu, Toggle } from 'stremio/components';
import { Section, Option } from '../components';
import useInterfaceOptions from '../Interface/useInterfaceOptions';
import ThemePicker from './ThemePicker';

type Props = {
    profile: Profile,
};

const Appearance = forwardRef<HTMLDivElement, Props>(({ profile }: Props, ref) => {
    const {
        interfaceLanguageSelect,
        interfaceSize,
        hideSpoilersToggle,
    } = useInterfaceOptions(profile);

    return (
        <Section ref={ref} label={'SAGA_APPEARANCE'}>
            <Option label={'SAGA_THEME'}>
                <ThemePicker />
            </Option>
            <Option label={'SETTINGS_UI_LANGUAGE'}>
                <MultiselectMenu
                    className={'multiselect'}
                    {...interfaceLanguageSelect}
                />
            </Option>
            <Option label={'SETTINGS_UI_ZOOM'}>
                <Scale {...interfaceSize} />
            </Option>
            <Option label={'SETTINGS_BLUR_UNWATCHED_IMAGE'}>
                <Toggle
                    tabIndex={-1}
                    {...hideSpoilersToggle}
                />
            </Option>
        </Section>
    );
});

export default Appearance;
