"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { localizePath } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/provider";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.errors;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      headingLevel="h1"
      eyebrow={t.eyebrow}
      title={t.title}
      action={
        <>
          <Button onClick={reset}>{t.tryAgain}</Button>
          <Link
            href={localizePath(locale, "/")}
            className={buttonStyles({ variant: "secondary" })}
          >
            {t.backToDiscover}
          </Link>
        </>
      }
    >
    </EmptyState>
  );
}
