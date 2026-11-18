import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import {
  isLocale,
  LOCALE_TAGS,
  LOCALES,
  localizePath,
} from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { EXTERNAL_REL } from "@/lib/utils";

type Params = Promise<{ lang: string }>;

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "en");

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
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [LOCALE_TAGS[l], localizePath(l, "/about")]),
      ),
    },
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
          Gallery Atlas lets you wander through public-domain works from the Art
          Institute of Chicago the way you would walk a museum: one room, one
          painting at a time. You can search the collection, keep the works you
          love, and put together small exhibitions of your own.
        </p>
        <p>
          There are no accounts. Favorites and exhibitions are saved in your
          browser, so they stay on this device and don&apos;t sync to others.
        </p>
      </Section>

      <Section title="Data and images">
        <p>
          Artwork data and images come from the{" "}
          <ExternalLink href="https://api.artic.edu/docs/" newTab={newTab}>
            Art Institute of Chicago public API
          </ExternalLink>
          . Images are loaded directly from the museum&apos;s IIIF image server
          at the sizes it allows. Gallery Atlas only shows images of works the
          museum marks as public domain.
        </p>
        <p>
          Artwork metadata is released under CC0. Artwork descriptions are
          licensed CC BY 4.0 and are credited wherever they appear. For how
          images may be used, the museum&apos;s{" "}
          <ExternalLink
            href="https://www.artic.edu/image-licensing"
            newTab={newTab}
          >
            image licensing
          </ExternalLink>{" "}
          and{" "}
          <ExternalLink href="https://www.artic.edu/terms" newTab={newTab}>
            terms
          </ExternalLink>{" "}
          take precedence. This site does not offer image downloads.
        </p>
        <p>Image and artwork data courtesy of the Art Institute of Chicago.</p>
      </Section>

      <Section title="Independence">
        <p>
          This is an independent project and is not affiliated with the Art
          Institute of Chicago. It does not use the museum&apos;s logo, and
          nothing here is endorsed by the museum.
        </p>
      </Section>

      <Section title="How it’s built">
        <p>
          Next.js App Router APIs running on vinext and Vite, React, TypeScript,
          Tailwind CSS and three.js, deployed to Cloudflare Workers. Requests to
          the museum&apos;s API are made on the server and cached, to stay well
          within its rate limits.
        </p>
        <p>
          Source code and developer:{" "}
          <ExternalLink href="https://github.com/happyloa" newTab={newTab}>
            github.com/happyloa
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
          讓你像逛美術館一樣，一間展廳、一幅畫地看芝加哥藝術博物館的公有領域作品。你可以搜尋館藏、收藏喜歡的作品，也可以自己策劃小型展覽。
        </p>
        <p>
          網站不需要註冊帳號。收藏和展覽都存在你的瀏覽器裡，只留在這台裝置上，不會同步到其他裝置。
        </p>
      </Section>

      <Section title="資料與圖片">
        <p>
          作品資料與圖片來自
          <ExternalLink href="https://api.artic.edu/docs/" newTab={newTab}>
            芝加哥藝術博物館的公開 API
          </ExternalLink>
          。圖片直接從館方的 IIIF
          圖片伺服器載入，只使用館方開放的尺寸，而且只顯示館方標示為公有領域的作品。
        </p>
        <p>
          館方的作品資料只有英文，所以作品名稱、作者、年代、媒材這些資訊會維持英文原文，介面文字則有中文。搜尋館藏時也請用英文關鍵字。
        </p>
        <p>
          作品資料以 CC0 釋出；作品說明的授權是 CC BY
          4.0，出現的地方都會標示來源。圖片的使用方式以館方的
          <ExternalLink
            href="https://www.artic.edu/image-licensing"
            newTab={newTab}
          >
            圖片授權說明
          </ExternalLink>
          和
          <ExternalLink href="https://www.artic.edu/terms" newTab={newTab}>
            使用條款
          </ExternalLink>
          為準。本站不提供圖片下載。
        </p>
        <p>Image and artwork data courtesy of the Art Institute of Chicago.</p>
      </Section>

      <Section title="獨立專案聲明">
        <p>
          本站是獨立的個人專案，與芝加哥藝術博物館沒有任何關係，沒有使用館方標誌，內容也沒有經過館方認可。
        </p>
        <p lang="en">
          This is an independent project and is not affiliated with the Art
          Institute of Chicago.
        </p>
      </Section>

      <Section title="使用的技術">
        <p>
          以 vinext 和 Vite 執行 Next.js App Router API，搭配
          React、TypeScript、Tailwind CSS 與 three.js，部署在 Cloudflare
          Workers。所有對館方 API
          的請求都由伺服器發出並加上快取，避免超過館方的流量限制。
        </p>
        <p>
          原始碼與開發者：
          <ExternalLink href="https://github.com/happyloa" newTab={newTab}>
            github.com/happyloa
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
