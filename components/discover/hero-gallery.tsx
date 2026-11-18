"use client";

import { useMemo, useState } from "react";
import { ArtworkImage } from "@/components/artwork/artwork-image";
import { GalleryRoom } from "@/components/gallery-room/gallery-room";
import type { RoomArtwork } from "@/components/gallery-room/types";
import { buttonStyles } from "@/components/ui/button";
import { ArrowDown, ArrowLeft, ArrowRight } from "@/components/ui/icons";
import type { Artwork } from "@/lib/artwork/types";
import { cn } from "@/lib/utils";

export interface HeroGalleryProps {
  artworks: readonly Artwork[];
  /** Small caps line above the headline. */
  eyebrow: string;
  /** Small line under the lede, e.g. that the works are an offline snapshot. */
  note?: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function HeroGallery({ artworks, eyebrow, note }: HeroGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = artworks[activeIndex];
  const count = artworks.length;

  // "loading" until the WebGL room has drawn; "unavailable" keeps the static wall for good.
  const [room, setRoom] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  const roomArtworks = useMemo<RoomArtwork[]>(
    () =>
      artworks.map((artwork) => ({
        id: artwork.id,
        title: artwork.title,
        artist: artwork.artist,
        textureUrl: artwork.image.src,
        aspectRatio: artwork.image.aspectRatio,
        dimensions: artwork.dimensions,
      })),
    [artworks],
  );

  const step = (delta: number) =>
    setActiveIndex((index) => (index + delta + count) % count);

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate flex flex-col overflow-hidden bg-gallery text-gallery-text lg:block lg:min-h-[max(100svh,760px)]"
    >
      {/* Stage: the room itself. On small screens it sits above the text; from lg it fills the hero. */}
      <div
        aria-hidden="true"
        className="relative h-[58svh] min-h-[360px] w-full lg:absolute lg:inset-0 lg:h-auto"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_38%,#4a4640_0%,#2a2825_48%,#1a1917_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[24%] bg-[linear-gradient(180deg,#1f1d1a_0%,#141311_100%)] lg:h-[30%]" />

        {/* Static fallback: one lit work on the wall, shown until (or instead of) the WebGL room. */}
        <div
          className={cn(
            "absolute inset-x-6 top-24 bottom-[30%] flex items-end justify-center transition-opacity duration-700 ease-gallery sm:inset-x-16 lg:top-[17%] lg:bottom-[36%]",
            room === "ready" && "opacity-0",
          )}
        >
          {active ? (
            <ArtworkImage
              key={active.id}
              image={active.image}
              sizes="(min-width: 1024px) 55vw, 85vw"
              priority
              className="h-auto max-h-full w-auto max-w-full border-[6px] border-[#2b2016] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)] sm:border-8"
              fallbackClassName="max-h-full w-full max-w-[min(100%,720px)] border-[6px] border-[#2b2016]"
            />
          ) : null}
        </div>

        {room !== "unavailable" && count >= 3 ? (
          <GalleryRoom
            className="absolute inset-0"
            artworks={roomArtworks}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            onReady={() => setRoom("ready")}
            onUnavailable={() => setRoom("unavailable")}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(0deg,#1a1917_0%,transparent_100%)] lg:h-3/5 lg:bg-[linear-gradient(0deg,rgb(20_19_17/0.94)_0%,rgb(20_19_17/0.6)_45%,transparent_100%)]" />
      </div>

      {/* From lg the text floats over the room; only the text itself takes clicks. */}
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-5 pt-2 pb-12 sm:px-8 sm:pb-14 lg:pointer-events-none lg:absolute lg:inset-x-0 lg:bottom-0 lg:flex-row lg:items-end lg:justify-between lg:px-12 lg:*:pointer-events-auto">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-[0.2em] text-gallery-muted uppercase">
            {eyebrow}
          </p>
          <h1
            id="hero-heading"
            className="mt-4 font-serif text-[2.6rem] leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl"
          >
            Art is worth lingering over.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-gallery-text/85 sm:text-lg">
            Step into a room of public-domain paintings and prints from the Art
            Institute of Chicago, then browse the collection at your own pace.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href="#explore" className={buttonStyles({ tone: "dark" })}>
              Explore the collection
              <ArrowDown aria-hidden="true" className="size-4" />
            </a>
          </div>
          {note ? (
            <p className="mt-6 max-w-md text-xs leading-5 text-gallery-muted">
              {note}
            </p>
          ) : null}
        </div>

        {active ? (
          <div className="w-full max-w-sm shrink-0 lg:w-80">
            <div
              aria-live="polite"
              className="border-l-2 border-accent bg-paper/95 py-4 pr-5 pl-4 text-ink shadow-xl"
            >
              <p className="text-[0.6875rem] tracking-[0.16em] text-muted uppercase">
                <span className="sr-only">Work </span>
                {pad(activeIndex + 1)} <span aria-hidden="true">/</span>
                <span className="sr-only"> of </span> {pad(count)}
              </p>
              <p className="mt-2 text-sm font-medium">{active.artist}</p>
              <p className="font-serif text-lg leading-snug italic">
                {active.title}
              </p>
              <p className="mt-1 text-sm text-muted">
                {[active.dateDisplay, active.medium]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => step(-1)}
                className={cn(
                  buttonStyles({
                    variant: "secondary",
                    tone: "dark",
                    size: "sm",
                  }),
                  "size-11 px-0",
                )}
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                <span className="sr-only">Previous work</span>
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className={cn(
                  buttonStyles({
                    variant: "secondary",
                    tone: "dark",
                    size: "sm",
                  }),
                  "size-11 px-0",
                )}
              >
                <ArrowRight aria-hidden="true" className="size-4" />
                <span className="sr-only">Next work</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
