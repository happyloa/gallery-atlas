// Checks a deployed copy of the site: the parts only the production Worker has, which the
// end-to-end tests (dev server, fixture data) cannot reach.
//
//   node scripts/check-live.mjs https://gallery-atlas.example.workers.dev
const base = (process.argv[2] ?? process.env.SITE_URL ?? "").replace(/\/$/, "");
if (!base) throw new Error("Pass the site's origin");

const results = [];
const check = (name, ok, detail = "") =>
  results.push({ name, ok, detail: String(detail) });

const get = (path, headers = {}) =>
  fetch(base + path, {
    headers: { "User-Agent": "GalleryAtlas-check/0.1", ...headers },
    redirect: "manual",
  });

/** The request the client router sends when it navigates from `from`. */
const navigate = (path, from) =>
  get(`${path}?_rsc=${encodeURIComponent(from)}`, {
    RSC: "1",
    "X-Vinext-Rsc-State-Fingerprint": `check-${from}`,
  });

// A page is rendered once, then answered from the edge cache.
const first = await get("/en/about");
await first.arrayBuffer();
const second = await get("/en/about");
const html = await second.text();
check("page opens", second.status === 200, second.status);
check(
  "repeat request comes from the edge cache",
  second.headers.get("x-edge-cache") === "HIT",
  second.headers.get("x-edge-cache"),
);
check(
  "security headers are set",
  second.headers.get("x-content-type-options") === "nosniff" &&
    second.headers.has("referrer-policy"),
);

// In-site navigation shares one cached copy whichever page it starts from.
const fromHome = await navigate("/en/tours", "/en");
await fromHome.arrayBuffer();
const fromAbout = await navigate("/en/tours", "/en/about");
await fromAbout.arrayBuffer();
check(
  "navigation is a React payload",
  (fromAbout.headers.get("content-type") ?? "").startsWith("text/x-component"),
  `${fromAbout.status} ${fromAbout.headers.get("content-type")}`,
);
check(
  "navigation from another page hits the cache",
  fromAbout.headers.get("x-edge-cache") === "HIT",
  fromAbout.headers.get("x-edge-cache"),
);

const artwork = await get("/en/artworks/27992");
check("artwork page opens", artwork.status === 200, artwork.status);
await artwork.arrayBuffer();

const tracked = await get("/en/about?utm_source=check");
check(
  "tracking parameters are redirected away",
  tracked.status === 302 && tracked.headers.get("location") === "/en/about",
  `${tracked.status} ${tracked.headers.get("location")}`,
);

const asset = html.match(/\/_next\/static\/[^"']+\.js/)?.[0];
if (asset) {
  const response = await get(asset);
  check(
    "build assets are cached for a year",
    (response.headers.get("cache-control") ?? "").includes("immutable"),
    response.headers.get("cache-control"),
  );
} else check("build assets are cached for a year", false, "no script found");

const fontCss = await get("/fonts/noto-serif-tc.css");
check(
  "Chinese font stylesheet is deployed",
  fontCss.status === 200,
  fontCss.status,
);

const transcript = await get("/tour-transcripts/2179.json");
check(
  "Chinese transcripts are deployed",
  transcript.status === 200 &&
    Array.isArray((await transcript.json().catch(() => ({}))).paragraphs),
  transcript.status,
);

const missing = await get("/wp-login.php");
check(
  "a missing file is a plain 404",
  missing.status === 404 &&
    (missing.headers.get("content-type") ?? "").startsWith("text/plain"),
  `${missing.status} ${missing.headers.get("content-type")}`,
);

const sitemap = await (await get("/sitemap.xml")).text();
check(
  "sitemap has absolute https addresses",
  /<loc>https:\/\/[^<]+<\/loc>/.test(sitemap) && !/<loc>\//.test(sitemap),
);

for (const { name, ok, detail } of results)
  console.log(
    `${ok ? "OK  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`,
  );
if (results.some((result) => !result.ok)) process.exit(1);
