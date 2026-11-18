"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArtworkImage } from "@/components/artwork/artwork-image";
import { GalleryRoom } from "@/components/gallery-room/gallery-room";
import type { RoomArtwork } from "@/components/gallery-room/types";
import { buttonStyles } from "@/components/ui/button";
import { Expand, X } from "@/components/ui/icons";
import type { Artwork } from "@/lib/artwork/types";
import { localizePath } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import type { RoomPlace } from "@/lib/tours/room-plan";
import { cn } from "@/lib/utils";

const NO_WORKS: readonly Artwork[] = [];

/** The room's canvas takes a second to fade in over the flat picture. */
const ROOM_FADE_MS = 1200;

/** What the stage says about the stop being heard. */
export interface StageStop {
  /** "Stop 3" or "Introduction". */
  label: string;
  title: string;
  /** The title is English text on a Chinese page. */
  titleInEnglish: boolean;
}

export interface TourStageProps {
  rooms: readonly (readonly Artwork[])[];
  /** Where the visitor stands. */
  place: RoomPlace;
  /** The stop is about the work at `place`; otherwise its title is shown over the room. */
  showsWork: boolean;
  stop: StageStop;
  /** The tour is under way: build the 3D room and show the captions. */
  started: boolean;
  fullScreen: boolean;
  onFullScreenChange: (fullScreen: boolean) => void;
  /** A work on the wall was clicked. */
  onPickWork: (place: RoomPlace) => void;
}

/**
 * The tour's works in the 3D gallery. The flat picture underneath stands in until the room
 * has drawn, between rooms, and for good on devices without capable WebGL.
 */
