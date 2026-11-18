import Link from "next/link";
import { Container } from "@/components/ui/container";
import { EXTERNAL_REL } from "@/lib/utils";

const SOURCES = [
  { href: "https://www.artic.edu", label: "Art Institute of Chicago" },
  { href: "https://api.artic.edu/docs/", label: "API documentation" },
  { href: "https://www.artic.edu/image-licensing", label: "Image licensing" },
  { href: "https://www.artic.edu/terms", label: "Terms" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-deep text-ink">
      <Container className="grid gap-12 py-14 sm:py-16 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-16">
        <div className="max-w-md">
          <p className="font-serif text-2xl">Gallery Atlas</p>
          <p className="mt-4 text-sm leading-6 text-muted">
            This is an independent project and is not affiliated with the Art
            Institute of Chicago.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted">
            Image and artwork data courtesy of the Art Institute of Chicago.
            Only works marked public domain are shown.
          </p>
        </div>

        <div>
          <h2 className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            Source
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {SOURCES.map((source) => (
              <li key={source.href}>
                <a
                  href={source.href}
                  target="_blank"
                  rel={EXTERNAL_REL}
                  className="underline-offset-4 hover:underline"
                >
                  {source.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            Licensing
          </h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
            <li>Artwork metadata: CC0</li>
            <li>Artwork descriptions: CC BY 4.0</li>
            <li>
              Images: public-domain works only, under the museum&apos;s terms
            </li>
          </ul>
          <p className="mt-6 text-sm">
            <Link href="/about" className="underline-offset-4 hover:underline">
              About this project
            </Link>
          </p>
        </div>
      </Container>
    </footer>
  );
}
