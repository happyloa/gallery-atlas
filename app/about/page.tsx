import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { EXTERNAL_REL } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Gallery Atlas exists, how it is built, and how artwork data and images from the Art Institute of Chicago are used.",
};

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel={EXTERNAL_REL}
      className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
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

export default function AboutPage() {
  return (
    <Container className="pt-16 pb-24 sm:pt-24 sm:pb-32">
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
          <ExternalLink href="https://api.artic.edu/docs/">
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
          <ExternalLink href="https://www.artic.edu/image-licensing">
            image licensing
          </ExternalLink>{" "}
          and{" "}
          <ExternalLink href="https://www.artic.edu/terms">terms</ExternalLink>{" "}
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
          <ExternalLink href="https://github.com/happyloa">
            github.com/happyloa
          </ExternalLink>
        </p>
      </Section>
    </Container>
  );
}
