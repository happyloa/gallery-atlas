"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/** The opening curtain and the hero entrance after it are over by this point. */
const INTRO_MS = 3000;

/**
 * Page-wide motion: Lenis smooth scrolling for mouse wheels, and the flag that tells later
 * page visits not to wait for the opening curtain. Renders nothing.
 */
export function MotionProvider() {
  useEffect(() => {
    const root = document.documentElement;
    const introTimer = window.setTimeout(
      () => {
        root.dataset.introDone = "true";
      },
      Math.max(0, INTRO_MS - performance.now()),
    );

    // Touch scrolling is already smooth; only wheel and trackpad input is eased.
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const lenis = finePointer
      ? new Lenis({
          autoRaf: true,
          anchors: true,
          // Follows `overflow: hidden` on <html>, which the zoom dialog sets while open.
          autoToggle: true,
          allowNestedScroll: true,
          stopInertiaOnNavigate: true,
          lerp: 0.11,
          // Modal dialogs and their contents scroll natively.
          prevent: (node) => node.closest("dialog") !== null,
        })
      : null;

    return () => {
      window.clearTimeout(introTimer);
      lenis?.destroy();
    };
  }, []);

  return null;
}
