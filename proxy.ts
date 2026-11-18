/**
 * Language routing. Every page lives under /en or /zh-tw. A request without a locale
 * prefix is redirected: to the language the visitor picked before (cookie), otherwise to
 * the best match for their browser's Accept-Language, otherwise English.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, negotiateLocale } from "@/lib/i18n/config";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";

  if (isLocale(first)) return NextResponse.next();

  const url = request.nextUrl.clone();
  // "/ZH-TW/about" → "/zh-tw/about": same page, canonical spelling.
  if (isLocale(first.toLowerCase())) {
    url.pathname = `/${first.toLowerCase()}${pathname.slice(first.length + 1)}`;
    return NextResponse.redirect(url, 308);
  }

  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved)
    ? saved
    : negotiateLocale(request.headers.get("accept-language"));
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  const response = NextResponse.redirect(url, 307);
  response.headers.set("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  // Everything except API routes, build assets and files with an extension (icon.svg, …).
  matcher: ["/((?!api/|_next/|.*\\.[\\w]+$).*)"],
};
