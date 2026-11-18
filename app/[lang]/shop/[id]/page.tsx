import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArtworkWall } from "@/components/artwork/artwork-wall";
import {
  BackLink,
  eyebrowClass,
  OutLink,
  Runs,
} from "@/components/library/parts";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getArtworksByIds } from "@/lib/artic/artworks";
import { parseRecordId } from "@/lib/artic/records";
import { getProduct } from "@/lib/artic/shop";
import { localizePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/i18n/museum-time";
import { languageAlternates, localeOf } from "@/lib/page-params";

type Params = Promise<{ lang: string; id: string }>;

const loadProduct = cache(async (rawId: string) => {
  const id = parseRecordId(rawId);
  return id === null ? null : getProduct(id);
});

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const dict = getDictionary(localeOf(lang));
  const product = await loadProduct(id).catch(() => null);
  if (!product) return { title: dict.meta.notFoundTitle };
  return {
    title: product.title,
    alternates: languageAlternates(`/shop/${id}`),
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { lang, id } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const t = dict.shop;
  const product = await loadProduct(id);
  if (!product) notFound();

  const related = await getArtworksByIds(product.artworkIds.slice(0, 4), {
    timeoutMs: 5000,
    retries: 1,
  }).catch(() => null);
  const price = product.price;

  return (
    <article className="pb-24 sm:pb-32">
      <Container className="pt-8 sm:pt-10">
        <BackLink href={localizePath(locale, "/shop")} label={t.allProducts} />
      </Container>

      <Container className="mt-8 grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex min-h-80 items-center justify-center bg-paper-deep p-8 sm:p-14">
          {product.largeImage ? (
            <img
              src={product.largeImage}
              alt={product.title}
              width={900}
              height={900}
              className="max-h-[70svh] w-auto max-w-full object-contain"
            />
          ) : null}
        </div>
        <div className="animate-rise [animation-delay:calc(var(--intro-delay)+200ms)]">
          <p className={eyebrowClass}>{t.heading}</p>
          <h1
            lang="en"
            className="mt-5 font-serif text-4xl leading-[1.08] tracking-tight text-balance sm:text-5xl"
          >
            {product.title}
          </h1>
          {price ? (
            <p className="mt-5 text-xl tabular-nums">
              {formatPrice(price.from, locale)}
              {price.to > price.from
                ? ` – ${formatPrice(price.to, locale)}`
                : null}
              {price.was ? (
                <s className="ml-3 text-base text-muted">
                  {formatPrice(price.was, locale)}
                </s>
              ) : null}
            </p>
          ) : null}
          <div className="mt-8">
            <OutLink href={product.url} dict={dict} className={buttonStyles()}>
              {t.buy}
            </OutLink>
          </div>
          {product.description ? (
            <div
              lang="en"
              className="mt-10 max-w-xl space-y-3 leading-7 text-ink/85"
            >
              {product.description.map((paragraph, index) => (
                <p key={index}>
                  <Runs runs={paragraph} />
                </p>
              ))}
            </div>
          ) : null}
          <p className="mt-10 text-xs text-muted">{t.credit}</p>
        </div>
      </Container>

      {related?.artworks.length ? (
        <Container className="mt-20">
          <section aria-labelledby="related-works">
            <h2
              id="related-works"
              className="border-b border-line pb-4 font-serif text-3xl sm:text-4xl"
            >
              {t.relatedWorks}
            </h2>
            <ArtworkWall
              artworks={related.artworks}
              locale={locale}
              className="mt-10"
            />
          </section>
        </Container>
      ) : null}
    </article>
  );
}
