import Link from "next/link";
import type { CSSProperties } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { ArrowRight } from "@/components/ui/icons";
import { localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { splitWords } from "@/lib/text/split-words";

/**
 * The wall text between the room and the collection: one large sentence that brightens word
 * by word as it scrolls up the screen (styles in app/globals.css).
 */
export function Statement({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.statement;
  const segments = splitWords(t.body, locale);

  return (
    <section aria-labelledby="statement-heading" className="bg-paper">
      <Container className="grid gap-10 border-b border-line py-24 sm:py-32 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-16 lg:py-40">
        <Reveal>
          <h2
            id="statement-heading"
            className="text-xs font-medium tracking-[0.18em] text-accent uppercase lg:pt-4"
          >
            {t.eyebrow}
          </h2>
        </Reveal>
        <div>
          <p
            data-statement=""
            className="max-w-5xl font-serif text-[1.9rem] leading-[1.25] tracking-tight text-ink sm:text-[2.6rem] lg:text-[3.4rem] [html:lang(zh-Hant-TW)_&]:leading-[1.45] [html:lang(zh-Hant-TW)_&]:tracking-normal"
          >
            {segments.map((segment, index) =>
              segment.progress === null ? (
                segment.text
              ) : (
                <span
                  key={index}
                  data-word=""
                  style={{ "--progress": segment.progress } as CSSProperties}
                >
                  {segment.text}
                </span>
              ),
            )}
          </p>
          <Reveal className="mt-12">
            <Link
              href={localizePath(locale, "/about")}
              className="group inline-flex items-center gap-3 border-b border-ink/30 pb-1 text-sm transition-colors duration-300 ease-gallery hover:border-ink"
            >
              {t.link}
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-300 ease-gallery group-hover:translate-x-1"
              />
            </Link>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
