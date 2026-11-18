import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <EmptyState
      headingLevel="h1"
      eyebrow="404"
      title="There’s nothing hanging here."
      action={
        <Link href="/" className={buttonStyles()}>
          Back to Discover
        </Link>
      }
    >
      <p>The page may have moved, or the address has a typo.</p>
    </EmptyState>
  );
}
