// Copyright (C) 2017-2026 Smart code 203358507

import { useEffect } from 'react';
import { useGamepad } from '../GamepadContext';

const useHorizontalNavGamepadNavigation = (gamepadHandlerId: string, onGoBack?: () => void) => {
    const gamepad = useGamepad();

    useEffect(() => {
        const goBack = () => onGoBack?.();

        // Saga: no fullscreen toggle on Y (the box is always fullscreen); Y opens a poster's menu instead.
        // Only claim B when there is a back button; otherwise a no-op here would override the
        // default "B = back" handler (most recently registered handler wins).
        if (onGoBack) gamepad?.on('buttonB', gamepadHandlerId, goBack);

        return () => {
            gamepad?.off('buttonB', gamepadHandlerId);
        };
    }, [gamepad, gamepadHandlerId, onGoBack]);
};

export default useHorizontalNavGamepadNavigation;
