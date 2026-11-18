"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Menu, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Discover" },
  { href: "/collection", label: "My Collection" },
  { href: "/about", label: "About" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/artworks");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const menuId = useId();
  const [openFor, setOpenFor] = useState<string | null>(null);
  // The menu belongs to the page it was opened on, so navigating closes it.
  const open = openFor === pathname;
  // The homepage hero is a dark gallery room, so the header floats over it in light type.
  const overHero = pathname === "/";

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
        Skip to content
      </a>
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-5 sm:h-20 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="group flex items-baseline gap-2 font-serif text-xl tracking-tight sm:text-2xl"
        >
          <span>Gallery Atlas</span>
          <span
            className={cn(
              "hidden text-[0.6875rem] font-sans tracking-[0.2em] uppercase sm:inline",
              overHero ? "text-gallery-muted" : "text-muted",
            )}
          >
            Public-domain art
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8 text-sm">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
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

        <button
          type="button"
          className="-mr-2 inline-flex size-11 items-center justify-center rounded-full md:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpenFor(open ? null : pathname)}
        >
          {open ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>

      <nav
        id={menuId}
        aria-label="Primary"
        hidden={!open}
        className={cn(
          "border-t md:hidden",
          overHero ? "border-white/10 bg-gallery" : "border-line bg-paper",
        )}
      >
        <ul className="flex flex-col px-5 py-3 sm:px-8">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={
                  isActive(pathname, item.href) ? "page" : undefined
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
