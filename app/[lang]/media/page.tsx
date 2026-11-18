import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultsError } from "@/components/discover/results-error";
import {
  Credit,
  FilterChips,
  IndexList,
  KeywordForm,
  ListPagination,
  MUSEUM_SITE,
  OutLink,
  PageHeader,
  ResultCount,
} from "@/components/library/parts";
import { Container } from "@/components/ui/container";
import { getMedia, isMediaKind, MEDIA_KINDS } from "@/lib/artic/media";
import type { MediaItem, MediaKind } from "@/lib/artic/media";
import { localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import {
  attempt,
  keywordParam,
  languageAlternates,
  localeOf,
  pageParam,
  stringParam,
  withQuery,
} from "@/lib/page-params";
import type { RouteSearchParams } from "@/lib/page-params";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<RouteSearchParams>;
}): Promise<Metadata> {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const query = await searchParams;
  const kind = stringParam(query, "kind");
  return {
    title: dict.media.heading,
    description: dict.media.metaDescription,
    alternates: languageAlternates(locale, "/media", {
      q: keywordParam(query),
      kind: kind && kind !== "sounds" && isMediaKind(kind) ? kind : null,
      page: pageParam(query) ?? 1,
    }),
  };
}

function MediaRow({
  kind,
  item,
  locale,
  dict,
}: {
  kind: MediaKind;
  item: MediaItem;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.media;
  return (
    <li className="py-6">
      <h2 lang="en" className="font-serif text-2xl leading-snug">
        {item.title}
      </h2>
      {item.description ? (
        <p lang="en" className="mt-2 max-w-3xl text-sm leading-6 text-ink/75">
          {item.description}
        </p>
      ) : null}
      {kind === "sounds" ? (
        // The museum publishes no transcript for these recordings.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio
          controls
          preload="none"
          src={item.url}
          aria-label={item.title}
          className="mt-3 h-10 w-full max-w-xl"
        />
      ) : null}
      {kind === "videos" ? (
        // The museum publishes no captions for this video.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          controls
          preload="none"
          src={item.url}
          aria-label={item.title}
          className="mt-3 aspect-video w-full max-w-2xl bg-paper-deep"
        />
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        {kind === "sounds" ? (
          <OutLink href={item.url} dict={dict}>
            {t.openSound}
          </OutLink>
        ) : null}
        {kind === "documents" ? (
          <OutLink href={item.url} dict={dict}>
            {t.openDocument}
          </OutLink>
        ) : null}
        {kind === "videos" ? (
          <OutLink href={item.url} dict={dict}>
            {t.openVideo}
          </OutLink>
        ) : null}
        {kind === "sites" ? (
          <OutLink href={item.url} dict={dict}>
            {t.visitSite}
          </OutLink>
        ) : null}
        {item.artworks.length > 0 ? (
          <p className="text-muted">
            {t.related}
            {dict.common.colon}
            {item.artworks.map((artwork, index) => (
              <span key={artwork.id}>
                {index > 0 ? dict.common.listSeparator : null}
                <Link
                  href={localizePath(locale, `/artworks/${artwork.id}`)}
                  prefetch={false}
                  lang="en"
                  className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
                >
                  {artwork.title}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export default async function MediaPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<RouteSearchParams>;
}) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const t = dict.media;
  const query = await searchParams;
  const q = keywordParam(query);
  const page = pageParam(query);
  // Past the last page the museum's search can show: no such page, and no request for it.
  if (page === null) notFound();
  const rawKind = stringParam(query, "kind") ?? "sounds";
  const kind: MediaKind = isMediaKind(rawKind) ? rawKind : "sounds";
  const base = localizePath(locale, "/media");
  const kindParam = kind === "sounds" ? null : kind;
  const result = await attempt(() => getMedia(kind, { keyword: q, page }));

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-14 sm:pt-20">
        <PageHeader eyebrow={t.eyebrow} title={t.heading} />
        <div className="mt-10 space-y-6">
          <FilterChips
            label={t.kindLabel}
            items={MEDIA_KINDS.map((name) => ({
              key: name,
              href: withQuery(base, {
                kind: name === "sounds" ? null : name,
              }),
              label: t.kinds[name],
              active: name === kind,
            }))}
          />
          <KeywordForm
            action={base}
            label={format(t.searchLabel, { kind: t.kinds[kind] })}
            placeholder={dict.common.keyword}
            submit={dict.common.searchSubmit}
            value={q}
            hidden={{ kind: kindParam ?? undefined }}
          />
        </div>
      </Container>

      <Container className="mt-12">
        {result.failure ? <ResultsError {...result.failure} /> : null}
        {result.data ? (
          <>
            <ResultCount
              total={result.data.total}
              locale={locale}
              dict={dict}
            />
            {result.data.items.length === 0 ? (
              <p className="mt-6 text-muted">
                {q ? format(dict.common.noMatch, { q }) : dict.common.nothing}
              </p>
            ) : (
              <div className="mt-4">
                <IndexList>
                  {result.data.items.map((item) => (
                    <MediaRow
                      key={item.id}
                      kind={kind}
                      item={item}
                      locale={locale}
                      dict={dict}
                    />
                  ))}
                </IndexList>
              </div>
            )}
            <ListPagination
              locale={locale}
              dict={dict}
              page={page}
              totalPages={result.data.totalPages}
              hrefFor={(next) =>
                withQuery(base, { kind: kindParam, q, page: next })
              }
            />
          </>
        ) : null}
        <Credit
          text={t.credit}
          dict={dict}
          href={MUSEUM_SITE}
          className="mt-16 text-xs text-muted"
        />
      </Container>
    </div>
  );
}
