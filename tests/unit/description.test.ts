import { describe, expect, it } from "vitest";
import { decodeEntities, parseDescription } from "@/lib/artic/description";
import { toArtworkDetail } from "@/lib/artic/mapper";
import { IIIF_URL, rawArtwork, restrictedArtwork } from "../fixtures/aic";

describe("parseDescription", () => {
  it("turns the museum's paragraphs and <em> into plain runs", () => {
    const html =
      "<p>In <em>Ferris Bueller’s Day Off</em>, Cameron studies this painting.</p>\n<p>Second &amp; last.</p>";
    expect(parseDescription(html)).toEqual([
      [
        { text: "In ", italic: false },
        { text: "Ferris Bueller’s Day Off", italic: true },
        { text: ", Cameron studies this painting.", italic: false },
      ],
      [{ text: "Second & last.", italic: false }],
    ]);
  });

  it("keeps link text but not the link", () => {
    expect(
      parseDescription(
        '<p>See <a href="javascript:alert(1)">this work</a>.</p>',
      ),
    ).toEqual([[{ text: "See this work.", italic: false }]]);
  });

  it("drops script and style content and never returns markup", () => {
    const result = parseDescription(
      '<p>Safe<script>alert("x")</script><style>p{}</style> text<img src=x onerror=alert(1)></p>',
    );
    expect(result).toEqual([[{ text: "Safe text", italic: false }]]);
    expect(JSON.stringify(result)).not.toMatch(/[<>]/);
  });

  it("handles missing, empty and whitespace-only input", () => {
    expect(parseDescription(null)).toBeNull();
    expect(parseDescription("")).toBeNull();
    expect(parseDescription("<p> </p><p></p>")).toBeNull();
  });

  it("caps very long descriptions", () => {
    const html = Array.from(
      { length: 50 },
      (_, i) => `<p>${"word ".repeat(100)}${i}</p>`,
    ).join("");
    const result = parseDescription(html) ?? [];
    const characters = result
      .flat()
      .reduce((sum, run) => sum + run.text.length, 0);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(characters).toBeLessThanOrEqual(6000);
  });
});

describe("decodeEntities", () => {
  it("decodes named and numeric entities, and ignores invalid ones", () => {
    expect(
      decodeEntities("&ldquo;Ni&ntilde;a&rdquo; &#8212; &#x2014; &bogus; &#0;"),
    ).toBe("“Ni&ntilde;a” — — &bogus; ");
  });
});

describe("toArtworkDetail", () => {
  it("adds artist display, parsed description and the 1686px zoom image", () => {
    const detail = toArtworkDetail(
      rawArtwork({
        artist_display: "Katsushika Hokusai\nJapanese, 1760-1849",
        description: "<p>A <em>wave</em>.</p>",
      }),
      IIIF_URL,
    );
    expect(detail?.artistDisplay).toBe(
      "Katsushika Hokusai\nJapanese, 1760-1849",
    );
    expect(detail?.description).toEqual([
      [
        { text: "A ", italic: false },
        { text: "wave", italic: true },
        { text: ".", italic: false },
      ],
    ]);
    expect(detail?.zoomSrc).toMatch(/\/full\/1686,\/0\/default\.jpg$/);
  });

  it("follows the same display rule as cards", () => {
    expect(toArtworkDetail(restrictedArtwork(), IIIF_URL)).toBeNull();
  });
});
