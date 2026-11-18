# Gallery Atlas

[![CI](https://github.com/happyloa/gallery-atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/happyloa/gallery-atlas/actions/workflows/ci.yml)

瀏覽與收藏公有領域藝術作品的網站，資料與圖片來自[芝加哥藝術博物館 API](https://api.artic.edu/docs/)。介面有英文與繁體中文。

網站：<https://gallery-atlas.piafyoyo06.workers.dev>

> 本站為個人作品，與芝加哥藝術博物館無關。This is an independent project and is not affiliated with the Art Institute of Chicago.

## 功能

- 首頁的 three.js 3D 展廳，掛著館方精選作品；每日一件、隨機一件
- 搜尋館藏，依類型、年代、主色、產地、館方標籤篩選，可依年代排序，有輸入建議
- 作品頁：深度縮放、作品資料與說明、館藏紀錄、語音導覽、展出位置、延伸閱讀
- 語音導覽：18 條路線連續播放，附逐字稿，部分有中文語音；有公有領域作品的路線可邊聽邊逛 3D 展廳
- 藝術家索引與藝術家頁、展廳總覽與展廳頁、館方展覽、產地地圖
- 全站搜尋、分類瀏覽（類型、部門、材質、技法、風格、主題、地點）
- 閱讀中心（文章、學術圖錄、出版品、教學資源、新聞稿）、活動行事曆、開放時間、博物館商店、影音資料
- 收藏與自訂展覽，存在瀏覽器，不需要帳號；展覽可以用連結分享

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

環境變數（只在伺服器端使用）。前兩個的範本在 `.env.example`，`AIC_FIXTURES` 要設在 shell 裡，PowerShell 是 `$env:AIC_FIXTURES=1; npm run dev`：

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

Worker 已用 Workers Builds 連上這個 repo：push 到 `main` 會自動建置並部署（Deploy command 是 `npm run deploy`）。Noto Serif TC 在部署時下載到 `public/fonts/`，不進 repo，所以本機開發時中文會顯示系統字型。

## 資料與授權

- 只顯示 `is_public_domain` 為 `true` 且有圖片的作品，圖片直接連結館方 IIIF。
- 作品 metadata 為 CC0。作品與藝術家的說明是 CC BY 4.0，網站上有標示出處。圖片使用依館方的 [Image Licensing](https://www.artic.edu/image-licensing) 與 [Terms](https://www.artic.edu/terms)。
- 文章、圖錄、活動、商品、開放時間等館方內容 © 芝加哥藝術博物館，僅限非商業教育用途，頁面上保留版權聲明與原文連結。地點資料是 CC BY 4.0，含 Getty TGN 資料。
- 語音導覽的音檔與逐字稿 © 芝加哥藝術博物館，僅限非商業使用。路線結構來自館方手機 App 的公開資料，用 `node scripts/build-tours.mjs --index` 更新；中文逐字稿在部署時產生，不進 repo。
- 本 repo 的程式碼採用 [MIT 授權](LICENSE)，只涵蓋程式碼；作品資料、圖片與語音內容依上面列的館方授權。

## 已知限制

- 館方圖片伺服器會擋自動化環境，本機開發與 E2E 看不到真實作品圖；一般瀏覽器正常。
- 館方 API 的 CDN 會擋掉超過約 2,000 字元的網址，篩選條件太多時網站會請使用者減少條件。
- 作品頁的部分館方講座錄音沒有逐字稿。
- 中文語音只涵蓋部分路線；館方的中文文字稿是簡體，以 OpenCC 轉成台灣繁體。
- 3D 展廳只在模擬手機（CPU 降速 6 倍）下量過，維持 60 fps；沒有在實體手機的 GPU 上量過。
- TypeScript 停在 6.0、ESLint 停在 9，等 typescript-eslint 與 eslint-plugin-jsx-a11y 支援新版。
