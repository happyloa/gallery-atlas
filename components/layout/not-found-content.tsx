"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { localizePath } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/provider";

/** not-found.tsx receives no route params, so the locale comes from the layout's provider. */
export function NotFoundContent() {
  const { locale, dict } = useI18n();
  return (
    <EmptyState
      headingLevel="h1"
      eyebrow="404"
      title={dict.errors.notFoundTitle}
      action={
        <Link href={localizePath(locale, "/")} className={buttonStyles()}>
          {dict.errors.backToDiscover}
        </Link>
      }
    >
      <p>{dict.errors.notFoundBody}</p>
    </EmptyState>
  );
}

export function LoadingLabel() {
  const { dict } = useI18n();
  return (
    <p className="sr-only" role="status">
      {dict.explore.loading}
    </p>
  );
}
