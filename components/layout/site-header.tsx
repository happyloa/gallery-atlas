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
  section: "home" | "collection" | "about",
): boolean {
  const rest = pathname.slice(`/${locale}`.length) || "/";
  if (section === "home") return rest === "/" || rest.startsWith("/artworks");
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


  const items = [
    {
      section: "home",
      href: localizePath(locale, "/"),
      label: dict.site.discover,
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
        "z-40 w-full",
        overHero
          ? "absolute inset-x-0 top-0 text-gallery-text"
          : "relative border-b border-line text-ink",
        overHero && open && "bg-gallery",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-paper focus:px-4 focus:py-2 focus:text-sm focus:text-ink"
      >
        {dict.site.skipToContent}
      </a>
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-5 sm:h-20 sm:px-8 lg:px-12">
        <Link
          href={localizePath(locale, "/")}
          className="group flex items-baseline gap-2 font-serif text-xl tracking-tight sm:text-2xl"
        >
          <span>Gallery Atlas</span>
          <span
            className={cn(
              "hidden font-sans text-[0.6875rem] tracking-[0.2em] uppercase sm:inline",
              overHero ? "text-gallery-muted" : "text-muted",
            )}
          >
            {dict.site.tagline}
          </span>
        </Link>

        <div className="flex items-center gap-6 md:gap-8">
          <nav aria-label={dict.site.primaryNav} className="hidden md:block">
            <ul className="flex items-center gap-8 text-sm">
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
          <LanguageSwitch overHero={overHero} />
          <button
            type="button"
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-full md:hidden"
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
          "border-t md:hidden",
          overHero ? "border-white/10 bg-gallery" : "border-line bg-paper",
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
