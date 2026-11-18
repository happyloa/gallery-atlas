"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      headingLevel="h1"
      eyebrow="Something went wrong"
      title="This room didn’t open as expected."
      action={
        <>
          <Button onClick={reset}>Try again</Button>
          <Link href="/" className={buttonStyles({ variant: "secondary" })}>
            Back to Discover
          </Link>
        </>
      }
    >
      <p>
        The page hit an unexpected error. Trying again usually helps; if it
        keeps happening, come back a little later.
      </p>
    </EmptyState>
  );
}
