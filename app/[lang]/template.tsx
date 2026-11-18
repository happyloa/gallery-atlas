/**
 * Re-mounted on every navigation, so each new page fades in. Opacity only: a transform here
 * would become the containing block for fixed-position descendants while it runs.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="motion-safe:animate-page-in">{children}</div>;
}
