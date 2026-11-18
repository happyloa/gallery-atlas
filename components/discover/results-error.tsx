"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n/provider";

export type ResultsErrorReason = "rate_limited" | "timeout" | "generic";

/** Upstream failure while searching: say what happened and offer a retry. */
export function ResultsError({
  reason,
  retryable,
}: {
  reason: ResultsErrorReason;
  retryable: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.explore;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const message =
    reason === "rate_limited"
      ? t.errorRateLimited
      : reason === "timeout"
        ? t.errorTimeout
        : t.errorGeneric;

  return (
    <EmptyState
      className="py-16 sm:py-20"
      eyebrow={t.errorEyebrow}
      title={t.errorTitle}
      action={
        retryable ? (
          <Button
            onClick={() => startTransition(() => router.refresh())}
            disabled={isPending}
          >
            {isPending ? t.tryingAgain : t.tryAgain}
          </Button>
        ) : null
      }
    >
      <p>
        {message}
      </p>
    </EmptyState>
  );
}
