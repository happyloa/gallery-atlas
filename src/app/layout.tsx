import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Gallery Atlas",
    template: "%s · Gallery Atlas",
  },
  description:
    "An independent, thoughtfully designed space to discover, appreciate, and curate public-domain art.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