export function TourStage({
  rooms,
  place,
  showsWork,
  stop,
  started,
  fullScreen,
  onFullScreenChange,
  onPickWork,
}: TourStageProps) {
  const { locale, dict } = useI18n();
  const t = dict.tours;
  const works = rooms[place.room] ?? NO_WORKS;
  const work = works[place.work] ?? null;

  const [readyRoom, setReadyRoom] = useState<number | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const roomArtworks = useMemo<RoomArtwork[]>(
    () =>
      works.map((artwork) => ({
        id: artwork.id,
        title: artwork.title,
        artist: artwork.artist,
        textureUrl: artwork.image.src,
        aspectRatio: artwork.image.aspectRatio,
        dimensions: artwork.dimensions,
      })),
    [works],
  );

  const stageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!fullScreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onFullScreenChange(false);
    };
    window.addEventListener("keydown", onKey);
    // Lenis follows this too, so the page behind stays put.
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    // The site header would otherwise sit over the stage and its close button.
    const chrome = [
      ...document.querySelectorAll<HTMLElement>("header, footer"),
    ];
    for (const element of chrome) element.style.visibility = "hidden";

    // Everything behind the stage is out of reach while it fills the screen: keyboard
    // focus and screen readers stay on the stage and the player bar. Walking up from the
    // stage, each sibling on the way is made inert unless it holds something to keep.
    const keep = [
      ...document.querySelectorAll<HTMLElement>("[data-tour-keep]"),
    ];
    const silenced: HTMLElement[] = [];
    let node: HTMLElement | null = stageRef.current;
    while (node && node !== document.body) {
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) break;
      for (const sibling of parent.children) {
        if (sibling === node || !(sibling instanceof HTMLElement)) continue;
        if (sibling.inert || keep.some((kept) => sibling.contains(kept)))
          continue;
        sibling.inert = true;
        silenced.push(sibling);
      }
      node = parent;
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = previous;
      for (const element of chrome) element.style.visibility = "";
      for (const element of silenced) element.inert = false;
    };
  }, [fullScreen, onFullScreenChange]);

  const roomShown = started && !unavailable && readyRoom === place.room;

  // Once the room has faded in, the flat picture under it is taken away: left in place it
  // would download another image, never seen, at every stop. It comes back whenever the
  // room is not showing (the next room being built, or WebGL lost).
  const [settledRoom, setSettledRoom] = useState<number | null>(null);
  useEffect(() => {
    if (!roomShown) return;
    const room = place.room;
    const timer = window.setTimeout(() => setSettledRoom(room), ROOM_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [roomShown, place.room]);
  const showFallback = !(roomShown && settledRoom === place.room);

  return (
    <section
      ref={stageRef}
      aria-label={t.stage}
      data-tone="dark"
      // "playing" lets app/globals.css unstick the stage on a short, narrow screen.
      data-tour-stage={fullScreen ? "full" : started ? "playing" : "idle"}
      className={cn(
        "isolate overflow-hidden bg-gallery text-gallery-text",
        fullScreen
          ? "fixed inset-0 z-50"
          : cn(
              "relative -mx-5 h-[42svh] min-h-64 sm:-mx-8 lg:top-20 lg:mx-0 lg:h-[calc(100svh-12.5rem)] lg:min-h-[28rem]",
              started ? "sticky top-16 z-20" : "lg:sticky",
            ),
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_38%,#4a4640_0%,#2a2825_48%,#1a1917_100%)]"
      />

      {work && showFallback ? (
        <div
          className={cn(
            "absolute inset-x-6 top-6 bottom-24 flex items-center justify-center transition-opacity duration-700 ease-gallery sm:inset-x-12 sm:top-10",
            roomShown && "opacity-0",
          )}
        >
          <ArtworkImage
            key={work.id}
            image={work.image}
            sizes="(min-width: 1024px) 50vw, 90vw"
            priority
            className="h-auto max-h-full w-auto max-w-full border-[6px] border-[#2b2016] object-contain shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]"
            fallbackClassName="max-h-full w-full max-w-md border-[6px] border-[#2b2016]"
          />
        </div>
      ) : null}

      {started && !unavailable ? (
        <GalleryRoom
          className="absolute inset-0"
          framing="tour"
          artworks={roomArtworks}
          activeIndex={place.work}
          onActiveIndexChange={(index) =>
            onPickWork({ room: place.room, work: index })
          }
          onReady={() => setReadyRoom(place.room)}
          onUnavailable={() => setUnavailable(true)}
        />
      ) : null}

      {started && !showsWork ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gallery/80 px-8 text-center">
          <p className="text-xs tracking-[0.18em] text-gallery-muted uppercase">
            {stop.label}
          </p>
          <p
            lang={stop.titleInEnglish ? "en" : undefined}
            className="mt-3 max-w-xl font-serif text-3xl leading-tight text-balance sm:text-4xl"
          >
            {stop.title}
          </p>
        </div>
      ) : null}

      {started && showsWork && work ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgb(20_19_17/0.94)_0%,rgb(20_19_17/0.72)_60%,transparent_100%)] px-5 pt-12 sm:px-8",
            // Full screen, the player bar covers the bottom of the stage.
            fullScreen ? "pb-32" : "pb-4",
          )}
        >
          <p className="text-[0.6875rem] tracking-[0.16em] text-gallery-muted uppercase">
            {stop.label}
          </p>
          <p
            lang="en"
            className="mt-1 line-clamp-1 font-serif text-xl leading-snug italic sm:line-clamp-2 sm:text-2xl"
          >
            {work.title}
          </p>
          <p className="mt-0.5 truncate text-sm text-gallery-text/80">
            <span lang="en">
              {[work.artist, work.dateDisplay].filter(Boolean).join(", ")}
            </span>
            <span aria-hidden="true"> · </span>
            <Link
              href={localizePath(locale, `/artworks/${work.id}`)}
              className="pointer-events-auto underline decoration-white/40 underline-offset-4 hover:decoration-white"
            >
              {t.viewArtwork}
            </Link>
          </p>
        </div>
      ) : null}

      {started ? (
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-3">
          {rooms.length > 1 ? (
            <p className="rounded-full bg-gallery/75 px-3 py-1.5 text-xs text-gallery-text">
              {format(t.room, {
                current: place.room + 1,
                total: rooms.length,
              })}
            </p>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => onFullScreenChange(!fullScreen)}
            aria-label={fullScreen ? t.exitFullScreen : t.enterFullScreen}
            className={cn(
              buttonStyles({ variant: "secondary", tone: "dark", size: "sm" }),
              "size-11 shrink-0 bg-gallery/75 px-0",
            )}
          >
            {fullScreen ? (
              <X aria-hidden="true" className="size-4" />
            ) : (
              <Expand aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
      ) : null}
    </section>
  );
}
