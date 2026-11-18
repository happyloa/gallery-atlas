"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Menu, X } from "@/components/ui/icons";
import { localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { LanguageSwitch } from "./language-switch";

function isActive(
  pathname: string,
  locale: Locale,
  section: "home" | "exhibitions" | "map" | "collection" | "about",
): boolean {
  const rest = pathname.slice(`/${locale}`.length) || "/";
  if (section === "home")
    return (
      rest === "/" ||
      rest.startsWith("/artworks") ||
      rest.startsWith("/artists") ||
      rest.startsWith("/galleries")
    );
  return rest === `/${section}` || rest.startsWith(`/${section}/`);
}

export function SiteHeader() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const menuId = useId();
  const [openFor, setOpenFor] = useState<string | null>(null);
  // The menu belongs to the page it was opened on, so navigating closes it.
  const open = openFor === pathname;
  // The homepage hero is a dark gallery room, so the header floats over it in light type.
  const overHero = pathname === `/${locale}`;
  const scrolled = useScrolled();
  // Light type on the dark room until the page scrolls; then a frosted paper bar.
  const dark = overHero && !scrolled;


  const items = [
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
      section: "map",
      href: localizePath(locale, "/map"),
      label: dict.site.map,
    },
    {
      section: "collection",
      href: localizePath(locale, "/collection"),
      label: dict.site.collection,
    },
    {
      section: "about",
      href: localizePath(locale, "/about"),
      label: dict.site.about,
    },
  ] as const;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);


  return (
    <header
      className={cn(
        "top-0 z-40 w-full animate-fade-in transition-[background-color,color,border-color,backdrop-filter] duration-500 ease-gallery [animation-delay:calc(var(--intro-delay)+200ms)]",
        overHero
          ? "fixed inset-x-0"
          : "sticky",
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
              "hidden font-sans text-[0.6875rem] tracking-[0.2em] uppercase sm:inline",
              dark ? "text-gallery-muted" : "text-muted",
            )}
          >
            {dict.site.tagline}
          </span>
        </Link>

        <div className="flex items-center gap-6 lg:gap-8">
          <nav aria-label={dict.site.primaryNav} className="hidden lg:block">
            <ul className="flex items-center gap-7 text-sm">
              {items.map((item) => {
                const active = isActive(pathname, locale, item.section);
                return (
                  <li key={item.section}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative py-2 transition-opacity duration-200 ease-gallery hover:opacity-100",
                        active ? "opacity-100" : "opacity-75",
                        "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-current after:transition-transform after:duration-200",
                        active
                          ? "after:scale-x-100"
                          : "after:scale-x-0 hover:after:scale-x-100",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <LanguageSwitch overHero={dark} />
          <button
            type="button"
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-full lg:hidden"
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
        className={cn(
          "border-t lg:hidden",
          dark ? "border-white/10 bg-gallery" : "border-line bg-paper",
        )}
      >
        <ul className="flex flex-col px-5 py-3 sm:px-8">
          {items.map((item) => (
            <li key={item.section}>
              <Link
                href={item.href}
                aria-current={
                  isActive(pathname, locale, item.section) ? "page" : undefined
                }
                className="block py-3 font-serif text-2xl"
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
