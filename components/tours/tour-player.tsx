"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ArtworkImage } from "@/components/artwork/artwork-image";
import { buttonStyles } from "@/components/ui/button";
import { Pause, Play, SkipBack, SkipForward } from "@/components/ui/icons";
import { fitClass } from "@/lib/artwork/fit";
import type { Tour, TourRecording, TourStop } from "@/lib/artwork/types";
import { localizePath } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Transcript } from "./transcript";

type Language = "zh" | "en";
type Item = TourRecording & Partial<Omit<TourStop, keyof TourRecording>>;

const SPEEDS = [1, 1.25, 1.5, 0.75];

/* Which stop a visitor reached, per tour, kept in this browser. */
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function readProgress(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeProgress(key: string, value: number | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, String(value));
  } catch {
    // Private mode or full storage: the tour simply starts over next time.
  }
  listeners.forEach((listener) => listener());
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

const sourceOf = (item: Item, language: Language) =>
  language === "zh" ? (item.zhSrc ?? item.src) : (item.src ?? item.zhSrc);
const isMandarin = (item: Item, language: Language) =>
  Boolean(item.zhSrc) && (language === "zh" || !item.src);

/** The stops of one tour, played in order through one shared audio element. */
export function TourPlayer({ tour }: { tour: Tour }) {
  const { locale, dict } = useI18n();
  const t = dict.tours;
  const audioRef = useRef<HTMLAudioElement>(null);

  const items = useMemo<Item[]>(
    () => [
      ...(tour.introRecording ? [tour.introRecording] : []),
      ...tour.stops,
    ],
    [tour],
  );
  const offersMandarin = locale === "zh-tw" && items.some((i) => i.zhSrc);

  const [language, setLanguage] = useState<Language>(
    offersMandarin ? "zh" : "en",
  );
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);

  const progressKey = `gallery-atlas:tour:${tour.id}`;
  const saved = useSyncExternalStore(
    subscribe,
    () => readProgress(progressKey),
    () => null,
  );
  const savedIndex = saved === null ? 0 : Number(saved);
  const resumeIndex =
    Number.isInteger(savedIndex) && savedIndex > 0 && savedIndex < items.length
      ? savedIndex
      : 0;

  const titleOf = useCallback(
    (item: Item) => {
      if (item.number === undefined) return t.introduction;
      return (isMandarin(item, language) && item.zhTitle) || item.title;
    },
    [language, t.introduction],
  );

  const load = useCallback(
    (index: number, lang: Language = language) => {
      const audio = audioRef.current;
      const item = items[index];
      const src = item ? sourceOf(item, lang) : null;
      if (!audio || !src) return;
      setFailed(false);
      setTime(0);
      setDuration(0);
      setCurrent(index);
      audio.src = src;
      audio.playbackRate = speed;
      audio.play().catch((error: unknown) => {
        // A newer load interrupting this one is normal.
        if ((error as Error).name !== "AbortError") setFailed(true);
      });
      writeProgress(progressKey, index);
    },
    [items, language, progressKey, speed],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (current === null) load(resumeIndex);
    else if (audio.paused) void audio.play().catch(() => setFailed(true));
    else audio.pause();
  }, [current, load, resumeIndex]);

  const step = useCallback(
    (delta: number) => {
      if (current === null) return;
      const next = current + delta;
      if (next >= 0 && next < items.length) load(next);
    },
    [current, items.length, load],
  );

  const ended = () => {
    if (current === null) return;
    if (current < items.length - 1) {
      const next = current + 1;
      load(next);
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      document.getElementById(`stop-${items[next]?.soundId}`)?.scrollIntoView({
        block: "center",
        behavior: reduced ? "auto" : "smooth",
      });
    } else {
      writeProgress(progressKey, null);
    }
  };

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    if (current !== null) load(current, next);
  };

  const changeSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  // Lock-screen and headset controls.
  const active = current === null ? null : (items[current] ?? null);
  useEffect(() => {
    if (!active || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: titleOf(active),
      artist: locale === "zh-tw" ? (tour.zhTitle ?? tour.title) : tour.title,
      album: "Gallery Atlas",
      artwork: active.artwork
        ? [
            {
              src: active.artwork.image.src,
              sizes: "843x843",
              type: "image/jpeg",
            },
          ]
        : [],
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
    navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
  }, [active, locale, step, titleOf, tour.title, tour.zhTitle]);

  const iconButton = cn(
    buttonStyles({ variant: "secondary", tone: "dark", size: "sm" }),
    "size-11 shrink-0 px-0",
  );
  const startLabel =
    resumeIndex > 0
      ? format(t.resume, { number: items[resumeIndex]?.number ?? resumeIndex })
      : t.start;

  return (
    <div className={cn(current !== null && "pb-40")}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        {current === null ? (
          <button type="button" onClick={toggle} className={buttonStyles()}>
            <Play aria-hidden="true" className="size-4" />
            {startLabel}
          </button>
        ) : null}
        {offersMandarin ? (
          <div role="group" aria-label={t.language} className="flex gap-1.5">
            {(["zh", "en"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={language === option}
                onClick={() => changeLanguage(option)}
                className={cn(
                  "min-h-10 rounded-full border px-4 text-sm transition-colors duration-200 ease-gallery",
                  language === option
                    ? "border-ink bg-ink text-paper"
                    : "border-ink/25 hover:border-ink",
                )}
              >
                {option === "zh" ? t.languageZh : t.languageEn}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <ol className="mt-10 border-t border-line">
        {items.map((item, index) => {
          const isCurrent = index === current;
          const title = titleOf(item);
          const mandarin = isMandarin(item, language);
          const artwork = item.artwork ?? null;
          return (
            <li
              key={item.soundId}
              id={`stop-${item.soundId}`}
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                "grid scroll-mt-24 grid-cols-[2.75rem_5.5rem_minmax(0,1fr)] gap-x-3 gap-y-5 border-b border-line py-8 transition-colors duration-500 ease-gallery sm:grid-cols-[3rem_9rem_minmax(0,1fr)] sm:gap-x-8",
                isCurrent && "bg-paper-deep/70 sm:-mx-4 sm:px-4",
              )}
            >
              {item.number !== undefined ? (
                <p
                  aria-hidden="true"
                  className="font-serif text-3xl leading-none text-muted tabular-nums"
                >
                  {String(item.number).padStart(2, "0")}
                </p>
              ) : null}

              {artwork ? (
                <div className="flex aspect-square items-center justify-center bg-paper-deep p-2 sm:p-3">
                  <ArtworkImage
                    image={artwork.image}
                    sizes="144px"
                    reveal={0}
                    className={`${fitClass(artwork.image.aspectRatio, 1)} shadow-[0_10px_18px_-10px_rgb(34_33_31/0.55)]`}
                    fallbackClassName="h-full w-full"
                  />
                </div>
              ) : null}

              <div className="col-span-3 min-w-0 sm:col-span-1 sm:col-start-3">
                <p className="text-xs tracking-[0.12em] text-muted uppercase">
                  {item.number === undefined
                    ? t.introduction
                    : format(t.stop, { number: item.number })}
                </p>
                <h2
                  lang={mandarin && item.zhTitle ? undefined : "en"}
                  className="mt-1 font-serif text-2xl leading-snug text-balance"
                >
                  {item.number === undefined ? tourTitle(tour, locale) : title}
                </h2>
                {artwork || item.gallery || item.code ? (
                  <p className="mt-1 text-sm text-muted">
                    {artwork ? <span lang="en">{artwork.artist}</span> : null}
                    {item.gallery ? (
                      <>
                        {artwork ? " · " : null}
                        {item.gallery.id ? (
                          <Link
                            href={localizePath(
                              locale,
                              `/galleries/${item.gallery.id}`,
                            )}
                            className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
                          >
                            {item.gallery.name}
                          </Link>
                        ) : (
                          item.gallery.name
                        )}
                      </>
                    ) : null}
                    {item.code ? (
                      <>
                        {artwork || item.gallery ? " · " : null}
                        {format(t.code, { code: item.code })}
                      </>
                    ) : null}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <button
                    type="button"
                    onClick={() => (isCurrent ? toggle() : load(index))}
                    aria-label={
                      isCurrent && playing ? t.pause : format(t.play, { title })
                    }
                    className={buttonStyles({
                      variant: "secondary",
                      size: "sm",
                    })}
                  >
                    {isCurrent && playing ? (
                      <Pause aria-hidden="true" className="size-4" />
                    ) : (
                      <Play aria-hidden="true" className="size-4" />
                    )}
                    {isCurrent && playing ? t.pause : t.resumePlayback}
                  </button>
                  {artwork ? (
                    <Link
                      href={localizePath(locale, `/artworks/${artwork.id}`)}
                      className="text-sm underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
                    >
                      {t.viewArtwork}
                    </Link>
                  ) : null}
                </div>

                <Transcript
                  soundId={item.soundId}
                  transcript={item.transcript}
                  chinese={mandarin}
                />
              </div>
            </li>
          );
        })}
      </ol>

      {/* One element for the whole tour; each stop's transcript is on the page. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={ended}
        onError={() => {
          if (current !== null) setFailed(true);
          setPlaying(false);
        }}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      />

      {active ? (
        <section
          aria-label={t.heading}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-gallery text-gallery-text"
        >
          <div className="mx-auto w-full max-w-[1440px] px-4 py-3 sm:px-8 lg:px-12">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={1}
              value={Math.min(time, duration || 0)}
              aria-label={t.seek}
              aria-valuetext={`${clock(time)} / ${clock(duration)}`}
              onChange={(event) => {
                const value = Number(event.target.value);
                setTime(value);
                if (audioRef.current) audioRef.current.currentTime = value;
              }}
              className="block h-6 w-full cursor-pointer accent-[#d6a77a]"
            />
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p
                  lang={isMandarin(active, language) ? undefined : "en"}
                  className="truncate font-serif text-lg"
                >
                  {titleOf(active)}
                </p>
                <p className="text-xs text-gallery-muted tabular-nums">
                  {clock(time)} / {clock(duration)}
                  {failed ? (
                    <span role="alert" className="ml-3 text-[#f1c9a8]">
                      {t.audioError}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={changeSpeed}
                  aria-label={format(t.speed, { rate: speed })}
                  className={cn(iconButton, "text-xs")}
                >
                  {speed}×
                </button>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={current === 0}
                  aria-label={t.previous}
                  className={iconButton}
                >
                  <SkipBack aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={playing ? t.pause : t.resumePlayback}
                  className={cn(
                    buttonStyles({ tone: "dark", size: "sm" }),
                    "size-11 shrink-0 px-0",
                  )}
                >
                  {playing ? (
                    <Pause aria-hidden="true" className="size-4" />
                  ) : (
                    <Play aria-hidden="true" className="size-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={current === items.length - 1}
                  aria-label={t.next}
                  className={iconButton}
                >
                  <SkipForward aria-hidden="true" className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function tourTitle(tour: Tour, locale: string): string {
  return locale === "zh-tw" ? (tour.zhTitle ?? tour.title) : tour.title;
}
