"use client";

import { useEffect } from "react";

/** The opening curtain and the hero entrance after it are over by this point. */
const INTRO_MS = 3000;

/**
 * Page-wide motion: Lenis smooth scrolling for mouse wheels, and the flag that tells later
 * page visits not to wait for the opening curtain. Renders nothing.
 *
 * Lenis is downloaded only where it will run: a fine pointer, and a visitor who has not
 * asked for reduced motion. Both are followed live, so changing the system setting (or
 * plugging in a mouse) takes effect without a reload.
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
    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let disposed = false;
    let wanted = false;
    let lenis: { destroy(): void } | null = null;

    const sync = () => {
      wanted = finePointer.matches && !reducedMotion.matches;
      if (!wanted) {
        lenis?.destroy();
        lenis = null;
        return;
      }
      if (lenis) return;
      void import("lenis")
        .then(({ default: Lenis }) => {
          // The setting may have changed, or the page gone, while it downloaded.
          if (disposed || !wanted || lenis) return;
          lenis = new Lenis({
            autoRaf: true,
            anchors: true,
            // Follows `overflow: hidden` on <html>, which the zoom dialog sets while open.
            autoToggle: true,
            allowNestedScroll: true,
            stopInertiaOnNavigate: true,
            lerp: 0.11,
            // Modal dialogs and their contents scroll natively.
            prevent: (node) => node.closest("dialog") !== null,
          });
        })
        // Without it the page simply scrolls natively.
        .catch(() => {});
    };

    sync();
    finePointer.addEventListener("change", sync);
    reducedMotion.addEventListener("change", sync);

    return () => {
      disposed = true;
      window.clearTimeout(introTimer);
      finePointer.removeEventListener("change", sync);
      reducedMotion.removeEventListener("change", sync);
      lenis?.destroy();
      lenis = null;
    };
  }, []);

  return null;
}
