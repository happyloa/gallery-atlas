# Gallery Atlas

[![CI](https://github.com/happyloa/gallery-atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/happyloa/gallery-atlas/actions/workflows/ci.yml)

瀏覽、欣賞、收藏公有領域藝術作品的網站。作品資料與圖片來自芝加哥藝術博物館（Art Institute of Chicago）的公開 API。

> An independent, thoughtfully designed space to discover, appreciate, and curate public-domain art.

網站：<https://gallery-atlas.piafyoyo06.workers.dev>（Cloudflare Workers）。介面有英文與繁體中文。

技術：vinext（在 Vite 上執行的 Next.js App Router API）、React 19、TypeScript（strict）、Tailwind CSS v4、three.js，部署在 Cloudflare Workers。

> This is an independent project and is not affiliated with the Art Institute of Chicago.
> 本站為個人作品，與芝加哥藝術博物館無關。

## 功能

- 首頁是一間 three.js 展廳，掛著館方精選的公有領域作品，照實際尺寸掛牆，每件有自己的投射燈。可以點畫、用按鈕或鍵盤換下一件。入口牆的門後面還有一間燈光調暗的展廳。
- 首頁的「參觀路線」：八個策展入口（印象派、日本藝術、古埃及、女性藝術家等，各附一件封面作品），依年代的長條圖，依主色的色票。件數都是即時從館方 API 算的，點下去就是篩好的館藏。
- 搜尋館藏（英文關鍵字），可以依類型、年代、主色篩選，也能用館方的風格、主題、專題標籤篩選，條件可以疊加。條件都寫在網址裡，重新整理、分享連結、上一頁都會還原。
- 作品詳情頁：大圖、完整圖片檢視、作品資料、館方的作品說明（CC BY 4.0）。另外列出目前有沒有在芝加哥展出、主色、風格與主題標籤、館藏紀錄（銘文、流傳經過、展覽與出版紀錄），以及同一位藝術家的其他作品。
- 藝術家頁（`/[lang]/artists/[id]`）：生卒年、館方的藝術家介紹（CC BY 4.0）、這位藝術家所有公有領域作品，可分頁。
- 收藏作品，以及自訂展覽（建立、改名、刪除、加入與移除作品）。資料存在瀏覽器，不需要帳號。
- 英文與繁體中文介面，中文字型用 Noto Serif TC。
- 動態參考藝術銀行網站：首次載入的開場幕簾、捲動時內容浮入、作品圖由下往上揭開、說明文字隨捲動逐字亮起、Lenis 平滑捲動。
- 手機、平板、桌機都能用；鍵盤可以操作所有功能；開啟「減少動態效果」時沒有進場動畫、鏡頭漂移和平滑捲動。

截圖：開發環境和自動化瀏覽器都連不到館方的 IIIF 圖片伺服器（見「已知問題」），截不到真實的作品圖，所以暫時沒有附截圖。

## 開發

需要 Node.js 22 以上（開發時用 26）。

```bash
npm install
npm run dev          # 開發伺服器，http://localhost:5173
npm run build        # 建置 Cloudflare Worker
npm run start        # 在本機 workerd 預覽建置結果
npm run deploy       # 部署到 Cloudflare Workers
```

### 環境變數

都只在伺服器端使用，範本見 `.env.example`。

| 變數                | 用途                                                                                                | 本機開發 |
| ------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| `AIC_CONTACT_EMAIL` | 放進送給館方 API 的 `AIC-User-Agent` 標頭，館方要求附上聯絡方式。正式上線請填有效的公開信箱。       | 可不填   |
| `SITE_URL`          | 網站的正式網址，用來產生 Open Graph、hreflang、`sitemap.xml`、`robots.txt` 裡的完整網址。           | 可不填   |
| `AIC_FIXTURES`      | 設為 `1` 時，`vite dev` 改用本機假資料，不連館方 API。只有 dev server 會讀，`vite build` 一律忽略。 | 選用     |

## 測試

```bash
npm run lint
npm run typecheck
npm test             # 單元、整合與元件測試（Vitest），上游 API 全部 mock
npm run test:smoke   # 打真實館方 API 的 smoke test，需要網路
npm run test:e2e     # Playwright E2E 與 axe 無障礙掃描
```

- 單元與整合測試涵蓋館方 API 的各種回應（沒有 `image_id`、非公有領域、429、5xx、逾時、不是 JSON）、搜尋參數驗證、年代與主色的歸類、請求網址長度上限、館藏紀錄與標籤的整理、首頁統計、IIIF 網址、作品說明解析、localStorage 的損毀與舊版資料、展覽的上限與重複、字典的中英一致性、JSON-LD 跳脫。
- E2E 會自己用 `AIC_FIXTURES=1 vite dev`（port 5174）啟動伺服器，館方 API 改由 `lib/artic/dev-fixtures.ts` 的本機資料回應，IIIF 圖片在瀏覽器端攔截，所以結果不受館方伺服器影響。vinext 同一個專案只允許一個 dev server，跑 E2E 前要先停掉 `npm run dev`。
- 無障礙掃描用 axe（WCAG 2.2 A／AA），範圍是中英文的首頁、搜尋、多重篩選後的探索區、作品頁、受限作品、藝術家頁、About、404、我的收藏、展覽頁，以及三個對話框打開時的狀態。掃描前會等進場動畫跑完，避免量到淡入到一半的文字。

### CI

GitHub Actions（`.github/workflows/`）：

- `ci.yml`：每次 push 到 `main` 和 PR 時執行。一個 job 跑 `npm ci` → lint → typecheck → 單元測試 → build，另一個 job 跑 E2E；E2E 失敗時會上傳 Playwright 報告。
- `smoke.yml`：每週一次與手動觸發，打真實館方 API。和主要 CI 分開，館方暫時出問題不會擋住合併。

## 架構

```text
app/
  [lang]/                    # /en 與 /zh-tw 底下的所有頁面
    layout.tsx               # html lang、字型、導覽列、頁尾、字典 Provider
    template.tsx             # 換頁時淡入
    page.tsx                 # 首頁：3D 展廳、參觀須知、參觀路線、探索館藏
    artworks/[id]/page.tsx   # 作品詳情
    artists/[id]/page.tsx    # 藝術家
    collection/page.tsx      # 我的收藏與展覽列表
    collection/[exhibitionId]/page.tsx
    about/page.tsx
  api/artworks/              # 搜尋、批次 ids、單件作品（route handlers）
  robots.ts, sitemap.ts
proxy.ts                     # 沒有語言前綴的網址導向 /en 或 /zh-tw
components/
  gallery-room/              # three.js 展廳（場景、燈光、牆面、作品、鏡頭、點選）
  discover/                  # 首頁 hero、參觀須知、參觀路線、搜尋與篩選、結果、分頁
  artwork/                   # 作品卡片、作品牆、圖片、完整圖片對話框、作品頁的延伸區塊
  collections/               # 收藏按鈕、收藏牆、展覽
  motion/                    # 開場幕簾、捲動進場、Lenis
  layout/, ui/               # 導覽列、頁尾、按鈕、對話框、圖示
lib/
  artic/                     # 館方 API：client、schema、mapper、查詢、篩選、首頁統計、圖片網址
  collections/               # localStorage 的 schema、讀寫、hooks
  i18n/                      # 語言設定、字典
  motion/, text/             # 共用的 IntersectionObserver、逐字切分
tests/                       # Vitest（unit、component、smoke）
e2e/                         # Playwright
```

資料流：瀏覽器只跟本站溝通。頁面在伺服器端呼叫 `lib/artic`，它向館方 API 取資料、用 Zod 驗證、判斷能不能展示，再轉成網站自己的 `Artwork` 型別。收藏與展覽只存 id，顯示時由 `/api/artworks?ids=` 在伺服器端重新檢查。

## 資料來源與授權

- API：[Art Institute of Chicago API](https://api.artic.edu/docs/)，圖片走館方的 IIIF Image API。所有對館方的請求都由伺服器端發出，館方對匿名請求的限制是每分鐘 60 次。
- 只顯示 `is_public_domain` 為 `true` 且有 `image_id` 的作品圖片。圖片直接連結館方 IIIF，不下載到本 repo。
- 作品 metadata 為 CC0；作品與藝術家的 `description` 欄位是 CC BY 4.0，網站上顯示時都會標示出處。圖片的使用以館方的 [Image Licensing](https://www.artic.edu/image-licensing) 與 [Terms](https://www.artic.edu/terms) 為準。
- 網站上的來源標示：Image and artwork data courtesy of the Art Institute of Chicago。
- 不提供高解析圖下載。
- 本 repo 的程式碼目前還沒有選定開源授權。

## 部署

正式站是 Cloudflare Workers 上的 `gallery-atlas` Worker，設定在 `cloudflare.config.ts`。

1. 登入 Cloudflare：`npx cf auth login`；CI 等非互動環境改用 `CLOUDFLARE_API_TOKEN`（Edit Cloudflare Workers 範本）。
2. 設定兩個 secret（不放在 repo 裡），每個指令會提示輸入值：

   ```bash
   npx cf workers secrets update AIC_CONTACT_EMAIL --worker gallery-atlas --type secret_text
   npx cf workers secrets update SITE_URL --worker gallery-atlas --type secret_text
   ```

3. `npm run deploy`：先建置再部署。`cloudflare.config.ts` 裡的 `bindings.kv()` 第一次部署時會自動建立 KV namespace（`gallery-atlas-vinext-kv-cache`），之後沿用。

要讓 GitHub 推送後自動部署，到 Cloudflare 後台 Workers & Pages → gallery-atlas → Settings → Builds 連上這個 repo 的 `main`，Build command 留空，Deploy command 填 `npm run deploy`，非 production 分支的 Preview command 填 `npx vinext-cloudflare previews deploy`。連上之後，push 到 `main` 就會部署到正式站。

## 實作進度

| 階段    | 內容                                   | 狀態 |
| ------- | -------------------------------------- | ---- |
| Phase 0 | 專案初始化、lint、型別檢查、建置       | 完成 |
| Phase 1 | 版面、設計 token、共用元件、About      | 完成 |
| Phase 2 | 館方 API 串接、搜尋、篩選、分頁        | 完成 |
| Phase 3 | 中英雙語、作品詳情、收藏、E2E          | 完成 |
| Phase 4 | 自訂策展清單                           | 完成 |
| Phase 5 | 無障礙、SEO、README、GitHub Actions CI | 完成 |
| Phase 6 | 部署到 Cloudflare Workers、正式站驗證  | 完成 |

規格完成後另外加了：動態效果、3D 展間的隔壁房間、藝術家頁、年代與主色篩選、標籤篩選、作品頁的館藏紀錄、首頁的參觀路線。

## 技術決策

- 用 vinext 而不用 Next.js 加 OpenNext：要部署到 Cloudflare Workers，vinext 原生支援，建置也比較輕。程式碼照 Next.js App Router 的寫法，萬一碰到 vinext 解決不了的相容問題，可以換回 Next.js 加 OpenNext。
- vinext 的 `next/image` 沒有建置期圖片最佳化，作品圖直接用館方 IIIF 的固定尺寸，加上 lazy loading。圖片框依館方提供的長寬比排版，和實際載入哪個尺寸的檔案無關。
- 館方 API 的快取放在 Cloudflare KV（`@vinext/cloudflare` 的 `kvDataAdapter`，binding 是 `VINEXT_KV_CACHE`），Worker 的各個 isolate 共用同一份。沒有用 Cloudflare Images。
- 程式碼直接放在根目錄的 `app/`、`components/`、`lib/`，路徑別名 `@/*` 指向專案根目錄。
- 首頁 hero 是一間 three.js 展廳（`components/gallery-room/`）：作品照實際尺寸掛在牆上，每件有自己的投射燈，房間光照在瀏覽器裡預先烘焙。canvas 只是裝飾，標題、牆面標籤和上一件／下一件按鈕都在 HTML。沒有 WebGL 時保留靜態版面；開啟減少動態效果時不做鏡頭漂移，換作品直接切過去。
- three.js 與展廳程式在獨立的 chunk（gzip 約 141 KB），進到頁面後才載入，不在首屏 JS 裡。
- 圖示是自己畫的 inline SVG（`components/ui/icons.tsx`），沒有用 lucide-react。在 Workers 上 lucide-react 會被打包成循環依賴的 server chunk，執行時 React 還沒載入，每一頁都回 500。
- 次要文字的灰色從規格的 `#77736E` 改成 `#6B6762`：原本在紙色背景上對比只有 4.2:1，改後 5.0:1，符合 WCAG AA。
- 字型：標題 Newsreader，內文 Instrument Sans，中文 Noto Serif TC。build 時自行託管，中文字型切成 unicode-range 小檔，頁面只下載用到的字。
- 捲動進場的隱藏狀態寫在 CSS，只在 `@media (scripting: enabled)` 而且沒有要求減少動態時生效，所以沒有 JavaScript 時內容照常顯示；頁面四秒內沒有 hydrate 也會自動顯示。全頁共用一個 IntersectionObserver。圖片揭開用 `clip-path`，觀察的是圖片外框：Chromium 計算交集時會算進元素自己的 `clip-path`，直接觀察完全裁掉的圖片永遠不會觸發。
- 參觀須知的逐字亮起用 CSS scroll-driven animation（`animation-timeline: view()`），不支援的瀏覽器直接顯示完整文字。還沒亮的字是 `#8A857E`，在紙色背景上對比 3.3:1，符合大字的 AA 標準。
- 開場幕簾是純 CSS，寫在 layout 裡，所以只在整頁載入時播放，站內換頁不會重播；它不接收點擊，也對輔助科技隱藏。Lenis 只在 `pointer: fine`（滑鼠、觸控板）時啟用，`<dialog>` 裡的捲動不經過 Lenis。
- 沒有全站的 `loading.tsx`：它會在每頁外面包一層 Suspense，頁面在 `notFound()` 之前就以 200 送出外框，不存在的作品就拿不到 404。首頁的搜尋結果有自己的 Suspense 與骨架畫面。

### 中英雙語（`lib/i18n/`）

- 網址是 `/en/...` 與 `/zh-tw/...`。`proxy.ts` 把沒有語言前綴的網址導向使用者選過的語言（cookie），沒選過就看瀏覽器的 `Accept-Language`，再沒有就英文。
- 介面文字放在純字串字典（`{佔位符}`），server 與 client 元件共用；測試會檢查兩種語言的鍵與佔位符一致。
- 館方作品資料只有英文，標題、作者、年代、媒材、說明維持原文並標上 `lang="en"`，搜尋也要用英文關鍵字。中文版的 About 與搜尋提示有寫明。
- 導覽列的語言切換會保留目前頁面與搜尋條件；連結文字是另一種語言的名稱，完整說明給螢幕閱讀器。

### 作品詳情與收藏

- `/[lang]/artworks/[id]`：大圖（843px，srcset 到 1200px）、作品資料、館方連結、Open Graph、JSON-LD（`VisualArtwork`）。不存在或格式錯誤的 id 回 404；非公有領域或沒有圖片的作品顯示說明與館方連結，不顯示圖片。
- 作品說明（CC BY 4.0）在伺服器端把館方的 HTML 拆成段落與斜體片段，用一般 React 元素輸出，不用 `dangerouslySetInnerHTML`，並標示出處。JSON-LD 是唯一的 inline script，內容是我們自己組的 JSON，`<`、`>`、`&` 都轉成 `\u` 跳脫。
- 完整圖片用原生 `<dialog>` 的 modal 模式：焦點限制在對話框內、Escape 關閉、關閉後焦點回到按鈕。最大只到館方對公有領域作品開放的 1686px。
- 收藏存在 localStorage（`gallery-atlas:collection`），有版本號並用 Zod（`zod/mini`，瀏覽器端約 7 KB gzip）逐筆驗證：損毀的 JSON 重設、舊版的純 id 陣列自動升級、重複與無效的項目移除、上限 500 件。讀取用 `useSyncExternalStore`，伺服器與 hydration 時一律視為空收藏，所以不會有 hydration 不一致；`storage` event 讓其他分頁同步。
- 「我的收藏」頁把收藏的 id 交給 `/api/artworks?ids=` 重新檢查，館方下架或不再是公有領域的作品會列為無法顯示，並提供一鍵移除。

### 自訂展覽

- 「我的收藏」頁可以建立展覽，作品頁和收藏卡片上的「加入展覽」對話框用勾選的方式加入或移除，也能在對話框裡直接建立新展覽。
- 每個展覽有自己的頁面（`/[lang]/collection/[展覽 id]`），可以重新命名、移除作品、刪除展覽。刪除用確認對話框，焦點預設在「取消」，按 Escape 等同取消。
- 最多 10 個展覽、每個 100 件，同一件作品在同一個展覽只會出現一次；超過上限或名稱空白時會顯示說明。名稱上限 80 個字元。
- 展覽和收藏存在同一份 localStorage 資料裡，所有寫入都套用在最新的儲存狀態上，所以另一個分頁的修改不會被覆蓋。展覽頁的資料只在瀏覽器端，伺服器只檢查 id 格式。
- 作品資料由共用的 `useArtworks` 讀取：同一頁面期間已讀過的作品不重抓，一次最多 200 個 id。

### 館方 API（`lib/artic/`）

- 只有伺服器會呼叫館方 API：頁面的 Server Component，以及 `/api/artworks`（搜尋、批次 `ids`）、`/api/artworks/[id]` 兩個 route handler。
- 搜尋用 `GET /artworks/search?params=`，帶固定的 Elasticsearch 查詢：`is_public_domain: true`、`image_id` 存在、可選的 `artwork_type_id`。關鍵字用 `multi_match`（`cross_fields`、`operator: and`），把輸入當純文字比對標題、作者、主題等欄位，所以「monet water lilies」可以跨欄位命中，特殊字元也不會被當成查詢語法。頂層的 `q` 參數和放進 `params` 的 `q` 實測都不會過濾結果，所以沒有採用。
- 使用者能控制的有：關鍵字（最多 100 字）、類型（白名單 7 種）、年代（白名單 7 段，比對 `date_start`）、主色（白名單 7 種，比對 `color.h`）、一個風格／主題／專題標籤（最多 60 字，對 `*_titles.keyword` 精確比對）、頁碼（1 到 83）。每個值都放進固定的查詢結構，當成 JSON 資料送出。超過 1,000 筆的頁碼在伺服器端直接回錯誤訊息，不會打上游。
- 主色用的是館方算的單一主色，只收飽和度 25 以上、亮度 15 到 85 的作品，否則大部分版畫和素描會因為紙色被歸到「赭黃」。紫色單獨只有約 20 件，所以和粉色合成「紫」。
- 館方 API 前面的 CDN 會擋掉長度超過約 2,000 字元的網址（2026-11-18 實測：1,883 字元可以，2,083 字元回 403）。搜尋請求超過 1,900 字元時不會送出，直接請使用者減少條件。首頁統計因此拆成兩個請求：策展入口與年代用 `filters` 和 `range` aggregation，主色用每 5 度一格的 `histogram` 再在伺服器端加總。
- 藝術家資料來自 `/agents/{id}`；同一位藝術家的作品用 `artist_id` 篩選。
- 能不能展示由伺服器判斷：`is_public_domain === true`、`image_id` 是館方的 UUID 格式、`config.iiif_url` 是館方自己的 IIIF 主機，三者都成立才會產生 `Artwork`。圖片寬度只用館方文件列的尺寸。
- client 有 9 秒逾時，5xx、逾時、網路錯誤最多重試 2 次（指數退避加抖動）；429 只在 `Retry-After` 不超過 5 秒時等一次，其他 4xx 不重試。
- 請求帶 `User-Agent: GalleryAtlas/0.1`（Workers 的 fetch 預設不帶，館方的 Cloudflare 會對沒有 User-Agent 的請求回 403），以及館方要求的 `AIC-User-Agent`（有設定 `AIC_CONTACT_EMAIL` 才附信箱）。
- 快取用 vinext 支援的 `fetch(..., { next: { revalidate } })`：搜尋 10 分鐘，作品 1 小時，藝術家與首頁統計 1 天。
- 首頁 3D 展廳的 8 件精選作品用批次 `ids` 即時讀取；API 失敗時改用 `lib/fixtures/preview-artworks.ts` 的快照（2026-11-18），頁面上會寫明是存下來的版本。

### SEO

- 首頁、About、作品頁、藝術家頁有各自的 title、description 與 hreflang；作品頁另有 Open Graph 圖片與 JSON-LD。
- `robots.txt` 排除 `/api/` 和兩種語言的「我的收藏」；`sitemap.xml` 列出兩種語言的首頁、About 和精選作品頁。需要設定 `SITE_URL` 才會輸出完整網址。
- 搜尋結果頁與我的收藏標記 `noindex`。

## 暫時無法升級的套件

- TypeScript 停在 6.0：typescript-eslint 還不支援 7。
- ESLint 停在 9：eslint-plugin-jsx-a11y 還不支援 10。
- `@cloudflare/vite-plugin` 用 2.0.0-rc.1，`cf` 是 1.0.0-rc.1，這是 vinext 對 Cloudflare 的建議設定；穩定版的 1.x 屬於舊的 Wrangler 設定方式。2.0.0-beta 版產生的建置輸出是舊格式，`cf` 部署時會拒收。

## 已知問題

- 館方 IIIF 圖片伺服器會對自動化環境回 Cloudflare challenge（403），所以開發時看不到真實作品圖，也還沒確認圖片有沒有回 CORS 標頭（3D 展廳的貼圖需要）。圖片載不到時，3D 畫框裡是空白的打底畫布，卡片顯示 Image unavailable。正式站還沒用一般瀏覽器確認過。
- 主色是館方算出的單一顏色，不一定是畫面看起來最明顯的顏色。例如〈大碗島的星期天下午〉的主色是灰綠，太淡而不屬於任何色系。
- 3D 展廳的效能只量過每幀成本（AMD Radeon 890M 內顯約 2 ms），沒有在實體手機上量過 fps。
- `npm audit` 還有上游套件的警告，沒有不降版的修正：picomatch（ReDoS，所有版本都受影響，經由 vite 與 vinext 在建置時比對檔案路徑）、fflate（經由 `@vercel/og`，本專案沒有用到 OG 圖片產生）。`npm audit fix --force` 會把 vinext 降到 0.2.1，所以不採用。
- npm 擋下了 `workerd` 的 postinstall script，目前本機預覽與建置仍可正常執行。
- 每頁會把整份介面字典（約 5 KB）序列化給 client 元件使用，目前沒有按頁拆分。
- 搜尋結果頁的 title 是依關鍵字動態產生的。一般瀏覽器和 Googlebot 會在 body 裡收到串流的 metadata，Twitterbot、facebookexternalhit 這類不執行 JS 的爬蟲則在 `<head>` 收到。這是 Next.js 的 streaming metadata 行為，vinext 照做。
