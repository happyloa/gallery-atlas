import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "My Collection",
  description:
    "Your saved artworks and personal exhibitions, kept in this browser.",
  robots: { index: false },
};

export default function CollectionPage() {
  return (
    <Container className="pt-16 sm:pt-24">
      <h1 className="font-serif text-4xl sm:text-6xl">My Collection</h1>
      <EmptyState
        title="Your walls are still bare."
        action={
          <Link href="/#explore" className={buttonStyles()}>
            Explore the collection
          </Link>
        }
      >
        <p>
          Favorites and personal exhibitions will live here. They&apos;re saved
          in this browser only, so they won&apos;t follow you to another device.
        </p>
      </EmptyState>
    </Container>
  );
}
