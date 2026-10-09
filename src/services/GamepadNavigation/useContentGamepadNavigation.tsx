// Copyright (C) 2017-2026 Smart code 203358507

import { useEffect, useRef } from 'react';
import { useGamepad } from '../GamepadContext';

const FOCUSABLE = '[tabindex]:not([data-focus-guard])';

type Direction = 'left' | 'right' | 'up' | 'down';

type Options = {
    // Saga: on the main screens (side tabs + search bar + content), move between the three areas only in
    // straight lines: tabs are left of the content, the search bar above it.
    regions?: boolean,
    // Saga: where to land when nothing is focused yet and a direction is pressed (e.g. the player's controls).
    entry?: (direction: Direction) => HTMLElement | null,
};

const getActiveScope = (fallback: HTMLDivElement | null): HTMLElement | null => {
    if (document.querySelector('[data-gamepad-modal]')) return null;

    const modals = document.querySelectorAll<HTMLElement>('.modals-container');
    for (const modal of modals) {
        if (modal.children.length > 0) return modal;
    }

    const dropdown = fallback?.querySelector<HTMLElement>('[class*="dropdown"][class*="open"]');
    if (dropdown) return dropdown;

    return fallback;
};

const isVisible = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
};

const focusablesIn = (root: Element | null | undefined) =>
    Array.from(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(isVisible);

// Saga: the nearest candidate in a direction. Candidates in line with the current element (same row for
// left/right, same column for up/down) come first, so moves stay straight instead of cutting diagonally.
const nearest = (from: HTMLElement, direction: Direction, candidates: HTMLElement[]): HTMLElement | null => {
    const cur = from.getBoundingClientRect();
    const cx = cur.left + cur.width / 2;
    const cy = cur.top + cur.height / 2;
    const horizontal = direction === 'left' || direction === 'right';

    const ahead = candidates.filter((el) => {
        if (el === from) return false;
        const r = el.getBoundingClientRect();
        const ex = r.left + r.width / 2;
        const ey = r.top + r.height / 2;
        return (direction === 'left' && ex < cx) ||
            (direction === 'right' && ex > cx) ||
            (direction === 'up' && ey < cy) ||
            (direction === 'down' && ey > cy);
    });
    const inLine = ahead.filter((el) => {
        const r = el.getBoundingClientRect();
        return horizontal ?
            r.top < cur.bottom - 1 && r.bottom > cur.top + 1 :
            r.left < cur.right - 1 && r.right > cur.left + 1;
    });

    let best: HTMLElement | null = null;
    let bestDistance = Infinity;
    for (const el of inLine.length > 0 ? inLine : ahead) {
        const r = el.getBoundingClientRect();
        const dx = Math.abs(r.left + r.width / 2 - cx);
        const dy = Math.abs(r.top + r.height / 2 - cy);
        const distance = horizontal ? dx + dy * 3 : dy + dx * 3;
        if (distance < bestDistance) {
            bestDistance = distance;
            best = el;
        }
    }
    return best;
};

// Saga: the scrolling area an element sits in (the board, a catalog grid, settings...), if any.
const scrollParent = (element: HTMLElement): HTMLElement | null => {
    for (let node = element.parentElement; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node);
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 10) return node; // (skips rows that only overflow sideways)
    }
    return null;
};

// Saga: focus an element; if it's in the first row of its scrolling area, scroll that area all the way to
// the top, so the row (and its title) isn't left partly cut off after coming back up from further down.
const focusAndReveal = (element: HTMLElement) => {
    element.focus();
    const scroller = scrollParent(element);
    if (!scroller || scroller.scrollTop === 0) return;
    const top = element.getBoundingClientRect().top;
    const rowTolerance = element.getBoundingClientRect().height / 2;
    const above = focusablesIn(scroller)
        .some((other) => other !== element && other.getBoundingClientRect().top < top - rowTolerance);
    if (!above) scroller.scrollTo({ top: 0, behavior: 'smooth' });
};

// Saga: the main screens' three areas.
const regionsOf = (screen: HTMLElement | null) => {
    const tabs = screen?.querySelector<HTMLElement>('[class*="vertical-nav-bar"]') ?? null;
    const content = screen?.querySelector<HTMLElement>('[class*="nav-content-container"]') ?? null;
    const search = screen?.querySelector<HTMLElement>('[class*="search-bar-container"]') ?? null;
    if (!tabs || !content) return null;
    const tabButtons = focusablesIn(tabs);
    return {
        tabs,
        content,
        search,
        tabButtons,
        currentTab: tabButtons.find((tab) => tab.classList.contains('selected')) ?? tabButtons[0] ?? null,
        homeTab: tabButtons[0] ?? null,
    };
};

// Saga: the content's top-left item (closest to the top-left corner, so a row's "See all" link on the
// far right doesn't win over the first poster just below it).
const firstContentItem = (content: HTMLElement | null) => {
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of focusablesIn(content)) {
        const r = el.getBoundingClientRect();
        const score = r.top + r.left;
        if (score < bestScore) {
            bestScore = score;
            best = el;
        }
    }
    return best;
};

