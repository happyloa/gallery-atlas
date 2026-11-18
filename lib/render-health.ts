/**
 * Lets the museum API client say that a page is being rendered from incomplete data, so the
 * Worker does not keep that page in its edge cache. Imports nothing: the client also reaches
 * the browser bundle.
 */
const LISTENER: unique symbol = Symbol.for("gallery-atlas.upstream-failure");

type ListenerHolder = { [LISTENER]?: () => void };

export function reportUpstreamFailure(): void {
  (globalThis as ListenerHolder)[LISTENER]?.();
}

export function onUpstreamFailure(listener: () => void): void {
  (globalThis as ListenerHolder)[LISTENER] = listener;
}
