"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronRight, Menu, Search, X } from "@/components/ui/icons";
import { localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { LanguageSwitch } from "./language-switch";

function isActive(pathname: string, locale: Locale, section: string): boolean {
  const rest = pathname.slice(`/${locale}`.length) || "/";
  if (section === "home") return rest === "/" || rest.startsWith("/artworks");
  return rest === `/${section}` || rest.startsWith(`/${section}/`);
}

const desktopLink = (active: boolean) =>
  cn(
    "relative py-2 transition-opacity duration-200 ease-gallery hover:opacity-100",
    active ? "opacity-100" : "opacity-75",
    "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-current after:transition-transform after:duration-200",
    active ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
  );

export function SiteHeader() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  // The menu belongs to the page it was opened on, so navigating closes it.
  const open = openFor === pathname;
  // The homepage hero is a dark gallery room, so the header floats over it in light type.
  const overHero = pathname === `/${locale}`;
  const scrolled = useScrolled();
  // Light type on the dark room until the page scrolls; then a frosted paper bar.
  const dark = overHero && !scrolled;

  const primary = [
    {
      section: "home",
      href: localizePath(locale, "/"),
      label: dict.site.discover,
    },
    {
      section: "exhibitions",
      href: localizePath(locale, "/exhibitions"),
      label: dict.site.exhibitions,
    },
    {
      section: "galleries",
      href: localizePath(locale, "/galleries"),
      label: dict.site.galleries,
    },
    {
      section: "tours",
      href: localizePath(locale, "/tours"),
      label: dict.site.tours,
    },
    {
      section: "events",
      href: localizePath(locale, "/events"),
      label: dict.nav.events,
    },
    {
      section: "read",
      href: localizePath(locale, "/read"),
      label: dict.nav.read,
    },
    {
      section: "collection",
      href: localizePath(locale, "/collection"),
      label: dict.site.collection,
    },
  ];
  const secondary = [
    {
      section: "artists",
      href: localizePath(locale, "/artists"),
      label: dict.nav.artists,
    },
    {
      section: "browse",
      href: localizePath(locale, "/browse"),
      label: dict.nav.browse,
    },
    {
      section: "map",
      href: localizePath(locale, "/map"),
      label: dict.site.map,
    },
    {
      section: "media",
      href: localizePath(locale, "/media"),
      label: dict.nav.media,
    },
    {
      section: "visit",
      href: localizePath(locale, "/visit"),
      label: dict.nav.visit,
    },
    {
      section: "shop",
      href: localizePath(locale, "/shop"),
      label: dict.nav.shop,
    },
    {
      section: "about",
      href: localizePath(locale, "/about"),
      label: dict.site.about,
    },
  ];
  const searchPath = localizePath(locale, "/search");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenFor(null);
      // The links are about to be hidden; focus goes back to the button that opened them.
      menuButton.current?.focus();
    };
    // The menu is only shown below the xl breakpoint (80rem).
    const wide = window.matchMedia("(min-width: 80rem)");
    const onWide = () => {
      if (wide.matches) setOpenFor(null);
    };
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    // Hold the page behind still (Lenis follows this too). The gutter keeps the width the
    // scrollbar took, so nothing shifts sideways.
    const root = document.documentElement;
    const previous = {
      overflow: root.style.overflow,
      gutter: root.style.scrollbarGutter,
    };
    root.style.overflow = "hidden";
    root.style.scrollbarGutter = "stable";
    return () => {
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      root.style.overflow = previous.overflow;
      root.style.scrollbarGutter = previous.gutter;
    };
  }, [open]);

  return (
    <header
      data-tone={dark ? "dark" : undefined}
      className={cn(
        "top-0 z-40 w-full animate-fade-in transition-[background-color,color,border-color,backdrop-filter] duration-500 ease-gallery [animation-delay:calc(var(--intro-delay)+200ms)]",
        overHero ? "fixed inset-x-0" : "sticky",
        dark
          ? "border-b border-transparent text-gallery-text"
          : "border-b border-line bg-paper/85 text-ink backdrop-blur-md",
        dark && open && "bg-gallery",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-paper focus:px-4 focus:py-2 focus:text-sm focus:text-ink"
      >
        {dict.site.skipToContent}
      </a>
      <div
        className={cn(
          "mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-5 transition-[height] duration-500 ease-gallery sm:px-8 lg:px-12",
          scrolled ? "sm:h-16" : "sm:h-20",
        )}
      >
        <Link
          href={localizePath(locale, "/")}
          className="group flex items-baseline gap-2 font-serif text-xl tracking-tight sm:text-2xl"
        >
          <span>Gallery Atlas</span>
          <span
            className={cn(
              "hidden font-sans text-[0.6875rem] tracking-[0.2em] uppercase sm:inline xl:hidden 2xl:inline",
              dark ? "text-gallery-muted" : "text-muted",
            )}
          >
            {dict.site.tagline}
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-5 xl:gap-6">
          <nav aria-label={dict.site.primaryNav} className="hidden xl:block">
            <ul className="flex items-center gap-6 text-sm">
              {primary.map((item) => {
                const active = isActive(pathname, locale, item.section);
                return (
                  <li key={item.section}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={desktopLink(active)}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <MoreMenu
                  key={pathname}
                  label={dict.nav.more}
                  items={secondary}
                  isCurrent={(section) => isActive(pathname, locale, section)}
                />
              </li>
            </ul>
          </nav>
          <Link
            href={searchPath}
            aria-current={pathname === searchPath ? "page" : undefined}
            className="inline-flex size-11 items-center justify-center rounded-full opacity-80 transition-opacity duration-200 ease-gallery hover:opacity-100"
          >
            <Search className="size-5" />
            <span className="sr-only">{dict.nav.search}</span>
          </Link>
          <LanguageSwitch overHero={dark} />
          <button
            ref={menuButton}
            type="button"
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-full xl:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpenFor(open ? null : pathname)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
            <span className="sr-only">
              {open ? dict.site.closeMenu : dict.site.openMenu}
            </span>
          </button>
        </div>
      </div>

      <nav
        id={menuId}
        aria-label={dict.site.primaryNav}
        hidden={!open}
        // Its own scrolling is native; Lenis leaves wheel events in here alone.
        data-lenis-prevent=""
        className={cn(
          // Never taller than the screen below the bar: on a short viewport the list scrolls
          // instead of running off the bottom, where a fixed header could not follow.
          "max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t sm:max-h-[calc(100dvh-5rem)] xl:hidden",
          dark ? "border-white/10 bg-gallery" : "border-line bg-paper",
        )}
      >
        <ul className="flex flex-col px-5 py-3 sm:px-8">
          {primary.map((item) => (
            <li key={item.section}>
              <Link
                href={item.href}
                aria-current={
                  isActive(pathname, locale, item.section) ? "page" : undefined
                }
                className="block py-2.5 font-serif text-2xl"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="grid grid-cols-2 gap-x-6 border-t border-current/10 px-5 py-4 sm:px-8">
          {secondary.map((item) => (
            <li key={item.section}>
              <Link
                href={item.href}
                aria-current={
                  isActive(pathname, locale, item.section) ? "page" : undefined
                }
                className="block py-2.5 text-base"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

/** The rest of the site, folded under one word in the desktop header. */
function MoreMenu({
  label,
  items,
  isCurrent,
}: {
  label: string;
  items: { section: string; href: string; label: string }[];
  isCurrent: (section: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = items.some((item) => isCurrent(item.section));

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Focus may be on a link that is about to be hidden.
      trigger.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          desktopLink(active || open),
          "inline-flex items-center gap-1",
        )}
      >
        {label}
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-3.5 transition-transform duration-200 ease-gallery",
            open ? "-rotate-90" : "rotate-90",
          )}
        />
      </button>
      <ul
        id={menuId}
        hidden={!open}
        // A paper panel, even when the header around it is in its dark state.
        data-tone="light"
        className="absolute top-full right-0 z-50 mt-3 w-44 border border-line bg-paper py-2 text-ink shadow-[0_18px_30px_-18px_rgb(34_33_31/0.45)]"
      >
        {items.map((item) => (
          <li key={item.section}>
            <Link
              href={item.href}
              aria-current={isCurrent(item.section) ? "page" : undefined}
              className={cn(
                "block px-4 py-2 text-sm hover:bg-ink/5",
                isCurrent(item.section) && "font-medium",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Whether the page has scrolled away from the very top. */
function useScrolled(threshold = 24): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [threshold]);
  return scrolled;
}
