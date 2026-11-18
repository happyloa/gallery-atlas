// Self-hosts Noto Serif TC. Google splits the font into a few hundred unicode-range slices, so
// its @font-face rules are large enough to belong in a stylesheet of their own.
//
//   node scripts/build-fonts.mjs   writes public/fonts/ (not committed)
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";

const CSS_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400..600&display=swap";
// Google only sends woff2 to browsers it recognises.
const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const OUT = "public/fonts";
const FILES = `${OUT}/noto-serif-tc`;
const CONCURRENCY = 8;
const ATTEMPTS = 3;

async function download(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": BROWSER },
      });
      if (!response.ok) throw new Error(`${url} answered ${response.status}`);
      return response;
    } catch (error) {
      if (attempt === ATTEMPTS) throw error;
    }
  }
}

const css = await (await download(CSS_URL)).text();
const urls = [...new Set(css.match(/https:[^)'"]+\.woff2/g) ?? [])];
if (urls.length === 0) throw new Error("Google Fonts sent no woff2 files");

const nameOf = (url) =>
  `${createHash("sha256").update(url).digest("hex").slice(0, 16)}.woff2`;

mkdirSync(FILES, { recursive: true });
const wanted = new Set(urls.map(nameOf));
for (const file of readdirSync(FILES))
  if (!wanted.has(file)) rmSync(`${FILES}/${file}`);

const queue = urls.filter((url) => !existsSync(`${FILES}/${nameOf(url)}`));
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let url = queue.pop(); url; url = queue.pop()) {
      const bytes = await (await download(url)).arrayBuffer();
      writeFileSync(`${FILES}/${nameOf(url)}`, Buffer.from(bytes));
    }
  }),
);

writeFileSync(
  `${OUT}/noto-serif-tc.css`,
  css.replace(/https:[^)'"]+\.woff2/g, (url) => `noto-serif-tc/${nameOf(url)}`),
);
console.log(`Noto Serif TC: ${urls.length} files in ${FILES}`);
