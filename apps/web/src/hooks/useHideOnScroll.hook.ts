'use client';

import { useEffect, useState } from 'react';

/** Scrolling this far down (px) before hiding, so small jitters never hide the header. */
const HIDE_AFTER = 64;
/** Scrolling up at least this much (px) shows it again. */
const SHOW_AFTER_UP = 4;

/**
 * Whether a sticky header should be hidden: it hides while the page scrolls down past the top
 * and comes back as soon as the user scrolls up, like most sites do. Always visible when `pinned`.
 */
export default function useHideOnScroll(pinned = false): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect((): (() => void) => {
    let lastY = window.scrollY;
    let frame = 0;

    function update(): void {
      frame = 0;
      const currentY = window.scrollY;
      if (currentY <= HIDE_AFTER) {
        setHidden(false);
      } else if (currentY > lastY) {
        setHidden(true);
      } else if (lastY - currentY >= SHOW_AFTER_UP) {
        setHidden(false);
      }
      lastY = currentY;
    }

    function onScroll(): void {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return (): void => {
      window.removeEventListener('scroll', onScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return hidden && !pinned;
}
