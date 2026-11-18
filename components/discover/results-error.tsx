"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Upstream failure while searching: say what happened and offer a retry. */
export function ResultsError({
  message,
  retryable,
}: {
  message: string;
  retryable: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <EmptyState
      className="py-16 sm:py-20"
      eyebrow="Couldn’t reach the collection"
      title="The museum’s collection didn’t answer just now."
      action={
        retryable ? (
          <Button
            onClick={() => startTransition(() => router.refresh())}
            disabled={isPending}
          >
            {isPending ? "Trying again…" : "Try again"}
          </Button>
        ) : null
      }
    >
      <p>{message} The rest of the site still works.</p>
    </EmptyState>
  );
}
