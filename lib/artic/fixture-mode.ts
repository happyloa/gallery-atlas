/**
 * Whether museum API calls are answered from local fixtures (see dev-fixtures.ts). Kept in
 * its own file so the client can ask without importing the fixtures themselves: they are
 * loaded on demand, and a production Worker never loads them.
 */

/** Fixture mode is opt-in and never available in a production build. */
export function isFixtureMode(): boolean {
  if (typeof process === "undefined") return false;
  return (
    process.env.AIC_FIXTURES === "1" && process.env.NODE_ENV !== "production"
  );
}
