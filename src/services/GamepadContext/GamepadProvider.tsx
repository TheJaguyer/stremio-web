// Copyright (C) 2017-2026 Smart code 203358507

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useToast from 'stremio/common/Toast/useToast';
import GamepadContext from './GamepadContext';
import type { ControllerType } from './GamepadContext';

type GamepadEventHandlers = Map<string, Map<string, (data?: string) => void>>;

type GamepadProviderProps = {
    enabled: boolean;
    onGuide?: () => void;
    children: React.ReactNode;
};

const detectControllerType = (gamepad: Gamepad): ControllerType => {
    const id = gamepad.id.toLowerCase();
    // Sony vendor id 054c — DualShock / DualSense / generic PlayStation
    if (/sony|playstation|dualsense|dualshock|054c/.test(id)) return 'playstation';
    // Microsoft vendor id 045e — Xbox / XInput
    if (/xbox|microsoft|xinput|045e/.test(id)) return 'xbox';
    // Browser "Standard Gamepad" mapping mirrors the Xbox layout
    if (gamepad.mapping === 'standard') return 'xbox';
    return 'generic';
};

// Saga: D-pad direction from the standard mapping (buttons 12-15). Controllers the browser doesn't know
// report the D-pad as a "hat" on axes 6/7 instead (Linux ABS_HAT0X/Y), so read those as well.
type Direction = 'up' | 'down' | 'left' | 'right';
const DPAD_REPEAT_DELAY = 400; // ms held before repeating
const DPAD_REPEAT_EVERY = 150;
const dpadDirection = (gamepad: Gamepad): Direction | null => {
    const pressed = (i: number) => !!gamepad.buttons[i]?.pressed;
    if (pressed(12)) return 'up';
    if (pressed(13)) return 'down';
    if (pressed(14)) return 'left';
    if (pressed(15)) return 'right';
    if (gamepad.mapping !== 'standard' && gamepad.axes.length >= 8) {
        const [x, y] = [gamepad.axes[6], gamepad.axes[7]];
        if (y < -0.5) return 'up';
        if (y > 0.5) return 'down';
        if (x < -0.5) return 'left';
        if (x > 0.5) return 'right';
    }
    return null;
};

// Saga: ask the focused poster (if any) to open its options menu.
const openItemMenu = () => {
    document.activeElement?.dispatchEvent(new CustomEvent('saga-item-menu', { bubbles: true }));
};

