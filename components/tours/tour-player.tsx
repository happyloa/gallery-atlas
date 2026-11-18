"use client";

import Link from "next/link";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RefObject } from "react";
import { ArtworkImage } from "@/components/artwork/artwork-image";
import { buttonStyles } from "@/components/ui/button";
import { Pause, Play, SkipBack, SkipForward } from "@/components/ui/icons";
import { fitClass } from "@/lib/artwork/fit";
import type { Tour, TourRecording, TourStop } from "@/lib/artwork/types";
import { localizePath } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { planTourRooms } from "@/lib/tours/room-plan";
import type { RoomPlace } from "@/lib/tours/room-plan";
import { cn } from "@/lib/utils";
import { TourStage } from "./tour-stage";
import { Transcript } from "./transcript";

type Language = "zh" | "en";
type Item = TourRecording & Partial<Omit<TourStop, keyof TourRecording>>;
type AudioRef = RefObject<HTMLAudioElement | null>;

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

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

const sourceOf = (item: Item, language: Language) =>
  language === "zh" ? (item.zhSrc ?? item.src) : (item.src ?? item.zhSrc);
const isMandarin = (item: Item, language: Language) =>
  Boolean(item.zhSrc) && (language === "zh" || !item.src);
/** What a recording is called: the introduction has no title of its own. */
const titleOf = (item: Item, language: Language, introduction: string) =>
  item.number === undefined
    ? introduction
    : (isMandarin(item, language) && item.zhTitle) || item.title;

/* The playback clock. It ticks several times a second, so it lives in the two small
   components that show it, not in the player: a tick redraws a slider and a line of
   text, never the list of stops or the 3D stage. */

const CLOCK_EVENTS = [
  "timeupdate",
  "durationchange",
  "loadedmetadata",
  "seeking",
  "emptied",
] as const;

interface Clock {
  time: number;
  duration: number;
}

function useAudioClock(audioRef: AudioRef): [Clock, (time: number) => void] {
  const [clock, setClock] = useState<Clock>({ time: 0, duration: 0 });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const read = () => {
      const time = audio.currentTime;
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setClock((previous) =>
        previous.time === time && previous.duration === duration
          ? previous
          : { time, duration },
      );
    };
    for (const type of CLOCK_EVENTS) audio.addEventListener(type, read);
    read();
    return () => {
      for (const type of CLOCK_EVENTS) audio.removeEventListener(type, read);
    };
  }, [audioRef]);

  const seek = useCallback(
    (time: number) => {
      // Shown at once; the element's own events follow.
      setClock((previous) => ({ ...previous, time }));
      if (audioRef.current) audioRef.current.currentTime = time;
    },
    [audioRef],
  );

  return [clock, seek];
}

function SeekBar({ audioRef, label }: { audioRef: AudioRef; label: string }) {
  const [{ time, duration }, seek] = useAudioClock(audioRef);
  return (
    <input
      type="range"
      min={0}
      max={duration}
      step={1}
      value={Math.min(time, duration)}
      aria-label={label}
      aria-valuetext={`${formatClock(time)} / ${formatClock(duration)}`}
      onChange={(event) => seek(Number(event.target.value))}
      // 44px to take hold of; the negative margin keeps the bar as slim as it was.
      className="-my-2.5 block h-11 w-full cursor-pointer accent-[#d6a77a]"
    />
  );
}

function Elapsed({ audioRef }: { audioRef: AudioRef }) {
  const [{ time, duration }] = useAudioClock(audioRef);
  return (
    <>
      {formatClock(time)} / {formatClock(duration)}
    </>
  );
}

interface StopRowProps {
  item: Item;
  index: number;
  isCurrent: boolean;
  /** This stop is the one being heard right now. */
  playing: boolean;
  language: Language;
  /** Shown as the heading of the introduction. */
  tourHeading: string;
  /** The page has a gallery stage, which sticks above the list on small screens. */
  hasRoom: boolean;
  onPlay: (index: number) => void;
}

