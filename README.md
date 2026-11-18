# Gallery Atlas

瀏覽、欣賞、收藏公有領域藝術作品的網站。作品資料與圖片來自芝加哥藝術博物館（Art Institute of Chicago）的公開 API。

> An independent, thoughtfully designed space to discover, appreciate, and curate public-domain art.

網站：尚未部署（預計部署到 Cloudflare Workers）。介面有英文與繁體中文。

技術：vinext（在 Vite 上執行的 Next.js App Router API）、React 19、TypeScript（strict）、Tailwind CSS v4、three.js，部署在 Cloudflare Workers。

> This is an independent project and is not affiliated with the Art Institute of Chicago.
> 本站為個人作品，與芝加哥藝術博物館無關。

## 開發

需要 Node.js 22 以上（開發時用 26）。

```bash
npm install
npm run dev          # 開發伺服器
npm run build        # 建置 Cloudflare Worker
npm run start        # 在本機 workerd 預覽建置結果
npm run deploy       # 部署到 Cloudflare Workers
```

```bash
npm run lint
npm run typecheck
npm test             # 單元、整合與元件測試，上游 API 全部 mock
npm run test:smoke   # 打真實館方 API 的 smoke test，需要網路
npm run test:e2e     # Playwright，用 fixture 模式啟動 dev server
```

E2E 會自己用 `AIC_FIXTURES=1 vite dev`（port 5174）啟動伺服器，館方 API 改由 `lib/artic/dev-fixtures.ts` 的本機資料回應，IIIF 圖片在瀏覽器端攔截，所以結果不受館方伺服器影響。vinext 同一個專案只允許一個 dev server，跑 E2E 前要先停掉 `npm run dev`。fixture 模式只在 `vite dev` 時編譯進去，`vite build` 的產物裡這個開關固定為關閉。

環境變數見 `.env.example`。`AIC_CONTACT_EMAIL` 只在伺服器端使用，會放進送給館方 API 的 `AIC-User-Agent` 標頭。本機開發可以不填，正式上線要填一個有效的公開聯絡信箱。

## 資料來源與授權