// Saga: after picking a side tab, focus the top-left item of the screen it opens, once that has loaded
// (and settled, so a row appearing above a moment later doesn't leave focus further down).
const focusNewScreenContent = () => {
    const deadline = Date.now() + 6000;
    let candidate: HTMLElement | null = null;
    let stableFor = 0;
    const attempt = () => {
        const active = document.activeElement as HTMLElement | null;
        const waiting = !active || active === document.body || !!active.closest('[class*="vertical-nav-bar"]');
        if (!waiting) return; // the user has moved on
        const screens = document.querySelectorAll<HTMLElement>('.route-container');
        const content = screens[screens.length - 1]?.querySelector<HTMLElement>('[class*="nav-content-container"]');
        const first = firstContentItem(content ?? null);
        stableFor = first && first === candidate ? stableFor + 1 : 0;
        candidate = first;
        if (candidate && stableFor >= 3) {
            focusAndReveal(candidate);
        } else if (Date.now() < deadline) {
            setTimeout(attempt, 100);
        } else if (candidate) {
            focusAndReveal(candidate);
        }
    };
    setTimeout(attempt, 100);
};

const useContentGamepadNavigation = (
    sectionRef: React.RefObject<HTMLDivElement>,
    gamepadHandlerId: string,
    options: Options = {}
) => {
    const gamepad = useGamepad();
    const lastFocused = useRef<HTMLDivElement | null>(null);
    const wasInOverlay = useRef(false);
    const optionsRef = useRef(options);
    optionsRef.current = options;

    useEffect(() => {
        // Saga: tabs ← content → search bar above. Returns false when this isn't a main screen.
        const navigateRegions = (direction: Direction, active: HTMLElement | null): boolean => {
            const regions = regionsOf(sectionRef.current);
            if (!regions) return false;
            const { tabs, content, search, tabButtons, currentTab, homeTab } = regions;

            if (active && tabs.contains(active)) {
                if (direction === 'right') {
                    const first = firstContentItem(content);
                    if (first) focusAndReveal(first);
                } else if (direction === 'up' || direction === 'down') {
                    nearest(active, direction, tabButtons)?.focus();
                }
                return true;
            }

            if (active && search && search.contains(active)) {
                if (direction === 'down') {
                    const first = firstContentItem(content);
                    if (first) focusAndReveal(first);
                } else if (direction === 'left') {
                    homeTab?.focus();
                }
                return true;
            }

            if (active && content.contains(active)) {
                const target = nearest(active, direction, focusablesIn(content));
                if (target) {
                    focusAndReveal(target);
                } else if (direction === 'left') {
                    currentTab?.focus();
                } else if (direction === 'up') {
                    search?.focus();
                }
                return true;
            }

            // Nothing (or something outside the three areas) focused: start at the top-left of the content.
            const first = firstContentItem(content);
            if (first) {
                focusAndReveal(first);
            } else if (direction === 'left') {
                currentTab?.focus();
            }
            return true;
        };

        const handleGamepadNavigation = (data?: string) => {
            const direction = data as Direction;
            const scope = getActiveScope(sectionRef.current);
            const inOverlay = scope !== sectionRef.current;

            if (inOverlay && !wasInOverlay.current) {
                const focused = sectionRef.current?.querySelector<HTMLDivElement>(':focus');
                if (focused) lastFocused.current = focused;
            }
            wasInOverlay.current = inOverlay;

            const activeElement = (scope ?? document)?.querySelector<HTMLElement>(':focus') ?? null;

            if (!inOverlay && optionsRef.current.regions && navigateRegions(direction, activeElement)) return;

            const elements = focusablesIn(scope);
            if (elements.length === 0) return;

            if (!activeElement) {
                const entry = !inOverlay ? optionsRef.current.entry?.(direction) : null;
                (entry ?? elements[0]).focus();
                return;
            }

            const target = nearest(activeElement, direction, elements);
            if (target) {
                focusAndReveal(target);
            }
        };

        const onSelect = () => {
            const scope = getActiveScope(sectionRef.current);
            const inOverlay = scope !== sectionRef.current;

            if (inOverlay && !wasInOverlay.current) {
                const focused = sectionRef.current?.querySelector<HTMLDivElement>(':focus');
                if (focused) lastFocused.current = focused;
            }
            wasInOverlay.current = inOverlay;

            const elements = Array.from(
                scope?.querySelectorAll<HTMLDivElement>(FOCUSABLE) || []
            );
            if (elements.length === 0) {
                if (lastFocused.current) {
                    lastFocused.current.focus();
                    wasInOverlay.current = false;
                }
                return;
            }

            const activeElement = (scope ?? document)?.querySelector<HTMLDivElement>(':focus');

            if (!activeElement) {
                elements[0].focus();
                return;
            }
            const isSelect = Array.from(activeElement.classList).some((cls) => cls.startsWith('select-input'));
            if (!isSelect) {
                // Saga: picking a side tab moves focus into the screen it opens.
                const pickedTab = !inOverlay && optionsRef.current.regions && !!activeElement.closest('[class*="vertical-nav-bar"]');
                activeElement?.click();
                if (pickedTab) focusNewScreenContent();

                requestAnimationFrame(() => {
                    const stillInOverlay = getActiveScope(sectionRef.current) !== sectionRef.current;
                    if (!stillInOverlay && wasInOverlay.current && lastFocused.current) {
                        lastFocused.current.focus();
                        wasInOverlay.current = false;
                    }
                });
            }
        };

        gamepad?.on('analog', gamepadHandlerId, handleGamepadNavigation);
        gamepad?.on('buttonA', gamepadHandlerId, onSelect);

        return () => {
            gamepad?.off('analog', gamepadHandlerId);
            gamepad?.off('buttonA', gamepadHandlerId);
        };
    }, [gamepad, gamepadHandlerId, sectionRef]);
};

export default useContentGamepadNavigation;
