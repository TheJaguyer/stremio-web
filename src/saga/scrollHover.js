// Saga: while anything scrolls, mark the page so posters ignore the pointer (see MetaItem styles).
// Otherwise every poster passing under a still mouse re-renders its hover state (React) and starts a
// zoom transition, which makes scrolling stutter on the Pi. Hover works again ~150 ms after scrolling stops.

const IDLE_MS = 150;
const root = document.documentElement;
let timer = null;

// Scroll events don't bubble, so listen in the capture phase to catch every scrolling container.
document.addEventListener('scroll', () => {
    if (timer === null) {
        root.classList.add('saga-scrolling');
    } else {
        clearTimeout(timer);
    }
    timer = setTimeout(() => {
        root.classList.remove('saga-scrolling');
        timer = null;
    }, IDLE_MS);
}, { capture: true, passive: true });
