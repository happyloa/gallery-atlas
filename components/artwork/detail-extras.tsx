import Link from "next/link";
import { ArtworkWall } from "@/components/artwork/artwork-wall";
import { Credit } from "@/components/library/parts";
import { Reveal } from "@/components/motion/reveal";
import { ArrowRight, ArrowUpRight, Plus } from "@/components/ui/icons";
import { getMoreByArtist } from "@/lib/artic/artworks";
import { UNKNOWN_ARTIST } from "@/lib/artic/mapper";
import { Transcript } from "@/components/tours/transcript";
import { getFurtherReading, getSounds } from "@/lib/artic/museum";
import { getArtworkAudio } from "@/lib/artic/tours";
import { placeByKey } from "@/lib/geo/places";
import { EXTERNAL_REL } from "@/lib/utils";
import type { TagKind } from "@/lib/artic/config";
import { searchHref } from "@/lib/artic/search-url";
import type { ArtworkDetail } from "@/lib/artwork/types";
import { localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";

const TAG_KINDS: TagKind[] = ["style", "subject", "theme"];

/** Drawn 36px tall; the ::after reaches 4px past it above and below, for a 44px target. */
const tagChip =
  "relative inline-flex min-h-9 items-center rounded-full border border-ink/20 px-3 text-[0.8125rem] text-ink transition-colors duration-200 ease-gallery after:absolute after:inset-x-0 after:-inset-y-1 hover:border-ink hover:bg-ink hover:text-paper";

/** Whether the work is hanging in Chicago now. Renders nothing when the API doesn't say. */
export function OnView({
  artwork,
  locale,
  dict,
}: {
  artwork: ArtworkDetail;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.detail;
  const gallery = artwork.onView?.gallery;
  const galleryId = artwork.onView?.galleryId;
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
      {artwork.onView ? (
        gallery ? (
          <span>
            {t.onViewGallery.split("{gallery}").flatMap((part, index) =>
              index === 0
                ? [part]
                : [
                    galleryId ? (
                      <Link
                        key="gallery"
                        href={localizePath(locale, `/galleries/${galleryId}`)}
                        className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
                      >
                        {gallery}
                      </Link>
                    ) : (
                      gallery
                    ),
                    part,
                  ],
            )}
          </span>
        ) : (
          t.onView
        )
      ) : (
        t.notOnView
      )}
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
  if (!artwork.era && !artwork.origin && !color && groups.length === 0)
    return null;

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
        {artwork.origin ? (
          <Link
            href={searchHref(locale, { place: artwork.origin })}
            prefetch={false}
            className="group inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
          >
            {format(t.moreFromPlace, {
              place:
                placeByKey(artwork.origin)?.[locale === "en" ? "en" : "zh"] ??
                artwork.origin,
            })}
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-200 ease-gallery group-hover:translate-x-0.5"
            />
          </Link>
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
                <ul className="flex flex-wrap gap-x-1.5 gap-y-2">
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

/** The museum's recordings of this work, with transcripts, and the tours it is part of. */
export async function AudioGuide({
  artwork,
  locale,
  dict,
}: {
  artwork: ArtworkDetail;
  locale: Locale;
  dict: Dictionary;
}) {
  const [guide, sounds] = await Promise.all([
    getArtworkAudio(artwork.id),
    getSounds(artwork.soundIds),
  ]);
  // Numbered stops in the older list are the same recordings as the guide's.
  const talks =
    guide.recordings.length > 0
      ? sounds.filter((s) => s.stop === null)
      : sounds;
  if (
    guide.recordings.length === 0 &&
    talks.length === 0 &&
    guide.tours.length === 0
  )
    return null;
  const t = dict.detail;
  const zh = locale === "zh-tw";

  return (
    <section aria-labelledby="listen" className="mt-12">
      <h2
        id="listen"
        className="text-xs font-medium tracking-[0.18em] text-accent uppercase"
      >
        {t.listen}
      </h2>
      <ul className="mt-4 space-y-6">
        {guide.recordings.map((recording) => {
          const mandarin = zh && Boolean(recording.zhSrc);
          const label =
            (mandarin && recording.zhTitle) || recording.title || artwork.title;
          return (
            <li key={recording.soundId}>
              <p
                lang={mandarin ? undefined : "en"}
                className="text-sm text-ink/85"
              >
                {label}
              </p>
              {/* The transcript follows in the disclosure below. */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                controls
                preload="none"
                src={
                  (mandarin ? recording.zhSrc : recording.src) ??
                  recording.zhSrc ??
                  undefined
                }
                aria-label={label}
                className="mt-2 h-10 w-full"
              />
              <Transcript
                soundId={recording.soundId}
                transcript={recording.transcript}
                chinese={mandarin}
              />
            </li>
          );
        })}
        {talks.map((sound) => {
          const label =
            sound.stop !== null
              ? format(t.audioStop, { stop: sound.stop })
              : sound.title;
          return (
            <li key={sound.id}>
              <p
                lang={sound.stop !== null ? undefined : "en"}
                className="text-sm text-ink/85"
              >
                {label}
              </p>
              {/* Talks stream from artic.edu when played; the museum has no transcript for them. */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                controls
                preload="none"
                src={sound.src}
                aria-label={label}
                className="mt-2 h-10 w-full"
              />
            </li>
          );
        })}
      </ul>
      {guide.tours.length > 0 ? (
        <p className="mt-5 text-sm">
          <span className="text-muted">
            {dict.tours.onTours}
            {dict.common.colon}
          </span>
          {guide.tours.map((tour, index) => (
            <span key={tour.id}>
              {index > 0 ? dict.common.listSeparator : null}
              <Link
                href={localizePath(locale, `/tours/${tour.id}`)}
                lang={zh && tour.zhTitle ? undefined : "en"}
                className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
              >
                {(zh && tour.zhTitle) || tour.title}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
      {/* The recordings are the museum's; the link leads to its page for this work. */}
      <Credit
        text={guide.recordings.length > 0 ? dict.tours.credit : t.audioCredit}
        dict={dict}
        href={artwork.sourceUrl}
        className="mt-3 text-xs text-muted"
      />
    </section>
  );
}

/** Articles and publications on artic.edu that mention the artist (or the work). */
export async function FurtherReading({
  topic,
  dict,
}: {
  topic: string;
  dict: Dictionary;
}) {
  if (!topic || topic === UNKNOWN_ARTIST) return null;
  const items = await getFurtherReading(topic);
  if (items.length === 0) return null;
  const t = dict.detail;
  return (
    <Reveal
      as="section"
      aria-labelledby="further-reading"
      className="grid gap-6 border-t border-line pt-10 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-12"
    >
      <h2
        id="further-reading"
        className="text-xs font-medium tracking-[0.18em] text-accent uppercase md:pt-2"
      >
        {t.furtherReading}
      </h2>
      <ul className="max-w-3xl divide-y divide-line border-y border-line">
        {items.map((item) => (
          <li key={item.url}>
            <a
              href={item.url}
              target="_blank"
              rel={EXTERNAL_REL}
              className="group flex items-baseline justify-between gap-6 py-4"
            >
              <span>
                <span className="block text-xs tracking-[0.12em] text-muted uppercase">
                  {t.readingKinds[item.kind]}
                </span>
                <span
                  lang="en"
                  className="mt-1 block font-serif text-xl leading-snug group-hover:underline group-hover:underline-offset-4"
                >
                  {item.title}
                </span>
              </span>
              <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
              <span className="sr-only">{dict.site.opensInNewTab}</span>
            </a>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