const GamepadProvider = ({ enabled, onGuide, children }: GamepadProviderProps) => {
    const { t } = useTranslation();
    const toast = useToast();
    const connectedGamepads = useRef<number>(0);
    const lastButtonState = useRef<number[]>([]);
    const lastButtonPressedTime = useRef<number>(0);
    const axisTimer = useRef<number>(0);
    const axisTimerRight = useRef<number>(0);
    const dpadHeld = useRef<({ direction: Direction, next: number } | null)[]>([]);
    // Saga: B means "back" wherever a screen hasn't claimed it (e.g. the main tabs and Search): it leaves a
    // text field first, then goes back a screen. Seeded here, before any screen registers, because the
    // most recently registered handler for an event wins; screens with their own B action still override it.
    const eventHandlers = useRef<GamepadEventHandlers>(new Map([
        ['buttonB', new Map([['saga-default-back', () => {
            const active = document.activeElement as HTMLElement | null;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
                active.blur();
            } else if (window.location.hash !== '#/' && window.location.hash !== '') {
                window.history.back();
            }
        }]])],
        // Saga: Y opens the focused poster's options menu (MetaItem listens for this event).
        ['buttonY', new Map([['saga-item-menu', openItemMenu]])],
    ]));
    const lockPrefix = useRef<string | null>(null);
    const [controllerType, setControllerType] = useState<ControllerType>('generic');

    const on = useCallback((event: string, id: string, callback: (data?: string) => void) => {
        if (!eventHandlers.current.has(event)) {
            eventHandlers.current.set(event, new Map());
        }

        const handlers = eventHandlers.current.get(event)!;

        // Ensure only one handler per component
        handlers.set(id, callback);
    }, []);

    const off = useCallback((event: string, id: string) => {
        const handlersMap = eventHandlers.current.get(event);
        handlersMap?.delete(id);
        if (handlersMap?.size === 0) {
            eventHandlers.current.delete(event);
        }
    }, []);

    const lock = useCallback((prefix: string) => {
        lockPrefix.current = prefix;
    }, []);

    const unlock = useCallback(() => {
        lockPrefix.current = null;
    }, []);

    const emit = (event: string, data?: string) => {
        // Saga: in the player, B is the remote's Back: it closes an open menu, otherwise leaves the player.
        // Sent as Escape so both inputs share the player's own exit handling.
        if (event === 'buttonB' && window.location.hash.startsWith('#/player')) {
            document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
            return;
        }
        if (eventHandlers.current.has(event)) {
            const handlersMap = eventHandlers.current.get(event)!;

            if (!handlersMap || handlersMap.size === 0) return;

            if (lockPrefix.current) {
                const matching = Array.from(handlersMap.entries())
                    .filter(([id]) => id.startsWith(lockPrefix.current!));
                if (matching.length > 0) {
                    matching[matching.length - 1][1](data);
                }
                return;
            }

            const latestHandler = Array.from(handlersMap.values()).slice(-1)[0];
            if (latestHandler) {
                latestHandler(data);
            }
        }
    };

    const onGamepadConnected = useCallback((e: GamepadEvent) => {
        setControllerType(detectControllerType(e.gamepad));
        // @ts-expect-error show() expects no arguments
        toast.show({
            type: 'info',
            title: t('GAMEPAD_CONNECTED'),
            timeout: 4000,
        });
    }, [toast, t]);

    const onGamepadDisconnected = useCallback(() => {
        const remaining = Array.from(navigator.getGamepads()).filter(
            (gp) => gp !== null
        ) as Gamepad[];
        setControllerType(remaining.length > 0 ? detectControllerType(remaining[0]) : 'generic');
        // @ts-expect-error show() expects no arguments
        toast.show({
            type: 'info',
            title: t('GAMEPAD_DISCONNECTED'),
            timeout: 4000,
        });
    }, [toast, t]);

    useEffect(() => {
        if (!enabled) return;

        if (typeof navigator.getGamepads === 'function') {
            const existing = Array.from(navigator.getGamepads()).filter(
                (gp) => gp !== null
            ) as Gamepad[];
            if (existing.length > 0) {
                setControllerType(detectControllerType(existing[0]));
            }
        }

        window.addEventListener('gamepadconnected', onGamepadConnected);
        window.addEventListener('gamepaddisconnected', onGamepadDisconnected);

        return () => {
            window.removeEventListener('gamepadconnected', onGamepadConnected);
            window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
        };
    }, [enabled, onGamepadConnected, onGamepadDisconnected]);

    useEffect(() => {
        if (onGuide) {
            on('buttonX', 'guide', onGuide);
        }
        return () => {
            off('buttonX', 'guide');
        };
    }, [onGuide]);

    useEffect(() => {
        if (!enabled || typeof navigator.getGamepads !== 'function') return;

        let animationFrameId: number;

        const updateStatus = () => {
            if (document.hasFocus()) {
                const currentTime = Date.now();
                const controllers = Array.from(navigator.getGamepads()).filter(
                    (gp) => gp !== null
                ) as Gamepad[];

                connectedGamepads.current = controllers.length;

                controllers.forEach((controller, index) => {
                    const buttonsState = controller.buttons.reduce(
                        (buttons, button, i) => buttons | (button.pressed ? 1 << i : 0),
                        0
                    );

                    const processButton =
                        currentTime - lastButtonPressedTime.current > 250;
                    if (
                        lastButtonState.current[index] !== buttonsState ||
                        processButton
                    ) {
                        lastButtonPressedTime.current = currentTime;
                        lastButtonState.current[index] = buttonsState;

                        if (buttonsState & (1 << 0)) emit('buttonA');
                        if (buttonsState & (1 << 1)) emit('buttonB');
                        if (buttonsState & (1 << 2)) emit('buttonX');
                        if (buttonsState & (1 << 3)) emit('buttonY');
                        if (buttonsState & (1 << 4)) emit('buttonLT');
                        if (buttonsState & (1 << 5)) emit('buttonRT');
                    }

                    // Saga: the D-pad navigates exactly like the left stick: one step per press, and holding it
                    // repeats (after a short pause, so a tap never moves twice).
                    const dpad = dpadDirection(controller);
                    const held = dpadHeld.current[index];
                    if (!dpad) {
                        dpadHeld.current[index] = null;
                    } else if (!held || held.direction !== dpad) {
                        dpadHeld.current[index] = { direction: dpad, next: currentTime + DPAD_REPEAT_DELAY };
                        emit('analog', dpad);
                    } else if (currentTime >= held.next) {
                        held.next = currentTime + DPAD_REPEAT_EVERY;
                        emit('analog', dpad);
                    }

                    const deadZone = 0.05;
                    const maxSpeed = 100;
                    let axisHandled = false;

                    if (controller.axes[0] < -deadZone) {
                        if (
                            currentTime - axisTimer.current >
                            maxSpeed + (2000 - Math.abs(controller.axes[0]) * 2000)
                        ) {
                            emit('analog', 'left');
                            axisHandled = true;
                        }
                    }
                    if (controller.axes[0] > deadZone) {
                        if (
                            currentTime - axisTimer.current >
                            maxSpeed + (2000 - Math.abs(controller.axes[0]) * 2000)
                        ) {
                            emit('analog', 'right');
                            axisHandled = true;
                        }
                    }
                    if (controller.axes[1] < -deadZone) {
                        if (
                            currentTime - axisTimer.current >
                            maxSpeed + (2000 - Math.abs(controller.axes[1]) * 2000)
                        ) {
                            emit('analog', 'up');
                            axisHandled = true;
                        }
                    }
                    if (controller.axes[1] > deadZone) {
                        if (
                            currentTime - axisTimer.current >
                            maxSpeed + (2000 - Math.abs(controller.axes[1]) * 2000)
                        ) {
                            emit('analog', 'down');
                            axisHandled = true;
                        }
                    }

                    if (axisHandled) axisTimer.current = currentTime;

                    let rightAxisHandled = false;

                    if (controller.axes.length > 2) {
                        if (controller.axes[2] < -deadZone) {
                            if (currentTime - axisTimerRight.current > maxSpeed + (2000 - Math.abs(controller.axes[2]) * 2000)) {
                                emit('analogRight', 'left');
                                rightAxisHandled = true;
                            }
                        }
                        if (controller.axes[2] > deadZone) {
                            if (currentTime - axisTimerRight.current > maxSpeed + (2000 - Math.abs(controller.axes[2]) * 2000)) {
                                emit('analogRight', 'right');
                                rightAxisHandled = true;
                            }
                        }
                        if (controller.axes[3] < -deadZone) {
                            if (currentTime - axisTimerRight.current > maxSpeed + (2000 - Math.abs(controller.axes[3]) * 2000)) {
                                emit('analogRight', 'up');
                                rightAxisHandled = true;
                            }
                        }
                        if (controller.axes[3] > deadZone) {
                            if (currentTime - axisTimerRight.current > maxSpeed + (2000 - Math.abs(controller.axes[3]) * 2000)) {
                                emit('analogRight', 'down');
                                rightAxisHandled = true;
                            }
                        }
                    }

                    if (rightAxisHandled) axisTimerRight.current = currentTime;
                });
            }
            animationFrameId = requestAnimationFrame(updateStatus);
        };

        animationFrameId = requestAnimationFrame(updateStatus);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [enabled]);

    // Saga: TV remotes (HDMI-CEC buttons, mapped to keys on the box) and keyboards drive the same spatial
    // navigation as a gamepad: arrows move focus, Enter selects, Escape goes back. In the player, arrows
    // keep seeking unless a control has focus; up/down move onto the controls; Enter plays/pauses;
    // Escape is left to the player (close a menu, else leave the player).
    useEffect(() => {
        if (!enabled) return;

        const DIRECTIONS: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
        const isTyping = (element: Element | null) => !!element &&
            (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || (element as HTMLElement).isContentEditable);
        const focusedControl = () => document.activeElement && document.activeElement !== document.body ?
            document.activeElement as HTMLElement : null;
        const menuOpen = () => !!document.querySelector('.modals-container > *, [class*="dropdown"][class*="open"]');
        const consume = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopImmediatePropagation();
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            const direction = DIRECTIONS[event.key];
            const control = focusedControl();
            const typing = isTyping(control);

            if (window.location.hash.startsWith('#/player')) {
                if (direction === 'up' || direction === 'down' || (direction && control)) {
                    consume(event);
                    emit('analog', direction);
                } else if (event.key === 'Enter') {
                    consume(event);
                    emit(control ? 'buttonA' : 'buttonX');
                }
                // Otherwise Stremio's player shortcuts apply: left/right seek, Space, Escape exits.
                return;
            }

            if (direction) {
                if (typing && (direction === 'left' || direction === 'right')) return; // move the text caret
                consume(event);
                emit('analog', direction);
            } else if (event.key === 'Enter' && !typing) {
                consume(event);
                emit('buttonA');
            } else if (event.key === 'ContextMenu' && !typing) {
                consume(event);
                emit('buttonY');
            } else if (event.key === 'Escape') {
                if (typing) {
                    consume(event);
                    control?.blur();
                } else if (!menuOpen()) { // open menus and dialogs close themselves on Escape
                    consume(event);
                    if (window.location.hash !== '#/' && window.location.hash !== '') window.history.back();
                }
            }
        };

        window.addEventListener('keydown', onKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
    }, [enabled]);

    return (
        <GamepadContext.Provider value={{ on, off, lock, unlock, controllerType }}>
            {children}
        </GamepadContext.Provider>
    );
};

export default GamepadProvider;
