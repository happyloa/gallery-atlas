import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { languageAlternates, localeOf } from "@/lib/page-params";
import { EXTERNAL_REL } from "@/lib/utils";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  return {
    title: dict.about.title,
    description: dict.about.description,
    alternates: languageAlternates(locale, "/about"),
  };
}

function ExternalLink({
  href,
  children,
  newTab,
}: {
  href: string;
  children: ReactNode;
  newTab: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel={EXTERNAL_REL}
      className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
    >
      {children}
      <span className="sr-only">{newTab}</span>
    </a>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line py-10 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-12 lg:py-14">
      <h2 className="text-xs font-medium tracking-[0.18em] text-accent uppercase md:pt-2">
        {title}
      </h2>
      <div className="max-w-2xl space-y-4 text-base leading-7 text-ink/90 sm:text-lg sm:leading-8">
        {children}
      </div>
    </section>
  );
}

function EnglishAbout({ newTab }: { newTab: string }) {
  return (
    <>
      <header className="max-w-4xl pb-14 sm:pb-20">
        <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
          About
        </p>
        <h1 className="mt-4 font-serif text-4xl leading-[1.05] sm:text-6xl">
          A quiet place to look at art, for as long as you like.
        </h1>
      </header>

      <Section title="The project">
        <p>
          Gallery Atlas shows public-domain works from the Art Institute of
          Chicago. Search the collection, save works, and make exhibitions of
          your own.
        </p>
        <p>
          No accounts. Favorites and exhibitions are saved in this browser and
          don&apos;t sync to other devices.
        </p>
      </Section>

      <Section title="Data and images">
        <p>
          Data and images come from the{" "}
          <ExternalLink href="https://api.artic.edu/docs/" newTab={newTab}>
            Art Institute of Chicago public API
          </ExternalLink>
          . Only works the museum marks as public domain are shown.
        </p>
        <p>
          Metadata: CC0. Descriptions:{" "}
          <ExternalLink
            href="https://creativecommons.org/licenses/by/4.0/"
            newTab={newTab}
          >
            CC BY 4.0
          </ExternalLink>
          . Images are used under the museum&apos;s{" "}
          <ExternalLink
            href="https://www.artic.edu/image-licensing"
            newTab={newTab}
          >
            image licensing
          </ExternalLink>{" "}
          and{" "}
          <ExternalLink href="https://www.artic.edu/terms" newTab={newTab}>
            terms
          </ExternalLink>
          .
        </p>
        <p>Image and artwork data courtesy of the Art Institute of Chicago.</p>
      </Section>

      <Section title="Independence">
        <p>
          An independent project, not affiliated with or endorsed by the Art
          Institute of Chicago.
        </p>
      </Section>

      <Section title="How it’s built">
        <p>
          vinext (Next.js App Router APIs on Vite), React, TypeScript, Tailwind
          CSS and three.js, on Cloudflare Workers.
        </p>
        <p>
          Source code:{" "}
          <ExternalLink
            href="https://github.com/happyloa/gallery-atlas"
            newTab={newTab}
          >
            github.com/happyloa/gallery-atlas
          </ExternalLink>
        </p>
      </Section>
    </>
  );
}

function ChineseAbout({ newTab }: { newTab: string }) {
  return (
    <>
      <header className="max-w-4xl pb-14 sm:pb-20">
        <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
          關於
        </p>
        <h1 className="mt-4 font-serif text-4xl leading-[1.2] sm:text-6xl">
          一個可以慢慢看畫的地方。
        </h1>
      </header>

      <Section title="這個專案">
        <p>
          Gallery Atlas
          展示芝加哥藝術博物館的公有領域作品。可以搜尋館藏、收藏作品，也能自己策劃展覽。
        </p>
        <p>不需要帳號。收藏和展覽存在這個瀏覽器，不會同步到其他裝置。</p>
      </Section>

      <Section title="資料與圖片">
        <p>
          資料與圖片來自
          <ExternalLink href="https://api.artic.edu/docs/" newTab={newTab}>
            芝加哥藝術博物館的公開 API
          </ExternalLink>
          ，只顯示館方標示為公有領域的作品。館方資料只有英文，作品名稱、藝術家等資訊維持原文，搜尋請用英文。
        </p>
        <p>
          作品資料：CC0。作品說明：
          <ExternalLink
            href="https://creativecommons.org/licenses/by/4.0/"
            newTab={newTab}
          >
            CC BY 4.0
          </ExternalLink>
          。圖片依館方的
          <ExternalLink
            href="https://www.artic.edu/image-licensing"
            newTab={newTab}
          >
            圖片授權
          </ExternalLink>
          與
          <ExternalLink href="https://www.artic.edu/terms" newTab={newTab}>
            使用條款
          </ExternalLink>
          使用。
        </p>
        <p lang="en">
          Image and artwork data courtesy of the Art Institute of Chicago.
        </p>
      </Section>

      <Section title="獨立專案聲明">
        <p>本站是獨立的個人專案，與芝加哥藝術博物館無關，也未經館方認可。</p>
        <p lang="en">
          This is an independent project and is not affiliated with the Art
          Institute of Chicago.
        </p>
      </Section>

      <Section title="使用的技術">
        <p>
          vinext（在 Vite 上執行的 Next.js App Router
          API）、React、TypeScript、Tailwind CSS、three.js，部署在 Cloudflare
          Workers。
        </p>
        <p>
          原始碼：
          <ExternalLink
            href="https://github.com/happyloa/gallery-atlas"
            newTab={newTab}
          >
            github.com/happyloa/gallery-atlas
          </ExternalLink>
        </p>
      </Section>
    </>
  );
}

export default async function AboutPage({ params }: { params: Params }) {
  const locale = localeOf((await params).lang);
  const newTab = getDictionary(locale).site.opensInNewTab;
  return (
    <Container className="pt-16 pb-24 sm:pt-24 sm:pb-32">
      {locale === "zh-tw" ? (
        <ChineseAbout newTab={newTab} />
      ) : (
        <EnglishAbout newTab={newTab} />
      )}
    </Container>
  );
}
