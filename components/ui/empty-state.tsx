import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Heading level; pages that already have an h1 use h2. */
  headingLevel?: "h1" | "h2";
}

/** A bare wall with a single label: used for empty collections, missing pages and errors. */
export function EmptyState({
  eyebrow,
  title,
  children,
  action,
  className,
  headingLevel = "h2",
}: EmptyStateProps) {
  const Heading = headingLevel;

  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-20 text-center sm:py-28",
        className,
      )}
    >
      <div
        className="mb-10 h-40 w-32 border border-ink/15 bg-paper-deep shadow-[0_24px_40px_-28px_rgb(34_33_31/0.45)] sm:h-48 sm:w-40"
        aria-hidden="true"
      />
      {eyebrow ? (
        <p className="mb-3 text-xs font-medium tracking-[0.18em] text-accent uppercase">
          {eyebrow}
        </p>
      ) : null}
      <Heading className="max-w-xl font-serif text-3xl leading-tight text-ink sm:text-4xl">
        {title}
      </Heading>
      {children ? (
        <div className="mt-4 max-w-md text-base leading-7 text-muted">
          {children}
        </div>
      ) : null}
      {action ? (
        <div className="mt-8 flex flex-wrap justify-center gap-3">{action}</div>
      ) : null}
    </div>
  );
}
