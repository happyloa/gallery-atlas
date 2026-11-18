import Link from "next/link";
import { ArtworkWall } from "@/components/artwork/artwork-wall";
import { Reveal } from "@/components/motion/reveal";
import { ArrowRight, Plus } from "@/components/ui/icons";
import { getMoreByArtist } from "@/lib/artic/artworks";
import type { TagKind } from "@/lib/artic/config";
import { searchHref } from "@/lib/artic/search-url";
import type { ArtworkDetail } from "@/lib/artwork/types";
import { localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";

const TAG_KINDS: TagKind[] = ["style", "subject", "theme"];

const tagChip =
  "inline-flex min-h-9 items-center rounded-full border border-ink/20 px-3 text-[0.8125rem] text-ink transition-colors duration-200 ease-gallery hover:border-ink hover:bg-ink hover:text-paper";

/** Whether the work is hanging in Chicago now. Renders nothing when the API doesn't say. */
export function OnView({
  artwork,
  dict,
}: {
  artwork: ArtworkDetail;
  dict: Dictionary;
}) {
  const t = dict.detail;
  return (
    <p className="mt-6 flex items-center gap-3 text-sm text-ink/80">
      <span
        aria-hidden="true"
        className={
          artwork.onView
            ? "size-2 rounded-full bg-[#4f7a4a] shadow-[0_0_0_4px_rgb(79_122_74/0.18)]"
            : "size-2 rounded-full border border-ink/40"
        }
      />
      {artwork.onView
        ? artwork.onView.gallery
          ? format(t.onViewGallery, { gallery: artwork.onView.gallery })
          : t.onView
        : t.notOnView}
    </p>
  );
}

/** Era, dominant colour and the museum's tags, each a way back into Explore. */
export function LookFurther({
  artwork,
  locale,
  dict,
}: {
  artwork: ArtworkDetail;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.detail;
  const groups = TAG_KINDS.filter((kind) => artwork.tags[kind].length > 0);
  const color = artwork.dominantColor;
  if (!artwork.era && !color && groups.length === 0) return null;

  return (
    <section aria-labelledby="look-further" className="mt-12">
      <h2
        id="look-further"
        className="text-xs font-medium tracking-[0.18em] text-accent uppercase"
      >
        {t.lookFurther}
      </h2>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        {color ? (
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="size-9 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]"
              style={{ backgroundColor: color.css }}
            />
            <div className="text-sm leading-5">
              <p className="text-muted">{t.colorHeading}</p>
              {color.slug ? (
                <Link
                  href={searchHref(locale, { color: color.slug })}
                  prefetch={false}
                  className="underline-offset-4 hover:underline"
                >
                  {format(t.moreInColor, { color: dict.colors[color.slug] })}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
        {artwork.era ? (
          <Link
            href={searchHref(locale, { era: artwork.era })}
            prefetch={false}
            className="group inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
          >
            {format(t.moreFromEra, { era: dict.eras[artwork.era] })}
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-200 ease-gallery group-hover:translate-x-0.5"
            />
          </Link>
        ) : null}
      </div>

      {groups.length > 0 ? (
        <dl className="mt-6 space-y-4">
          {groups.map((kind) => (
            <div key={kind} className="grid gap-2 sm:grid-cols-[5.5rem_1fr]">
              <dt className="pt-2 text-sm text-muted">{t.tagKinds[kind]}</dt>
              <dd>
                <ul className="flex flex-wrap gap-1.5">
                  {artwork.tags[kind].map((tag) => (
                    <li key={tag}>
                      <Link
                        href={searchHref(locale, { [kind]: tag })}
                        prefetch={false}
                        lang="en"
                        className={tagChip}
                      >
                        {tag}
                      </Link>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

/** Inscriptions, provenance and histories, folded away until opened. */
export function ObjectRecord({
  artwork,
  dict,
}: {
  artwork: ArtworkDetail;
  dict: Dictionary;
}) {
  const t = dict.detail;
  const sections = (
    ["inscriptions", "provenance", "exhibitions", "publications"] as const
  ).flatMap((key) => {
    const paragraphs = artwork.record[key];
    return paragraphs ? [{ key, paragraphs }] : [];
  });
  if (sections.length === 0) return null;

  return (
    <Reveal
      as="section"
      aria-labelledby="object-record"
      className="grid gap-6 border-t border-line pt-10 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-12"
    >
      <h2
        id="object-record"
        className="text-xs font-medium tracking-[0.18em] text-accent uppercase md:pt-5"
      >
        {t.recordHeading}
      </h2>
      <div className="max-w-3xl">
        {sections.map(({ key, paragraphs }) => (
          <details key={key} className="group border-b border-line">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-serif text-xl [&::-webkit-details-marker]:hidden">
              {t.record[key]}
              <Plus
                aria-hidden="true"
                className="size-4 shrink-0 transition-transform duration-300 ease-gallery group-open:rotate-45"
              />
            </summary>
            <div
              lang="en"
              className="space-y-2 pb-6 text-sm leading-6 whitespace-pre-line text-ink/85"
            >
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </details>
        ))}
        <p className="mt-6 text-xs text-muted">{t.recordCredit}</p>
      </div>
    </Reveal>
  );
}

/** Up to four more works by the same artist, and a link to all of them. */
export async function MoreByArtist({
  artwork,
  locale,
  dict,
}: {
  artwork: ArtworkDetail;
  locale: Locale;
  dict: Dictionary;
}) {
  if (artwork.artistId === null) return null;
  const { artworks, total } = await getMoreByArtist(
    artwork.artistId,
    artwork.id,
  );
  if (artworks.length === 0) return null;
  const t = dict.detail;

  return (
    <section aria-labelledby="more-by" className="border-t border-line pt-10">
      <Reveal className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="more-by" lang="en" className="font-serif text-3xl sm:text-4xl">
          {format(t.moreBy, { artist: artwork.artist })}
        </h2>
        {total > artworks.length ? (
          <Link
            href={localizePath(locale, `/artists/${artwork.artistId}`)}
            className="group inline-flex items-center gap-2 border-b border-ink/30 pb-1 text-sm transition-colors duration-300 ease-gallery hover:border-ink"
          >
            {format(t.allBy, { artist: artwork.artist })}
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-200 ease-gallery group-hover:translate-x-0.5"
            />
          </Link>
        ) : null}
      </Reveal>
      <ArtworkWall artworks={artworks} locale={locale} className="mt-12" />
    </section>
  );
}
