import type { Metadata } from "next";
import Link from "next/link";
import { ResultsError } from "@/components/discover/results-error";
import {
  ListPagination,
  PageHeader,
  ResultCount,
} from "@/components/library/parts";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { getProducts } from "@/lib/artic/shop";
import { localizePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/i18n/museum-time";
import {
  attempt,
  languageAlternates,
  localeOf,
  pageParam,
  withQuery,
} from "@/lib/page-params";
import type { RouteSearchParams } from "@/lib/page-params";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const dict = getDictionary(localeOf((await params).lang));
  return {
    title: dict.shop.heading,
    description: dict.shop.metaDescription,
    alternates: languageAlternates("/shop"),
  };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<RouteSearchParams>;
}) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const t = dict.shop;
  const page = pageParam(await searchParams);
  const base = localizePath(locale, "/shop");
  const result = await attempt(() => getProducts(page));

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-14 sm:pt-20">
        <PageHeader eyebrow={t.eyebrow} title={t.heading} />
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
            <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
              {result.data.items.map((product, index) => (
                <Reveal as="li" key={product.id} delay={(index % 4) * 70}>
                  <article className="group relative">
                    <div className="flex aspect-square items-center justify-center bg-paper-deep p-4">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          width={480}
                          height={480}
                          className="max-h-full w-auto max-w-full object-contain transition-transform duration-500 ease-gallery group-hover:scale-[1.03]"
                        />
                      ) : null}
                    </div>
                    <h2
                      lang="en"
                      className="mt-3 font-serif text-lg leading-snug"
                    >
                      <Link
                        href={`${base}/${product.id}`}
                        prefetch={false}
                        className="underline-offset-4 after:absolute after:inset-0 after:content-[''] group-hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent"
                      >
                        {product.title}
                      </Link>
                    </h2>
                    {product.price ? (
                      <p className="mt-1 text-sm text-muted tabular-nums">
                        {formatPrice(product.price.from, locale)}
                      </p>
                    ) : null}
                  </article>
                </Reveal>
              ))}
            </ul>
            <ListPagination
              locale={locale}
              dict={dict}
              page={page}
              totalPages={result.data.totalPages}
              hrefFor={(next) => withQuery(base, { page: next })}
            />
          </>
        ) : null}
        <p className="mt-16 text-xs text-muted">{t.credit}</p>
      </Container>
    </div>
  );
}
