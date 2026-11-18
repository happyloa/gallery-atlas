/**
 * The opening curtain on a full page load: the wordmark is drawn on a paper panel, then the
 * panel lifts away with a darker one close behind, like a curtain going up on the room.
 *
 * Pure CSS, so it plays before hydration and needs no state. It never takes clicks, is
 * hidden from assistive technology, and is skipped for visitors who prefer reduced motion.
 * The layout renders it once; client-side navigations do not replay it.
 */
export function IntroCurtain() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] animate-[intro-gone_0.01ms_linear_1.9s_forwards] motion-reduce:hidden"
    >
      <div className="absolute inset-0 animate-[intro-lift_0.95s_var(--ease-curtain)_0.95s_both] bg-gallery-soft" />
      <div className="absolute inset-0 flex animate-[intro-lift_0.95s_var(--ease-curtain)_0.8s_both] items-center justify-center bg-paper">
        <div className="flex flex-col items-center">
          <p className="animate-rise font-serif text-4xl tracking-tight text-ink sm:text-5xl">
            Gallery Atlas
          </p>
          <span className="mt-5 block h-px w-40 origin-left animate-[intro-line_0.7s_var(--ease-curtain)_0.15s_both] bg-ink/60" />
        </div>
      </div>
    </div>
  );
}
