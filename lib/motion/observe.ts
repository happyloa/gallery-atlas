/**
 * One shared IntersectionObserver for every scroll reveal on the page. Each element is
 * reported once, the first time it comes into view, and then forgotten.
 */

type Callback = () => void;

/** How much of an element has to be on screen before it is revealed. */
const VISIBLE_SHARE = 0.08;

const callbacks = new Map<Element, Callback>();
let observer: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        // A block taller than the screen is revealed as soon as it starts to come in:
        // it may be so tall that 8% of it never fits on screen, and waiting for that
        // would leave it hidden for good.
        const screen = entry.rootBounds?.height ?? window.innerHeight;
        const tall = entry.boundingClientRect.height > screen;
        if (!tall && entry.intersectionRatio < VISIBLE_SHARE) continue;
        const callback = callbacks.get(entry.target);
        observer?.unobserve(entry.target);
        callbacks.delete(entry.target);
        callback?.();
      }
    },
    // Reveal a little before the element is fully in, so nothing sits blank on screen.
    // The 0 threshold is what reports a tall block's first appearance.
    { rootMargin: "0px 0px -6% 0px", threshold: [0, VISIBLE_SHARE] },
  );
  return observer;
}

function prefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

/** Calls `onVisible` once `element` scrolls into view. Returns a cleanup function. */
export function observeOnce(element: Element, onVisible: Callback): () => void {
  if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) {
    onVisible();
    return () => {};
  }
  callbacks.set(element, onVisible);
  getObserver().observe(element);
  return () => {
    callbacks.delete(element);
    observer?.unobserve(element);
  };
}
