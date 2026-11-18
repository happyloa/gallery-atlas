/**
 * One shared IntersectionObserver for every scroll reveal on the page. Each element is
 * reported once, the first time it comes into view, and then forgotten.
 */

type Callback = () => void;

const callbacks = new Map<Element, Callback>();
let observer: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const callback = callbacks.get(entry.target);
        observer?.unobserve(entry.target);
        callbacks.delete(entry.target);
        callback?.();
      }
    },
    // Reveal a little before the element is fully in, so nothing sits blank on screen.
    { rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
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