- API：[Art Institute of Chicago API](https://api.artic.edu/docs/)，圖片走館方的 IIIF Image API。所有對館方的請求都由伺服器端發出，館方對匿名請求的限制是每分鐘 60 次。
- 只顯示 `is_public_domain` 為 `true` 且有 `image_id` 的作品圖片。圖片直接連結館方 IIIF，不下載到本 repo。
- 作品 metadata 為 CC0；作品的 `description` 欄位是 CC BY 4.0，要顯示時必須標示來源。圖片的使用以館方的 [Image Licensing](https://www.artic.edu/image-licensing) 與 [Terms](https://www.artic.edu/terms) 為準。
- 網站上的來源標示：Image and artwork data courtesy of the Art Institute of Chicago。
- 不提供高解析圖下載。

## 實作進度

| 階段    | 內容                                   | 狀態   |
| ------- | -------------------------------------- | ------ |
| Phase 0 | 專案初始化、lint、型別檢查、建置       | 完成   |
| Phase 1 | 版面、設計 token、共用元件、About      | 完成   |
| Phase 2 | 館方 API 串接、搜尋、篩選、分頁        | 完成   |
| Phase 3 | 中英雙語、作品詳情、收藏、E2E          | 完成   |
| Phase 4 | 自訂策展清單                           | 未開始 |
| Phase 5 | 無障礙、SEO、README、GitHub Actions CI | 未開始 |
| Phase 6 | 部署到 Cloudflare Workers、正式站驗證  | 未開始 |

## 技術決策

- 用 vinext 而不用 Next.js 加 OpenNext：要部署到 Cloudflare Workers，vinext 原生支援，建置也比較輕。程式碼照 Next.js App Router 的寫法，萬一碰到 vinext 解決不了的相容問題，可以換回 Next.js 加 OpenNext。
- vinext 的 `next/image` 沒有建置期圖片最佳化，作品圖直接用館方 IIIF 的固定尺寸，加上 lazy loading 與明確的寬高。
- Cloudflare KV 資料快取與 Cloudflare Images 目前關閉，部署時再評估。在那之前 vinext 用記憶體快取，Workers 上不會跨 isolate 保留。
- 程式碼直接放在根目錄的 `app/`、`components/`、`lib/`，路徑別名 `@/*` 指向專案根目錄。
- 首頁 hero 是一間 three.js 展廳（`components/gallery-room/`）：作品照實際尺寸掛在牆上，每件有自己的投射燈，房間光照在瀏覽器裡預先烘焙。canvas 只是裝飾，標題、牆面標籤和上一件／下一件按鈕都在 HTML。沒有 WebGL 時保留靜態版面；開啟減少動態效果時不做鏡頭漂移，換作品直接切過去。
- three.js 與展廳程式在獨立的 chunk（gzip 約 141 KB），進到頁面後才載入，不在首屏 JS 裡。
- 圖示是自己畫的 inline SVG（`components/ui/icons.tsx`），沒有用 lucide-react。在 Workers 上 lucide-react 會被打包成循環依賴的 server chunk，執行時 React 還沒載入，每一頁都回 500。
- 次要文字的灰色從規格的 `#77736E` 改成 `#6B6762`：原本在紙色背景上對比只有 4.2:1，改後 5.0:1，符合 WCAG AA。
- 字型：標題 Newsreader，內文 Instrument Sans，中文 Noto Serif TC。build 時自行託管，中文字型切成 unicode-range 小檔，頁面只下載用到的字。
- 沒有全站的 `loading.tsx`：它會在每頁外面包一層 Suspense，頁面在 `notFound()` 之前就以 200 送出外框，不存在的作品就拿不到 404。首頁的搜尋結果有自己的 Suspense 與骨架畫面。

### 中英雙語（`lib/i18n/`）

- 網址是 `/en/...` 與 `/zh-tw/...`。`proxy.ts` 把沒有語言前綴的網址導向使用者選過的語言（cookie），沒選過就看瀏覽器的 `Accept-Language`，再沒有就英文。
- 介面文字放在純字串字典（`{佔位符}`），server 與 client 元件共用；測試會檢查兩種語言的鍵與佔位符一致。
- 館方作品資料只有英文，標題、作者、年代、媒材、說明維持原文並標上 `lang="en"`，搜尋也要用英文關鍵字。中文版的 About 與搜尋提示有寫明。
- 導覽列的語言切換會保留目前頁面與搜尋條件。

### 作品詳情與收藏

- `/[lang]/artworks/[id]`：大圖（843px，srcset 到 1200px）、作品資料、館方連結、Open Graph。不存在或格式錯誤的 id 回 404；非公有領域或沒有圖片的作品顯示說明與館方連結，不顯示圖片。
- 作品說明（CC BY 4.0）在伺服器端把館方的 HTML 拆成段落與斜體片段，用一般 React 元素輸出，不用 `dangerouslySetInnerHTML`，並標示出處。
- 完整圖片用原生 `<dialog>` 的 modal 模式：焦點限制在對話框內、Escape 關閉、關閉後焦點回到按鈕。最大只到館方對公有領域作品開放的 1686px。
- 收藏存在 localStorage（`gallery-atlas:collection`），有版本號並用 Zod 逐筆驗證：損毀的 JSON 重設、舊版的純 id 陣列自動升級、重複與無效的項目移除、上限 500 件。讀取用 `useSyncExternalStore`，伺服器與 hydration 時一律視為空收藏，所以不會有 hydration 不一致；`storage` event 讓其他分頁同步。
- 「我的收藏」頁把收藏的 id 交給 `/api/artworks?ids=` 重新檢查，館方下架或不再是公有領域的作品會列為無法顯示，並提供一鍵移除。

### 館方 API（`lib/artic/`）

- 只有伺服器會呼叫館方 API：首頁的 Server Component，以及 `/api/artworks`（搜尋、批次 `ids`）、`/api/artworks/[id]` 兩個 route handler。
- 搜尋用 `GET /artworks/search?params=`，帶固定的 Elasticsearch 查詢：`is_public_domain: true`、`image_id` 存在、可選的 `artwork_type_id`。關鍵字用 `multi_match`（`cross_fields`、`operator: and`），把輸入當純文字比對標題、作者、主題等欄位，所以「monet water lilies」可以跨欄位命中，特殊字元也不會被當成查詢語法。頂層的 `q` 參數和放進 `params` 的 `q` 實測都不會過濾結果，所以沒有採用。
- 使用者只能控制三件事：關鍵字（最多 100 字）、類型（白名單 7 種）、頁碼（1 到 83）。超過 1,000 筆的頁碼在伺服器端直接回錯誤訊息，不會打上游。
- 能不能展示由伺服器判斷：`is_public_domain === true`、`image_id` 是館方的 UUID 格式、`config.iiif_url` 是館方自己的 IIIF 主機，三者都成立才會產生 `Artwork`。圖片寬度只用館方文件列的尺寸。
- client 有 9 秒逾時，5xx、逾時、網路錯誤最多重試 2 次（指數退避加抖動）；429 只在 `Retry-After` 不超過 5 秒時等一次，其他 4xx 不重試。
- 請求帶 `User-Agent: GalleryAtlas/0.1`（Workers 的 fetch 預設不帶，館方的 Cloudflare 會對沒有 User-Agent 的請求回 403），以及館方要求的 `AIC-User-Agent`（有設定 `AIC_CONTACT_EMAIL` 才附信箱）。
- 快取用 vinext 支援的 `fetch(..., { next: { revalidate } })`：搜尋 10 分鐘，作品 1 小時。
- 首頁 3D 展廳的 8 件精選作品用批次 `ids` 即時讀取；API 失敗時改用 `lib/fixtures/preview-artworks.ts` 的快照（2026-11-18），頁面上會寫明是存下來的版本。

## 暫時無法升級的套件

- TypeScript 停在 6.0：typescript-eslint 還不支援 7。
- ESLint 停在 9：eslint-plugin-jsx-a11y 還不支援 10。
- `@cloudflare/vite-plugin` 2.x 與 `cf` 目前是 beta／rc，這是 vinext 對 Cloudflare 的建議設定；穩定版的 1.x 屬於舊的 Wrangler 設定方式。

## 已知問題

- `npm audit` 還有上游套件的警告，沒有不降版的修正：picomatch（ReDoS，所有版本都受影響，經由 vite 與 vinext 在建置時比對檔案路徑）、fflate（經由 `@vercel/og`，本專案沒有用到 OG 圖片產生）。`npm audit fix --force` 會把 vinext 降到 0.2.1，所以不採用。
- npm 擋下了 `workerd` 的 postinstall script，目前本機預覽仍可正常執行。
- 館方 IIIF 圖片伺服器會對自動化環境回 Cloudflare challenge（403），所以開發時看不到真實作品圖，也還沒確認圖片有沒有回 CORS 標頭（3D 展廳的貼圖需要）。圖片載不到時，3D 畫框裡是空白的打底畫布，卡片顯示 Image unavailable。需要在一般瀏覽器裡再確認。
- 3D 展廳的效能只量過每幀成本（AMD Radeon 890M 內顯約 2 ms），沒有在實體手機上量過 fps。
- 收藏的 Zod 驗證讓瀏覽器端多了約 24 KB（gzip）的 JS。之後評估改用 `zod/mini`。
- 每頁會把整份介面字典（約 5 KB）序列化給 client 元件使用，目前沒有按頁拆分。
- 搜尋結果頁的 title 是依關鍵字動態產生的。一般瀏覽器和 Googlebot 會在 body 裡收到串流的 metadata，Twitterbot、facebookexternalhit 這類不執行 JS 的爬蟲則在 `<head>` 收到。這是 Next.js 的 streaming metadata 行為，vinext 照做。