/**
 * One stop in the list. Memoised, with props that only change for the stop a change is
 * about: starting, pausing or moving on redraws one or two rows, not the whole tour.
 */
const StopRow = memo(function StopRow({
  item,
  index,
  isCurrent,
  playing,
  language,
  tourHeading,
  hasRoom,
  onPlay,
}: StopRowProps) {
  const { locale, dict } = useI18n();
  const t = dict.tours;
  const title = titleOf(item, language, t.introduction);
  const mandarin = isMandarin(item, language);
  const artwork = item.artwork ?? null;

  return (
    <li
      id={`stop-${item.soundId}`}
      data-tour-stop=""
      aria-current={isCurrent ? "true" : undefined}
      className={cn(
        "grid grid-cols-[2.75rem_5.5rem_minmax(0,1fr)] gap-x-3 gap-y-5 border-b border-line py-8 transition-colors duration-500 ease-gallery sm:grid-cols-[3rem_9rem_minmax(0,1fr)] sm:gap-x-8",
        hasRoom
          ? "scroll-mt-[calc(4rem+max(42svh,16rem)+1rem)] lg:scroll-mt-24 lg:grid-cols-[2.5rem_6rem_minmax(0,1fr)] lg:gap-x-5"
          : "scroll-mt-24",
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
          {item.number === undefined ? tourHeading : title}
        </h2>
        {artwork || item.gallery || item.code ? (
          <p className="mt-1 text-sm text-muted">
            {artwork ? <span lang="en">{artwork.artist}</span> : null}
            {item.gallery ? (
              <>
                {artwork ? " · " : null}
                {item.gallery.id ? (
                  <Link
                    href={localizePath(locale, `/galleries/${item.gallery.id}`)}
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
            onClick={() => onPlay(index)}
            aria-label={playing ? t.pause : format(t.play, { title })}
            className={buttonStyles({
              variant: "secondary",
              size: "sm",
            })}
          >
            {playing ? (
              <Pause aria-hidden="true" className="size-4" />
            ) : (
              <Play aria-hidden="true" className="size-4" />
            )}
            {playing ? t.pause : t.resumePlayback}
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
});

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
  const plan = useMemo(
    () => planTourRooms(items.map((item) => item.artwork)),
    [items],
  );
  const hasRoom = plan.rooms.length > 0;
  const [fullScreen, setFullScreen] = useState(false);

  const [language, setLanguage] = useState<Language>(
    offersMandarin ? "zh" : "en",
  );
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
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

  const load = useCallback(
    (index: number, lang: Language = language) => {
      const audio = audioRef.current;
      const item = items[index];
      const src = item ? sourceOf(item, lang) : null;
      if (!audio || !src) return;
      setFailed(false);
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

  /** Brings a stop into view in the list, clear of the stage above it on small screens. */
  const reveal = useCallback(
    (index: number) => {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      document.getElementById(`stop-${items[index]?.soundId}`)?.scrollIntoView({
        block: "start",
        behavior: reduced ? "auto" : "smooth",
      });
    },
    [items],
  );

  const step = useCallback(
    (delta: number) => {
      if (current === null) return;
      const next = current + delta;
      if (next < 0 || next >= items.length) return;
      load(next);
      reveal(next);
    },
    [current, items.length, load, reveal],
  );

  const ended = () => {
    if (current === null) return;
    if (current < items.length - 1) {
      load(current + 1);
      reveal(current + 1);
    } else {
      writeProgress(progressKey, null);
    }
  };

  /** A work clicked on the wall: go to the first stop about it. */
  const pickWork = (place: RoomPlace) => {
    const index = plan.places.findIndex(
      (p) => p?.room === place.room && p.work === place.work,
    );
    if (index < 0) return;
    load(index);
    reveal(index);
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

  // A stop's own play button. The rows are handed one function that never changes, so a
  // row is only redrawn when something about that row does; the ref holds what it should
  // do with the player as it stands now.
  const playStop = (index: number) => {
    if (index === current) toggle();
    else load(index);
  };
  const playStopRef = useRef(playStop);
  useEffect(() => {
    playStopRef.current = playStop;
  });
  const onPlayStop = useCallback(
    (index: number) => playStopRef.current(index),
    [],
  );

  // Lock-screen and headset controls.
  const active = current === null ? null : (items[current] ?? null);
  const tourHeading = tourTitle(tour, locale);
  useEffect(() => {
    if (!active || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: titleOf(active, language, t.introduction),
      artist: tourHeading,
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
  }, [active, language, step, t.introduction, tourHeading]);
  // Leaving the page: the tour must not linger on the lock screen, nor its buttons keep
  // pointing at a player that is gone.
  useEffect(
    () => () => {
      if (!("mediaSession" in navigator)) return;
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    },
    [],
  );

  const iconButton = cn(
    buttonStyles({ variant: "secondary", tone: "dark", size: "sm" }),
    "size-11 shrink-0 px-0",
  );
  const startLabel =
    resumeIndex > 0
      ? format(t.resume, { number: items[resumeIndex]?.number ?? resumeIndex })
      : t.start;

  // Before the tour starts the stage shows where it will pick up.
  const stageIndex = current ?? resumeIndex;
  const stageItem = items[stageIndex];
  const stagePlace = plan.anchors[stageIndex] ?? null;

  const list = (
    <div inert={fullScreen} className="min-w-0">
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
                  "min-h-11 rounded-full border px-4 text-sm transition-colors duration-200 ease-gallery",
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
        {items.map((item, index) => (
          <StopRow
            key={item.soundId}
            item={item}
            index={index}
            isCurrent={index === current}
            playing={index === current && playing}
            language={language}
            tourHeading={tourHeading}
            hasRoom={hasRoom}
            onPlay={onPlayStop}
          />
        ))}
      </ol>
    </div>
  );

  return (
    <div className={cn(current !== null && "pb-40")}>
      {stageItem && stagePlace ? (
        // A flex column on small screens: a sticky grid item could not leave its own row.
        <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
          <TourStage
            rooms={plan.rooms}
            place={stagePlace}
            showsWork={Boolean(stageItem.artwork)}
            stop={{
              label:
                stageItem.number === undefined
                  ? t.introduction
                  : format(t.stop, { number: stageItem.number }),
              title:
                stageItem.number === undefined
                  ? tourHeading
                  : titleOf(stageItem, language, t.introduction),
              titleInEnglish:
                stageItem.number === undefined
                  ? locale === "zh-tw" && !tour.zhTitle
                  : !isMandarin(stageItem, language) || !stageItem.zhTitle,
            }}
            started={current !== null}
            fullScreen={fullScreen}
            onFullScreenChange={setFullScreen}
            onPickWork={pickWork}
          />
          {list}
        </div>
      ) : (
        list
      )}

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
      />

      {active ? (
        <section
          aria-label={t.heading}
          data-tone="dark"
          // Stays in reach while the stage is full screen (see TourStage).
          data-tour-keep=""
          className={cn(
            "fixed inset-x-0 bottom-0 border-t border-white/10 bg-gallery text-gallery-text",
            fullScreen ? "z-[60]" : "z-30",
          )}
        >
          <div className="mx-auto w-full max-w-[1440px] px-4 py-3 sm:px-8 lg:px-12">
            <SeekBar audioRef={audioRef} label={t.seek} />
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p
                  lang={isMandarin(active, language) ? undefined : "en"}
                  className="truncate font-serif text-lg"
                >
                  {titleOf(active, language, t.introduction)}
                </p>
                <p className="text-xs text-gallery-muted tabular-nums">
                  <Elapsed audioRef={audioRef} />
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
