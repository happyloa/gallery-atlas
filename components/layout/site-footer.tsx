import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { EXTERNAL_REL } from "@/lib/utils";

export function SiteFooter({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.footer;
  const sources = [
    { href: "https://www.artic.edu", label: t.museum },
    { href: "https://api.artic.edu/docs/", label: t.apiDocs },
    { href: "https://www.artic.edu/image-licensing", label: t.imageLicensing },
    { href: "https://www.artic.edu/terms", label: t.terms },
  ];

  return (
    <footer className="border-t border-line bg-paper-deep text-ink">
      <Container className="grid gap-12 py-14 sm:py-16 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-16">
        <div className="max-w-md">
          <p className="font-serif text-2xl">Gallery Atlas</p>
          <p className="mt-4 text-sm leading-6 text-muted">{t.disclaimer}</p>
          <p className="mt-3 text-sm leading-6 text-muted">{t.courtesy}</p>
        </div>

        <div>
          <h2 className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            {t.source}
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {sources.map((source) => (
              <li key={source.href}>
                <a
                  href={source.href}
                  target="_blank"
                  rel={EXTERNAL_REL}
                  className="underline-offset-4 hover:underline"
                >
                  {source.label}
                  <span className="sr-only">{dict.site.opensInNewTab}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            {t.licensing}
          </h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
            <li>{t.metadataLicense}</li>
            <li>{t.descriptionLicense}</li>
            <li>{t.imageLicense}</li>
            <li>{dict.nav.museumLicense}</li>
          </ul>
          <p className="mt-6 text-sm">
            <Link
              href={localizePath(locale, "/about")}
              className="underline-offset-4 hover:underline"
            >
              {t.aboutLink}
            </Link>
          </p>
          <p className="mt-2 text-sm">
            {/* A plain link: every visit should reach the server for a new pick. */}
            <a
              href={`/${locale}/random`}
              className="underline-offset-4 hover:underline"
            >
              {dict.site.random}
            </a>
          </p>
        </div>
      </Container>

      {/* The name set large along the bottom edge, like lettering on a gallery wall. */}
      <div aria-hidden="true" className="overflow-hidden">
        <Reveal>
          <p className="pb-[0.08em] text-center font-serif text-[clamp(3.5rem,17.2vw,15.5rem)] leading-[1.05] tracking-[-0.035em] whitespace-nowrap text-ink">
            Gallery Atlas
          </p>
        </Reveal>
      </div>
    </footer>
  );
}
