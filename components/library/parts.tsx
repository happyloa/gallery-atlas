import Link from "next/link";
import type { ReactNode } from "react";
import { Pagination } from "@/components/discover/pagination";
import { buttonStyles } from "@/components/ui/button";
import { ArrowLeft, ArrowUpRight, Search } from "@/components/ui/icons";
import { EMPTY_QUERY } from "@/lib/artic/search-url";
import type { BodySection } from "@/lib/artic/records";
import type { TextRun } from "@/lib/artwork/types";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatCount } from "@/lib/i18n/format";
import { cn, EXTERNAL_REL } from "@/lib/utils";

export const eyebrowClass =
  "text-xs font-medium tracking-[0.18em] text-accent uppercase";

/** The opening of an index page. */
export function PageHeader({
  eyebrow,
  title,
  titleLang,
  children,
}: {
  eyebrow: string;
  title: string;
  titleLang?: string;
  children?: ReactNode;
}) {
  return (
    <header className="max-w-4xl animate-rise [animation-delay:calc(var(--intro-delay)+120ms)]">
      <p className={eyebrowClass}>{eyebrow}</p>
      <h1
        lang={titleLang}
        className="mt-5 font-serif text-5xl leading-[1.04] tracking-tight text-balance sm:text-6xl"
      >
        {title}
      </h1>
      {children}
    </header>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}

/** A keyword box that works as a plain GET form, with or without JavaScript. */
export function KeywordForm({
  action,
  label,
  placeholder,
  submit,
  value,
  hidden = {},
}: {
  action: string;
  label: string;
  placeholder: string;
  submit: string;
  value: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form
      role="search"
      action={action}
      className="flex w-full max-w-2xl items-center gap-2 border-b border-ink/40 pb-2 focus-within:border-ink"
    >
      <Search aria-hidden="true" className="size-5 shrink-0 text-muted" />
      <label className="min-w-0 flex-1">
        <span className="sr-only">{label}</span>
        <input
          type="search"
          name="q"
          defaultValue={value}
          placeholder={placeholder}
          maxLength={100}
          className="h-11 w-full bg-transparent text-lg outline-none placeholder:text-muted"
        />
      </label>
      {Object.entries(hidden).map(([name, val]) =>
        val ? <input key={name} type="hidden" name={name} value={val} /> : null,
      )}
      <button
        type="submit"
        className={buttonStyles({ variant: "secondary", size: "sm" })}
      >
        {submit}
      </button>
    </form>
  );
}

export interface ChipItem {
  key: string;
  href: string;
  label: string;
  active: boolean;
  count?: string;
  lang?: string;
}

/** A row of links that narrows the list below. */
export function FilterChips({
  label,
  items,
}: {
  label: string;
  items: ChipItem[];
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              prefetch={false}
              aria-current={item.active ? "true" : undefined}
              lang={item.lang}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-[0.8125rem] transition-colors duration-200 ease-gallery",
                item.active
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/20 text-ink hover:border-ink",
              )}
            >
              {item.label}
              {item.count ? (
                <span className={item.active ? "text-paper/75" : "text-muted"}>
                  {item.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Runs({ runs }: { runs: TextRun[] }) {
  return runs.map((run, index) =>
    run.italic ? <em key={index}>{run.text}</em> : run.text,
  );
}

/** Long-form text from the museum. */
export function RichBody({ sections }: { sections: BodySection[] }) {
  return (
    <div lang="en" className="max-w-2xl space-y-10">
      {sections.map((section, sectionIndex) => (
        <section key={sectionIndex}>
          {section.heading ? (
            <h2 className="mb-4 font-serif text-2xl">{section.heading}</h2>
          ) : null}
          <div className="space-y-5 font-serif text-lg leading-8 text-ink/90 sm:text-xl sm:leading-9">
            {section.paragraphs.map((paragraph, index) => (
              <p key={index}>
                <Runs runs={paragraph} />
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** A link that leaves this site, announced as such. */
export function OutLink({
  href,
  children,
  dict,
  className,
}: {
  href: string;
  children: ReactNode;
  dict: Dictionary;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel={EXTERNAL_REL}
      className={
        className ??
        "inline-flex items-center gap-2 border-b border-ink/30 pb-1 text-sm transition-colors duration-300 ease-gallery hover:border-ink"
      }
    >
      {children}
      <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
      <span className="sr-only">{dict.site.opensInNewTab}</span>
    </a>
  );
}

/** Where the text came from, with the notice the museum asks to keep. */
export function SourceNote({
  credit,
  href,
  label,
  dict,
}: {
  credit: string;
  href: string;
  label: string;
  dict: Dictionary;
}) {
  return (
    <div className="mt-14 flex max-w-2xl flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
      <p className="text-xs text-muted">{credit}</p>
      <OutLink href={href} dict={dict}>
        {label}
      </OutLink>
    </div>
  );
}

export function ListPagination({
  locale,
  dict,
  page,
  totalPages,
  hrefFor,
}: {
  locale: Locale;
  dict: Dictionary;
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  return (
    <Pagination
      locale={locale}
      dict={dict}
      query={{ ...EMPTY_QUERY, page }}
      totalPages={totalPages}
      hrefFor={hrefFor}
    />
  );
}

/** "24 results" in the visitor's number format. */
export function ResultCount({
  total,
  locale,
  dict,
}: {
  total: number;
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <p role="status" className="text-sm text-muted">
      {formatCount(
        dict.common.countOne,
        dict.common.count,
        total,
        new Intl.NumberFormat(LOCALE_TAGS[locale]).format(total),
      )}
    </p>
  );
}

/** A plain ruled list of links, like the index at the back of a book. */
export function IndexList({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-line border-y border-line">{children}</ul>
  );
}

export const indexLinkClass =
  "group flex items-baseline justify-between gap-6 py-5 transition-colors duration-200 ease-gallery";
export const indexTitleClass =
  "block font-serif text-xl leading-snug group-hover:underline group-hover:underline-offset-4 sm:text-2xl";
