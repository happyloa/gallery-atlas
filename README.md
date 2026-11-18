# Gallery Atlas

[![CI](https://github.com/happyloa/gallery-atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/happyloa/gallery-atlas/actions/workflows/ci.yml)

瀏覽與收藏公有領域藝術作品的網站，資料與圖片來自[芝加哥藝術博物館 API](https://api.artic.edu/docs/)。介面有英文與繁體中文。

網站：<https://gallery-atlas.piafyoyo06.workers.dev>

> 本站為個人作品，與芝加哥藝術博物館無關。This is an independent project and is not affiliated with the Art Institute of Chicago.

## 功能

- 首頁的 three.js 3D 展廳，掛著館方精選作品
- 搜尋館藏，依類型、年代、主色、館方標籤篩選
- 作品頁：大圖、作品資料與說明、館藏紀錄、是否在館內展出
- 藝術家頁
- 收藏與自訂展覽，存在瀏覽器，不需要帳號

## 技術

vinext（Next.js App Router API on Vite）、React 19、TypeScript、Tailwind CSS v4、three.js，部署在 Cloudflare Workers，館方 API 的快取放在 Cloudflare KV。

## 開發

需要 Node.js 22 以上。

```bash
npm install
npm run dev          # http://localhost:5173
npm run build
npm run deploy       # 建置並部署到 Cloudflare Workers
```

環境變數（只在伺服器端使用，範本見 `.env.example`）：

| 變數                | 用途                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `AIC_CONTACT_EMAIL` | 附在送給館方 API 的 `AIC-User-Agent` 標頭，館方要求提供聯絡方式。    |
| `SITE_URL`          | 正式網址，用於 Open Graph、hreflang、`sitemap.xml`、`robots.txt`。   |
| `AIC_FIXTURES`      | 設為 `1` 時，`vite dev` 改用本機假資料，不連館方 API（E2E 用這個）。 |

## 測試

```bash
npm run lint
npm run typecheck
npm test             # Vitest，上游 API 全部 mock
npm run test:smoke   # 打真實館方 API
npm run test:e2e     # Playwright 與 axe 無障礙掃描
```

E2E 會自己啟動 dev server（port 5174），跑之前要先停掉 `npm run dev`：vinext 同一個專案只允許一個 dev server。

## 部署

1. `npx cf auth login`
2. 設定 secret：

   ```bash
   npx cf workers secrets update AIC_CONTACT_EMAIL --worker gallery-atlas --type secret_text
   npx cf workers secrets update SITE_URL --worker gallery-atlas --type secret_text
   ```

3. `npm run deploy`。第一次部署會自動建立 KV namespace。

要 push 後自動部署：Cloudflare 後台 Workers & Pages → gallery-atlas → Settings → Builds，連上這個 repo 的 `main`。Build command 留空，Deploy command 填 `npm run deploy`。

## 資料與授權

- 只顯示 `is_public_domain` 為 `true` 且有圖片的作品，圖片直接連結館方 IIIF。
- 作品 metadata 為 CC0。作品與藝術家的說明是 CC BY 4.0，網站上有標示出處。圖片使用依館方的 [Image Licensing](https://www.artic.edu/image-licensing) 與 [Terms](https://www.artic.edu/terms)。
- 本 repo 的程式碼尚未選定授權。

## 已知限制

- 館方圖片伺服器會擋自動化環境，本機開發與 E2E 看不到真實作品圖；一般瀏覽器正常。
- 館方 API 的 CDN 會擋掉超過約 2,000 字元的網址，篩選條件太多時網站會請使用者減少條件。
- TypeScript 停在 6.0、ESLint 停在 9，等 typescript-eslint 與 eslint-plugin-jsx-a11y 支援新版。
